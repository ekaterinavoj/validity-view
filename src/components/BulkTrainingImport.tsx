import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ImportRow {
  employee_number: string;
  training_type_name: string;
  facility: string;
  last_training_date: string;
  trainer?: string;
  company?: string;
  note?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export const BulkTrainingImport = () => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const downloadTemplate = () => {
    const template = [
      {
        employee_number: "EMP001",
        training_type_name: "Bezpečnost práce",
        facility: "Brno",
        last_training_date: "2024-01-15",
        trainer: "Jan Novák",
        company: "Bezpečnostní akademie",
        note: "Poznámka k školení"
      },
      {
        employee_number: "EMP002",
        training_type_name: "První pomoc",
        facility: "Praha",
        last_training_date: "2024-02-20",
        trainer: "",
        company: "",
        note: ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Školení");
    XLSX.writeFile(wb, "sablona_import_skoleni.xlsx");

    toast({
      title: "Šablona stažena",
      description: "Šablona pro import školení byla stažena.",
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validace velikosti souboru
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      toast({
        title: "Soubor je příliš velký",
        description: "Maximální velikost souboru je 5MB.",
        variant: "destructive",
      });
      event.target.value = '';
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
      event.target.value = '';
      return;
    }

    setImporting(true);
    setResult(null);

    try {
      let data: ImportRow[] = [];

      if (fileExtension === "csv") {
        // Zpracování CSV
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            data = results.data as ImportRow[];
            
            if (data.length === 0) {
              toast({
                title: "Prázdný soubor",
                description: "Soubor neobsahuje žádná data.",
                variant: "destructive",
              });
              setImporting(false);
              return;
            }
            
            await processImport(data);
          },
          error: (error) => {
            throw new Error(`Chyba při čtení CSV: ${error.message}`);
          },
        });
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        // Zpracování Excel
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const workbook = XLSX.read(e.target?.result, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(worksheet) as ImportRow[];
            
            if (data.length === 0) {
              toast({
                title: "Prázdný soubor",
                description: "Soubor neobsahuje žádná data.",
                variant: "destructive",
              });
              setImporting(false);
              return;
            }
            
            await processImport(data);
          } catch (error: any) {
            toast({
              title: "Chyba při čtení souboru",
              description: error.message,
              variant: "destructive",
            });
            setImporting(false);
          }
        };
        reader.onerror = () => {
          toast({
            title: "Chyba při načítání souboru",
            description: "Nepodařilo se načíst soubor.",
            variant: "destructive",
          });
          setImporting(false);
        };
        reader.readAsBinaryString(file);
      }
    } catch (error: any) {
      toast({
        title: "Chyba při načítání souboru",
        description: error.message,
        variant: "destructive",
      });
      setImporting(false);
    } finally {
      event.target.value = '';
    }
  };

  const processImport = async (data: ImportRow[]) => {
    const errors: string[] = [];
    let successCount = 0;
    let failedCount = 0;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Uživatel není přihlášen");
      }

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNum = i + 2; // +2 kvůli hlavičce a indexování od 1

        try {
          // Validace povinných polí
          if (!row.employee_number || !row.training_type_name || !row.facility || !row.last_training_date) {
            errors.push(`Řádek ${rowNum}: Chybí povinné pole`);
            failedCount++;
            continue;
          }

          // Najít zaměstnance podle čísla
          const { data: employees, error: empError } = await supabase
            .from("employees")
            .select("id")
            .eq("employee_number", row.employee_number)
            .limit(1);

          if (empError) throw empError;
          if (!employees || employees.length === 0) {
            errors.push(`Řádek ${rowNum}: Zaměstnanec ${row.employee_number} nebyl nalezen`);
            failedCount++;
            continue;
          }

          // Najít typ školení podle názvu a facility
          const { data: trainingTypes, error: typeError } = await supabase
            .from("training_types")
            .select("id, period_days")
            .eq("name", row.training_type_name)
            .eq("facility", row.facility)
            .limit(1);

          if (typeError) throw typeError;
          if (!trainingTypes || trainingTypes.length === 0) {
            errors.push(`Řádek ${rowNum}: Typ školení "${row.training_type_name}" pro ${row.facility} nebyl nalezen`);
            failedCount++;
            continue;
          }

          // Vypočítat next_training_date
          const lastDate = new Date(row.last_training_date);
          const nextDate = new Date(lastDate);
          nextDate.setDate(nextDate.getDate() + trainingTypes[0].period_days);

          // Vložit školení
          const { error: insertError } = await supabase
            .from("trainings")
            .insert({
              employee_id: employees[0].id,
              training_type_id: trainingTypes[0].id,
              facility: row.facility,
              last_training_date: row.last_training_date,
              next_training_date: nextDate.toISOString().split('T')[0],
              trainer: row.trainer || null,
              company: row.company || null,
              note: row.note || null,
              created_by: user.id,
              status: 'valid',
              is_active: true,
            });

          if (insertError) throw insertError;
          successCount++;
        } catch (error: any) {
          errors.push(`Řádek ${rowNum}: ${error.message}`);
          failedCount++;
        }
      }

      setResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10), // Zobrazit max 10 chyb
      });

      if (successCount > 0) {
        toast({
          title: "Import dokončen",
          description: `Úspěšně importováno ${successCount} školení.`,
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Hromadný import školení
          </CardTitle>
          <CardDescription>
            Importujte školení ze souboru CSV nebo Excel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Formát souboru:</p>
                <p className="text-sm">Soubor musí obsahovat následující sloupce (v tomto pořadí):</p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li><strong>employee_number</strong> - Číslo zaměstnance (povinné)</li>
                  <li><strong>training_type_name</strong> - Název typu školení (povinné)</li>
                  <li><strong>facility</strong> - Provozovna (povinné)</li>
                  <li><strong>last_training_date</strong> - Datum posledního školení ve formátu YYYY-MM-DD (povinné)</li>
                  <li><strong>trainer</strong> - Školitel (nepovinné)</li>
                  <li><strong>company</strong> - Firma (nepovinné)</li>
                  <li><strong>note</strong> - Poznámka (nepovinné)</li>
                </ul>
                <p className="text-sm mt-3">
                  <strong>Důležité:</strong> Zaměstnanec i typ školení musí již existovat v systému. 
                  Datum dalšího školení se vypočítá automaticky podle periody typu školení.
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  <strong>Limity:</strong> Maximální velikost souboru je 5MB. Podporované formáty: CSV, XLSX, XLS.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button onClick={downloadTemplate} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Stáhnout vzorovou šablonu
            </Button>

            <div className="flex-1">
              <label htmlFor="file-upload" className="cursor-pointer">
                <Button asChild disabled={importing}>
                  <span>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {importing ? "Importuji..." : "Vybrat soubor"}
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
            </div>
          </div>

          {result && (
            <Alert variant={result.failed > 0 ? "destructive" : "default"}>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Výsledek importu:</p>
                  <ul className="text-sm space-y-1">
                    <li>✅ Úspěšně importováno: {result.success}</li>
                    <li>❌ Selhalo: {result.failed}</li>
                  </ul>
                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold text-sm mb-1">Chyby:</p>
                      <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                        {result.errors.map((error, idx) => (
                          <li key={idx} className="text-destructive">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
