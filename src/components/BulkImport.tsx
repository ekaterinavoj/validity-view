import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";
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

interface ImportResult {
  success: number;
  errors: Array<{ row: number; error: string; data: any }>;
  warnings: Array<{ row: number; warning: string }>;
}

export function BulkImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);

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

  const processImport = async (rows: ImportRow[]) => {
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
    };

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

        // 4. Calculate next training date
        const lastDate = new Date(row.datum_posledniho_skoleni);
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + parseInt(row.perioda_dny));

        // 5. Create training
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
          status: "valid", // Will be updated by trigger or manually
        });

        if (trainingError) throw trainingError;

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
            <p className="text-sm text-muted-foreground mb-4">
              Nahrajte vyplněný CSV nebo Excel soubor.
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
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          {result.errors.length} chyb
                        </Badge>
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
    </div>
  );
}
