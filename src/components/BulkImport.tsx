import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileText, FileDown, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

interface ImportRow {
  osobni_cislo: string;
  jmeno: string;
  prijmeni: string;
  email: string;
  pozice: string;
  stredisko_kod: string;
  stredisko_nazev: string;
  typ_skoleni: string;
  provozovna: string;
  datum_posledniho_skoleni: string;
  perioda_dny: string;
  skolitel?: string;
  firma?: string;
  poznamka?: string;
}

interface DuplicateRecord {
  row: number;
  data: ImportRow;
  existingTraining: {
    id: string;
    last_training_date: string;
    next_training_date: string;
  };
}

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string; data: any }>;
  warnings: Array<{ row: number; warning: string }>;
  duplicates?: DuplicateRecord[];
}

export function BulkImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateRecord[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<'skip' | 'overwrite' | 'import'>('skip');

  const downloadTemplate = () => {
    const template = [
      {
        osobni_cislo: "102756",
        jmeno: "Jan",
        prijmeni: "Novák",
        email: "jan.novak@example.com",
        pozice: "Operátor výroby",
        stredisko_kod: "2002000003",
        stredisko_nazev: "Výroba",
        typ_skoleni: "BOZP - Základní",
        provozovna: "Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3",
        datum_posledniho_skoleni: "2024-01-15",
        perioda_dny: "365",
        skolitel: "Petr Svoboda",
        firma: "BOZP Servis s.r.o.",
        poznamka: "Pravidelné školení",
      },
    ];

    const csv = Papa.unparse(template);
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_skoleni.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Šablona stažena",
      description: "Použijte staženou šablonu pro import školení.",
    });
  };

  const parseFile = async (file: File): Promise<ImportRow[]> => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data as ImportRow[]),
          error: (error) => reject(error),
        });
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as ImportRow[];
      return jsonData;
    } else {
      throw new Error("Nepodporovaný formát souboru. Použijte CSV nebo Excel.");
    }
  };

  const validateRow = (row: ImportRow, index: number): string[] => {
    const errors: string[] = [];

    if (!row.osobni_cislo?.trim()) errors.push("Chybí osobní číslo");
    if (!row.jmeno?.trim()) errors.push("Chybí jméno");
    if (!row.prijmeni?.trim()) errors.push("Chybí příjmení");
    if (!row.email?.trim() || !row.email.includes("@")) errors.push("Neplatný email");
    if (!row.pozice?.trim()) errors.push("Chybí pozice");
    if (!row.stredisko_kod?.trim()) errors.push("Chybí kód střediska");
    if (!row.stredisko_nazev?.trim()) errors.push("Chybí název střediska");
    if (!row.typ_skoleni?.trim()) errors.push("Chybí typ školení");
    if (!row.provozovna?.trim()) errors.push("Chybí provozovna");
    if (!row.datum_posledniho_skoleni?.trim()) errors.push("Chybí datum posledního školení");
    if (!row.perioda_dny?.trim() || isNaN(parseInt(row.perioda_dny))) {
      errors.push("Neplatná perioda");
    }

    // Validate date format
    if (row.datum_posledniho_skoleni) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(row.datum_posledniho_skoleni)) {
        errors.push("Datum musí být ve formátu YYYY-MM-DD");
      }
    }

    return errors;
  };

  const processImport = async (rows: ImportRow[], skipDuplicateCheck = false) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Uživatel není přihlášen");
    }

    const result: ImportResult = {
      success: 0,
      errors: [],
      warnings: [],
      duplicates: [],
    };

    const foundDuplicates: DuplicateRecord[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // +2 because of header and 0-index

      try {
        // Validate row
        const validationErrors = validateRow(row, rowIndex);
        if (validationErrors.length > 0) {
          result.errors.push({
            row: rowIndex,
            error: validationErrors.join(", "),
            data: row,
          });
          continue;
        }

        // 1. Create or get department
        let { data: department } = await supabase
          .from("departments")
          .select("id")
          .eq("code", row.stredisko_kod.trim())
          .maybeSingle();

        if (!department) {
          const { data: newDept, error: deptError } = await supabase
            .from("departments")
            .insert({
              code: row.stredisko_kod.trim(),
              name: row.stredisko_nazev.trim(),
            })
            .select()
            .single();

          if (deptError) throw deptError;
          department = newDept;
        }

        // 2. Create or update employee
        let { data: employee } = await supabase
          .from("employees")
          .select("id")
          .eq("employee_number", row.osobni_cislo.trim())
          .maybeSingle();

        if (!employee) {
          const { data: newEmployee, error: empError } = await supabase
            .from("employees")
            .insert({
              employee_number: row.osobni_cislo.trim(),
              first_name: row.jmeno.trim(),
              last_name: row.prijmeni.trim(),
              email: row.email.trim(),
              position: row.pozice.trim(),
              department_id: department.id,
              status: "employed",
            })
            .select()
            .single();

          if (empError) throw empError;
          employee = newEmployee;
        }

        // 3. Create or get training type
        let { data: trainingType } = await supabase
          .from("training_types")
          .select("id")
          .eq("name", row.typ_skoleni.trim())
          .eq("facility", row.provozovna.trim())
          .maybeSingle();

        if (!trainingType) {
          const { data: newType, error: typeError } = await supabase
            .from("training_types")
            .insert({
              name: row.typ_skoleni.trim(),
              facility: row.provozovna.trim(),
              period_days: parseInt(row.perioda_dny),
              description: "",
            })
            .select()
            .single();

          if (typeError) throw typeError;
          trainingType = newType;
        }

        // 4. Check for duplicates (same employee + training type)
        if (!skipDuplicateCheck) {
          const { data: existingTraining } = await supabase
            .from("trainings")
            .select("id, last_training_date, next_training_date")
            .eq("employee_id", employee.id)
            .eq("training_type_id", trainingType.id)
            .maybeSingle();

          if (existingTraining) {
            foundDuplicates.push({
              row: rowIndex,
              data: row,
              existingTraining,
            });
            continue;
          }
        }

        // 5. Calculate next training date
        const lastDate = new Date(row.datum_posledniho_skoleni);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + parseInt(row.perioda_dny));

        // 6. Create or update training based on duplicate action
        if (skipDuplicateCheck && duplicateAction === 'overwrite') {
          // Find existing training to update
          const { data: existingTraining } = await supabase
            .from("trainings")
            .select("id")
            .eq("employee_id", employee.id)
            .eq("training_type_id", trainingType.id)
            .maybeSingle();

          if (existingTraining) {
            const { error: updateError } = await supabase
              .from("trainings")
              .update({
                facility: row.provozovna.trim(),
                last_training_date: row.datum_posledniho_skoleni,
                next_training_date: nextDate.toISOString().split("T")[0],
                trainer: row.skolitel?.trim() || null,
                company: row.firma?.trim() || null,
                note: row.poznamka?.trim() || null,
              })
              .eq("id", existingTraining.id);

            if (updateError) throw updateError;
          }
        } else if (duplicateAction === 'skip' && skipDuplicateCheck) {
          // Skip this record
          continue;
        } else {
          // Insert new training
          const { error: trainingError } = await supabase.from("trainings").insert({
            employee_id: employee.id,
            training_type_id: trainingType.id,
            facility: row.provozovna.trim(),
            last_training_date: row.datum_posledniho_skoleni,
            next_training_date: nextDate.toISOString().split("T")[0],
            trainer: row.skolitel?.trim() || null,
            company: row.firma?.trim() || null,
            note: row.poznamka?.trim() || null,
            created_by: user.id,
            status: "valid",
          });

          if (trainingError) throw trainingError;
        }

        result.success++;
        setProgress(Math.round(((i + 1) / rows.length) * 100));
      } catch (error: any) {
        result.errors.push({
          row: rowIndex,
          error: error.message || "Neznámá chyba",
          data: row,
        });
      }
    }

    // If duplicates found and not skipping check, show dialog
    if (foundDuplicates.length > 0 && !skipDuplicateCheck) {
      setDuplicates(foundDuplicates);
      setShowDuplicateDialog(true);
      result.duplicates = foundDuplicates;
    }

    return result;
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Chyba",
        description: "Nejprve vyberte soubor",
        variant: "destructive",
      });
      return;
    }

    // Validace velikosti souboru
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      toast({
        title: "Soubor je příliš velký",
        description: "Maximální velikost souboru je 5MB.",
        variant: "destructive",
      });
      return;
    }

    // Validace typu souboru
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls'];
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      toast({
        title: "Nepodporovaný formát",
        description: "Podporované formáty: CSV, XLSX, XLS",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      const rows = await parseFile(file);

      if (rows.length === 0) {
        toast({
          title: "Chyba",
          description: "Soubor neobsahuje žádná data",
          variant: "destructive",
        });
        return;
      }

      const importResult = await processImport(rows);
      setResult(importResult);

      if (importResult.duplicates && importResult.duplicates.length > 0) {
        // Don't show toast, wait for user decision
        return;
      }

      if (importResult.errors.length === 0) {
        toast({
          title: "Import dokončen",
          description: `Úspěšně importováno ${importResult.success} školení`,
        });
      } else {
        toast({
          title: "Import dokončen s chybami",
          description: `Importováno ${importResult.success} školení, ${importResult.errors.length} chyb`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Chyba při importu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const handleReImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    if (!newFile) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (newFile.size > MAX_SIZE) {
      toast({
        title: "Soubor je příliš velký",
        description: "Maximální velikost souboru je 5MB.",
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    const fileExtension = newFile.name.split(".").pop()?.toLowerCase();
    const ALLOWED_EXTENSIONS = ['csv', 'xlsx', 'xls'];
    if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      toast({
        title: "Nepodporovaný formát",
        description: "Podporované formáty: CSV, XLSX, XLS",
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    setImporting(true);
    setProgress(0);
    setFile(newFile);

    try {
      const rows = await parseFile(newFile);
      if (rows.length === 0) {
        toast({
          title: "Chyba",
          description: "Soubor neobsahuje žádná data",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      const importResult = await processImport(rows);
      setResult(importResult);

      toast({
        title: "Soubor znovu načten",
        description: `Importováno ${importResult.success} školení, ${importResult.errors.length} chyb`,
      });
    } catch (error: any) {
      toast({
        title: "Chyba při načítání souboru",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const exportErrors = () => {
    if (!result || result.errors.length === 0) {
      toast({
        title: "Žádné chyby",
        description: "Nejsou k dispozici žádné chybné záznamy k exportu.",
      });
      return;
    }

    const errorData = result.errors.map(error => ({
      radek: error.row,
      chyba: error.error,
      osobni_cislo: error.data?.osobni_cislo || '',
      jmeno: error.data?.jmeno || '',
      prijmeni: error.data?.prijmeni || '',
      email: error.data?.email || '',
      pozice: error.data?.pozice || '',
      stredisko_kod: error.data?.stredisko_kod || '',
      stredisko_nazev: error.data?.stredisko_nazev || '',
      typ_skoleni: error.data?.typ_skoleni || '',
      provozovna: error.data?.provozovna || '',
      datum_posledniho_skoleni: error.data?.datum_posledniho_skoleni || '',
      perioda_dny: error.data?.perioda_dny || '',
      skolitel: error.data?.skolitel || '',
      firma: error.data?.firma || '',
      poznamka: error.data?.poznamka || '',
    }));

    const csv = Papa.unparse(errorData);
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split("T")[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `chyby_import_skoleni_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export dokončen",
      description: `Exportováno ${errorData.length} chybných záznamů. Po opravě můžete soubor znovu nahrát.`,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">1. Stáhnout šablonu</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Stáhněte si šablonu CSV souboru a vyplňte ji daty školení.
            </p>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Stáhnout šablonu CSV
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">2. Nahrát soubor</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Nahrajte vyplněný CSV nebo Excel soubor.
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              <strong>Limity:</strong> Maximální velikost 5MB. Podporované formáty: CSV, XLSX, XLS.
            </p>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="import-file">Soubor (CSV nebo Excel)</Label>
                <Input
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  disabled={importing}
                />
              </div>
              <Button onClick={handleImport} disabled={!file || importing}>
                <Upload className="w-4 h-4 mr-2" />
                {importing ? "Importuji..." : "Importovat"}
              </Button>
            </div>
          </div>

          {importing && (
            <div className="space-y-2">
              <Label>Průběh importu</Label>
              <Progress value={progress} />
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </div>
          )}

          {result && (
            <div className="space-y-4 pt-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Výsledek importu</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-status-valid">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {result.success} úspěšných
                      </Badge>
                      {result.errors.length > 0 && (
                        <>
                          <Badge variant="destructive">
                            <XCircle className="w-3 h-3 mr-1" />
                            {result.errors.length} chyb
                          </Badge>
                          <div className="ml-auto flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={exportErrors}
                            >
                              <FileDown className="w-4 h-4 mr-2" />
                              Exportovat chyby
                            </Button>
                            <input
                              type="file"
                              id="reimport-file"
                              accept=".csv,.xlsx,.xls"
                              onChange={handleReImport}
                              className="hidden"
                            />
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => document.getElementById('reimport-file')?.click()}
                              disabled={importing}
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              {importing ? "Zpracovávám..." : "Nahrát opravený soubor"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {result.errors.length > 0 && (
                <Card className="p-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-destructive" />
                    Chyby při importu
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {result.errors.map((error, index) => (
                      <div
                        key={index}
                        className="text-sm p-2 bg-destructive/10 rounded border border-destructive/20"
                      >
                        <p className="font-medium">Řádek {error.row}:</p>
                        <p className="text-muted-foreground">{error.error}</p>
                        {error.data && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {error.data.osobni_cislo} - {error.data.jmeno}{" "}
                            {error.data.prijmeni}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Formát CSV souboru
        </h3>
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            CSV soubor musí obsahovat následující sloupce:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>
              <code>osobni_cislo</code> - Osobní číslo zaměstnance (povinné)
            </li>
            <li>
              <code>jmeno</code> - Jméno zaměstnance (povinné)
            </li>
            <li>
              <code>prijmeni</code> - Příjmení zaměstnance (povinné)
            </li>
            <li>
              <code>email</code> - Email zaměstnance (povinné)
            </li>
            <li>
              <code>pozice</code> - Pracovní pozice (povinné)
            </li>
            <li>
              <code>stredisko_kod</code> - Kód střediska (povinné)
            </li>
            <li>
              <code>stredisko_nazev</code> - Název střediska (povinné)
            </li>
            <li>
              <code>typ_skoleni</code> - Název typu školení (povinné)
            </li>
            <li>
              <code>provozovna</code> - Provozovna (povinné)
            </li>
            <li>
              <code>datum_posledniho_skoleni</code> - Formát YYYY-MM-DD (povinné)
            </li>
            <li>
              <code>perioda_dny</code> - Perioda v dnech (povinné)
            </li>
            <li>
              <code>skolitel</code> - Jméno školitele (volitelné)
            </li>
            <li>
              <code>firma</code> - Školící firma (volitelné)
            </li>
            <li>
              <code>poznamka</code> - Poznámka (volitelné)
            </li>
          </ul>
        </div>
      </Card>

      {/* Dialog pro duplicity */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-warning" />
              Nalezeny duplicitní záznamy
            </DialogTitle>
            <DialogDescription>
              Byly nalezeny záznamy, které již v systému existují pro daného zaměstnance a typ školení.
              Vyberte, jak s nimi chcete naložit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-2">Co znamená duplicita?</p>
                <p className="text-sm mb-2">
                  Duplicita nastává, když zaměstnanec již má v systému záznam o stejném typu školení 
                  (stejný typ školení + provozovna). Zaměstnanec může mít více školení ve stejný den, 
                  pokud se liší typ školení.
                </p>
                <p className="text-sm font-semibold mt-3">Nalezeno {duplicates.length} duplicitních záznamů</p>
              </AlertDescription>
            </Alert>

            <RadioGroup value={duplicateAction} onValueChange={(value: any) => setDuplicateAction(value)}>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="skip" id="skip" />
                  <div className="flex-1">
                    <Label htmlFor="skip" className="cursor-pointer font-semibold">
                      Přeskočit duplicity
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Duplicitní záznamy nebudou importovány. Existující data v systému zůstanou beze změny.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="overwrite" id="overwrite" />
                  <div className="flex-1">
                    <Label htmlFor="overwrite" className="cursor-pointer font-semibold">
                      Přepsat existující záznamy
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Aktualizovat existující záznamy novými daty z importu (datum školení, školitel, firma, atd.).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value="import" id="import" />
                  <div className="flex-1">
                    <Label htmlFor="import" className="cursor-pointer font-semibold">
                      Importovat jako nové záznamy
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Vytvořit nové záznamy i přes duplicitu. Zaměstnanec pak bude mít více záznamů 
                      stejného typu školení (použijte pouze pokud je to záměr).
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>

            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-2">
                <h4 className="font-semibold">Seznam duplicitních záznamů</h4>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Řádek</TableHead>
                      <TableHead>Zaměstnanec</TableHead>
                      <TableHead>Typ školení</TableHead>
                      <TableHead>Provozovna</TableHead>
                      <TableHead>Nové datum</TableHead>
                      <TableHead>Stávající datum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {duplicates.map((dup, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs">{dup.row}</TableCell>
                        <TableCell className="text-sm">
                          {dup.data.jmeno} {dup.data.prijmeni}
                          <br />
                          <span className="text-xs text-muted-foreground">{dup.data.osobni_cislo}</span>
                        </TableCell>
                        <TableCell className="text-sm">{dup.data.typ_skoleni}</TableCell>
                        <TableCell className="text-sm">{dup.data.provozovna}</TableCell>
                        <TableCell className="text-sm font-medium text-primary">
                          {dup.data.datum_posledniho_skoleni}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {dup.existingTraining.last_training_date}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDuplicateDialog(false);
                setDuplicates([]);
              }}
            >
              Zrušit import
            </Button>
            <Button
              onClick={async () => {
                setShowDuplicateDialog(false);
                setImporting(true);
                try {
                  if (!file) return;
                  const rows = await parseFile(file);
                  const importResult = await processImport(rows, true);
                  setResult(importResult);
                  
                  toast({
                    title: "Import dokončen",
                    description: `Úspěšně zpracováno ${importResult.success} školení`,
                  });
                } catch (error: any) {
                  toast({
                    title: "Chyba při importu",
                    description: error.message,
                    variant: "destructive",
                  });
                } finally {
                  setImporting(false);
                  setDuplicates([]);
                }
              }}
            >
              Pokračovat v importu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
