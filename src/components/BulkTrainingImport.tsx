import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, FileDown, Copy, Shield, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ImportRow {
  employee_number?: string;
  email?: string;
  training_type_name: string;
  facility_code: string;
  last_training_date: string;
  trainer?: string;
  company?: string;
  note?: string;
}

interface ParsedRow {
  rowNumber: number;
  data: ImportRow;
  status: 'valid' | 'error' | 'duplicate';
  error?: string;
  employeeId?: string;
  employeeName?: string;
  trainingTypeId?: string;
  periodDays?: number;
  existingTrainingId?: string;
  existingTrainingDate?: string;
}

interface ImportPreview {
  totalRows: number;
  validRows: ParsedRow[];
  errorRows: ParsedRow[];
  duplicateRows: ParsedRow[];
}

type DuplicateAction = 'skip' | 'overwrite' | 'import';

const REQUIRED_COLUMNS = ['training_type_name', 'facility_code', 'last_training_date'];
const OPTIONAL_COLUMNS = ['employee_number', 'email', 'trainer', 'company', 'note'];

export const BulkTrainingImport = () => {
  const { toast } = useToast();
  const { isAdmin, isManager, user, profile } = useAuth();
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('skip');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);

  // Only admin and manager can import
  const canImport = isAdmin || isManager;

  const downloadTemplateXLSX = () => {
    const template = [
      {
        employee_number: "EMP001",
        email: "jan.novak@example.com",
        training_type_name: "BOZP",
        facility_code: "qlar-jenec-dc3",
        last_training_date: "2024-01-15",
        trainer: "Jan Novák",
        company: "Bezpečnostní akademie",
        note: "Poznámka k školení"
      },
      {
        employee_number: "EMP002",
        email: "petr.svoboda@example.com",
        training_type_name: "ATEX",
        facility_code: "qlar-jenec-dc3",
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
      description: "Excel šablona pro import školení byla stažena.",
    });
  };

  const downloadTemplateCSV = () => {
    const template = [
      {
        employee_number: "EMP001",
        email: "jan.novak@example.com",
        training_type_name: "BOZP",
        facility_code: "qlar-jenec-dc3",
        last_training_date: "2024-01-15",
        trainer: "Jan Novák",
        company: "Bezpečnostní akademie",
        note: "Poznámka k školení"
      },
      {
        employee_number: "EMP002",
        email: "petr.svoboda@example.com",
        training_type_name: "ATEX",
        facility_code: "qlar-jenec-dc3",
        last_training_date: "2024-02-20",
        trainer: "",
        company: "",
        note: ""
      }
    ];

    const csv = Papa.unparse(template, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sablona_import_skoleni.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Šablona stažena",
      description: "CSV šablona pro import školení byla stažena (delimiter: semicolon, kódování: UTF-8 BOM).",
    });
  };

  const parseFile = async (file: File): Promise<ImportRow[]> => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "", // Auto-detect delimiter
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

  const validateAndPreview = async (data: ImportRow[]) => {
    setParsing(true);
    
    try {
      const validRows: ParsedRow[] = [];
      const errorRows: ParsedRow[] = [];
      const duplicateRows: ParsedRow[] = [];

      // Fetch all employees for matching
      const { data: employees } = await supabase
        .from("employees")
        .select("id, employee_number, email, first_name, last_name");

      // Fetch all training types
      const { data: trainingTypes } = await supabase
        .from("training_types")
        .select("id, name, facility, period_days");

      // Fetch existing trainings for duplicate detection
      const { data: existingTrainings } = await supabase
        .from("trainings")
        .select("id, employee_id, training_type_id, last_training_date")
        .is("deleted_at", null);

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // +2 for header and 1-based index

        const parsedRow: ParsedRow = {
          rowNumber,
          data: row,
          status: 'valid',
        };

        // Validate required fields
        if (!row.training_type_name?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí název typu školení";
          errorRows.push(parsedRow);
          continue;
        }

        if (!row.facility_code?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí kód provozovny";
          errorRows.push(parsedRow);
          continue;
        }

        if (!row.last_training_date?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí datum posledního školení";
          errorRows.push(parsedRow);
          continue;
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(row.last_training_date)) {
          parsedRow.status = 'error';
          parsedRow.error = "Datum musí být ve formátu YYYY-MM-DD";
          errorRows.push(parsedRow);
          continue;
        }

        // Validate employee - primary by employee_number, fallback by email
        if (!row.employee_number?.trim() && !row.email?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí osobní číslo i email - alespoň jedno musí být vyplněno";
          errorRows.push(parsedRow);
          continue;
        }

        let employee = null;
        
        // Try employee_number first
        if (row.employee_number?.trim()) {
          employee = employees?.find(e => e.employee_number === row.employee_number.trim());
        }
        
        // Fallback to email if not found
        if (!employee && row.email?.trim()) {
          employee = employees?.find(e => e.email?.toLowerCase() === row.email?.toLowerCase().trim());
        }

        if (!employee) {
          parsedRow.status = 'error';
          parsedRow.error = `Zaměstnanec nenalezen (osobní číslo: ${row.employee_number || 'N/A'}, email: ${row.email || 'N/A'})`;
          errorRows.push(parsedRow);
          continue;
        }

        parsedRow.employeeId = employee.id;
        parsedRow.employeeName = `${employee.first_name} ${employee.last_name}`;

        // Validate training type
        const trainingType = trainingTypes?.find(
          t => t.name.toLowerCase() === row.training_type_name.toLowerCase().trim() && 
               t.facility === row.facility_code.trim()
        );

        if (!trainingType) {
          parsedRow.status = 'error';
          parsedRow.error = `Typ školení "${row.training_type_name}" pro provozovnu "${row.facility_code}" nebyl nalezen`;
          errorRows.push(parsedRow);
          continue;
        }

        parsedRow.trainingTypeId = trainingType.id;
        parsedRow.periodDays = trainingType.period_days;

        // Check for duplicates (same employee + training type + training date)
        const existingTraining = existingTrainings?.find(
          t => t.employee_id === employee.id && 
               t.training_type_id === trainingType.id
        );

        if (existingTraining) {
          parsedRow.status = 'duplicate';
          parsedRow.existingTrainingId = existingTraining.id;
          parsedRow.existingTrainingDate = existingTraining.last_training_date;
          duplicateRows.push(parsedRow);
          continue;
        }

        validRows.push(parsedRow);
      }

      setPreview({
        totalRows: data.length,
        validRows,
        errorRows,
        duplicateRows,
      });
      setShowPreviewDialog(true);

    } catch (error: any) {
      toast({
        title: "Chyba při zpracování",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
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

    // Validate file type
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

    try {
      const data = await parseFile(file);
      
      if (data.length === 0) {
        toast({
          title: "Prázdný soubor",
          description: "Soubor neobsahuje žádná data.",
          variant: "destructive",
        });
        event.target.value = '';
        return;
      }

      await validateAndPreview(data);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání souboru",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      event.target.value = '';
    }
  };

  const executeImport = async () => {
    if (!preview || !user) return;

    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const rowsToProcess = [...preview.validRows];
    
    // Handle duplicates based on action
    if (duplicateAction === 'overwrite' || duplicateAction === 'import') {
      rowsToProcess.push(...preview.duplicateRows);
    } else {
      skipped = preview.duplicateRows.length;
    }

    const totalRows = rowsToProcess.length;

    try {
      for (let i = 0; i < rowsToProcess.length; i++) {
        const row = rowsToProcess[i];
        
        try {
          // Calculate next training date
          const lastDate = new Date(row.data.last_training_date);
          const nextDate = new Date(lastDate);
          nextDate.setDate(nextDate.getDate() + (row.periodDays || 365));

          if (row.status === 'duplicate' && duplicateAction === 'overwrite' && row.existingTrainingId) {
            // Update existing training
            const { error } = await supabase
              .from("trainings")
              .update({
                facility: row.data.facility_code,
                last_training_date: row.data.last_training_date,
                next_training_date: nextDate.toISOString().split('T')[0],
                trainer: row.data.trainer || null,
                company: row.data.company || null,
                note: row.data.note || null,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.existingTrainingId);

            if (error) throw error;
            updated++;
          } else {
            // Insert new training
            const { error } = await supabase
              .from("trainings")
              .insert({
                employee_id: row.employeeId!,
                training_type_id: row.trainingTypeId!,
                facility: row.data.facility_code,
                last_training_date: row.data.last_training_date,
                next_training_date: nextDate.toISOString().split('T')[0],
                trainer: row.data.trainer || null,
                company: row.data.company || null,
                note: row.data.note || null,
                created_by: user.id,
                status: 'valid',
                is_active: true,
              });

            if (error) throw error;
            inserted++;
          }
        } catch (error: any) {
          console.error(`Error processing row ${row.rowNumber}:`, error);
          failed++;
        }

        setImportProgress(Math.round(((i + 1) / totalRows) * 100));
      }

      // Log to audit log
      await supabase.from("audit_logs").insert({
        table_name: "trainings",
        record_id: crypto.randomUUID(),
        action: "BULK_IMPORT",
        new_data: {
          inserted,
          updated,
          skipped,
          failed,
          total_rows: preview.totalRows,
          duplicate_action: duplicateAction,
        },
        user_id: user.id,
        user_email: profile?.email || user.email,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : null,
        changed_fields: ['bulk_import'],
      });

      setImportResult({ inserted, updated, skipped, failed });

      toast({
        title: "Import dokončen",
        description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Selhalo: ${failed}`,
      });

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

  const exportErrors = (format: 'xlsx' | 'csv') => {
    if (!preview || preview.errorRows.length === 0) {
      toast({
        title: "Žádné chyby",
        description: "Nejsou k dispozici žádné chybné záznamy k exportu.",
      });
      return;
    }

    const errorData = preview.errorRows.map(item => ({
      radek: item.rowNumber,
      chyba: item.error,
      employee_number: item.data.employee_number || '',
      email: item.data.email || '',
      training_type_name: item.data.training_type_name,
      facility_code: item.data.facility_code,
      last_training_date: item.data.last_training_date,
      trainer: item.data.trainer || '',
      company: item.data.company || '',
      note: item.data.note || '',
    }));

    const timestamp = new Date().toISOString().split('T')[0];

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(errorData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Chyby");
      XLSX.writeFile(wb, `chyby_import_skoleni_${timestamp}.xlsx`);
    } else {
      const csv = Papa.unparse(errorData, { delimiter: ";" });
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `chyby_import_skoleni_${timestamp}.csv`;
      link.click();
    }

    toast({
      title: "Export dokončen",
      description: `Exportováno ${errorData.length} chybných záznamů.`,
    });
  };

  const closePreview = () => {
    setShowPreviewDialog(false);
    setPreview(null);
    setImportResult(null);
    setImportProgress(0);
  };

  if (!canImport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-destructive" />
            Přístup odepřen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Hromadný import školení mohou provádět pouze uživatelé s rolí <strong>Admin</strong> nebo <strong>Manager</strong>.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Hromadný import školení
          </CardTitle>
          <CardDescription>
            Importujte školení ze souboru CSV nebo Excel (XLSX)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">Povinné sloupce:</p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li><strong>employee_number</strong> nebo <strong>email</strong> – identifikace zaměstnance (alespoň jedno povinné)</li>
                  <li><strong>training_type_name</strong> – název typu školení (musí existovat v systému)</li>
                  <li><strong>facility_code</strong> – kód provozovny (např. qlar-jenec-dc3)</li>
                  <li><strong>last_training_date</strong> – datum posledního školení ve formátu YYYY-MM-DD</li>
                </ul>
                <p className="font-semibold mt-3">Nepovinné sloupce:</p>
                <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                  <li><strong>trainer</strong> – jméno školitele</li>
                  <li><strong>company</strong> – školící firma</li>
                  <li><strong>note</strong> – poznámka</li>
                </ul>
                <p className="text-sm mt-3">
                  <strong>Párování zaměstnanců:</strong> Primárně podle osobního čísla, pokud nenalezeno, fallback na email.
                </p>
                <p className="text-sm mt-2">
                  <strong>Duplicita:</strong> Stejný zaměstnanec + typ školení = duplicita. Můžete přeskočit, přepsat nebo importovat jako nový.
                </p>
                <p className="text-sm mt-2 text-muted-foreground">
                  <strong>CSV formát:</strong> Delimiter: středník (;), kódování: UTF-8 s BOM
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex flex-wrap gap-4">
            <div className="flex gap-2">
              <Button onClick={downloadTemplateXLSX} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Šablona XLSX
              </Button>
              <Button onClick={downloadTemplateCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Šablona CSV
              </Button>
            </div>

            <div className="flex-1">
              <label htmlFor="file-upload" className="cursor-pointer">
                <Button asChild disabled={parsing}>
                  <span>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    {parsing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Zpracovávám...
                      </>
                    ) : (
                      "Vybrat soubor pro import"
                    )}
                  </span>
                </Button>
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                disabled={parsing}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Náhled importu
            </DialogTitle>
            <DialogDescription>
              Zkontrolujte data před importem. Můžete exportovat chybné záznamy pro opravu.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{preview.totalRows}</div>
                  <div className="text-sm text-muted-foreground">Celkem řádků</div>
                </Card>
                <Card className="p-4 border-primary/50 bg-primary/10">
                  <div className="text-2xl font-bold text-primary">{preview.validRows.length}</div>
                  <div className="text-sm text-muted-foreground">Validních</div>
                </Card>
                <Card className="p-4 border-accent/50 bg-accent/10">
                  <div className="text-2xl font-bold text-accent-foreground">{preview.duplicateRows.length}</div>
                  <div className="text-sm text-muted-foreground">Duplicitních</div>
                </Card>
                <Card className="p-4 border-destructive/50 bg-destructive/10">
                  <div className="text-2xl font-bold text-destructive">{preview.errorRows.length}</div>
                  <div className="text-sm text-muted-foreground">Chybných</div>
                </Card>
              </div>

              {/* Duplicate handling */}
              {preview.duplicateRows.length > 0 && (
                <div className="space-y-3">
                  <Label className="font-semibold">Jak naložit s duplicitami?</Label>
                  <RadioGroup value={duplicateAction} onValueChange={(value: DuplicateAction) => setDuplicateAction(value)}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="skip" id="skip" />
                        <Label htmlFor="skip" className="cursor-pointer flex-1">
                          <span className="font-medium">Přeskočit</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            – duplicity nebudou importovány
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="overwrite" id="overwrite" />
                        <Label htmlFor="overwrite" className="cursor-pointer flex-1">
                          <span className="font-medium">Přepsat</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            – aktualizovat existující záznamy
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="import" id="import" />
                        <Label htmlFor="import" className="cursor-pointer flex-1">
                          <span className="font-medium">Importovat jako nové</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            – vytvořit duplicitní záznamy
                          </span>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Error rows */}
              {preview.errorRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="font-semibold text-destructive">Chybné záznamy ({preview.errorRows.length})</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportErrors('xlsx')}>
                        <FileDown className="w-4 h-4 mr-1" />
                        Export XLSX
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportErrors('csv')}>
                        <FileDown className="w-4 h-4 mr-1" />
                        Export CSV
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Řádek</TableHead>
                          <TableHead>Chyba</TableHead>
                          <TableHead>Zaměstnanec</TableHead>
                          <TableHead>Typ školení</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.errorRows.slice(0, 10).map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell className="font-mono">{row.rowNumber}</TableCell>
                            <TableCell className="text-destructive text-sm">{row.error}</TableCell>
                            <TableCell className="text-sm">
                              {row.data.employee_number || row.data.email || '-'}
                            </TableCell>
                            <TableCell className="text-sm">{row.data.training_type_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {preview.errorRows.length > 10 && (
                      <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                        ... a dalších {preview.errorRows.length - 10} chyb
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Import progress */}
              {importing && (
                <div className="space-y-2">
                  <Progress value={importProgress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Importuji... {importProgress}%
                  </p>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex flex-wrap gap-4">
                      <Badge variant="default">
                        Vloženo: {importResult.inserted}
                      </Badge>
                      <Badge variant="outline">
                        Aktualizováno: {importResult.updated}
                      </Badge>
                      <Badge variant="secondary">
                        Přeskočeno: {importResult.skipped}
                      </Badge>
                      {importResult.failed > 0 && (
                        <Badge variant="destructive">
                          Selhalo: {importResult.failed}
                        </Badge>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePreview}>
              {importResult ? "Zavřít" : "Zrušit"}
            </Button>
            {!importResult && preview && (preview.validRows.length > 0 || (preview.duplicateRows.length > 0 && duplicateAction !== 'skip')) && (
              <Button onClick={executeImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importuji...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Spustit import
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
