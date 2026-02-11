import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, FileDown, Loader2, Check, X, AlertTriangle, StopCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { ImportDescription } from "@/components/ImportDescription";
import { downloadCSVTemplate } from "@/lib/csvExport";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface ImportRow {
  employee_number?: string;
  email?: string;
  examination_type_name: string;
  facility_code: string;
  last_examination_date: string;
  doctor?: string;
  medical_facility?: string;
  result?: string;
  note?: string;
}

interface ParsedRow {
  rowNumber: number;
  data: ImportRow;
  status: 'valid' | 'error' | 'duplicate';
  error?: string;
  warning?: string;
  employeeId?: string;
  employeeName?: string;
  examinationTypeId?: string;
  examinationTypeName?: string;
  periodDays?: number;
  existingExaminationId?: string;
  existingExaminationDate?: string;
}

interface ExaminationType {
  id: string;
  name: string;
  facility: string;
  period_days: number;
}

interface ImportPreview {
  totalRows: number;
  validRows: ParsedRow[];
  errorRows: ParsedRow[];
  duplicateRows: ParsedRow[];
}

type DuplicateAction = 'skip' | 'overwrite';

const REQUIRED_COLUMNS = ['examination_type_name', 'facility_code', 'last_examination_date'];

export const BulkMedicalImport = () => {
  const { toast } = useToast();
  const { isAdmin, isManager, user } = useAuth();
  const [importing, setImporting] = useState(false);
  const abortRef = useRef(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('overwrite');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);

  const canImport = isAdmin || isManager;

  const downloadTemplateXLSX = () => {
    const template = [
      {
        employee_number: "EMP001",
        email: "jan.novak@example.com",
        examination_type_name: "Vstupní prohlídka",
        facility_code: "qlar-jenec-dc3",
        last_examination_date: "2024-01-15",
        doctor: "MUDr. Jan Novák",
        medical_facility: "Poliklinika Praha",
        result: "Způsobilý bez omezení",
        note: "Poznámka"
      },
      {
        employee_number: "EMP002",
        email: "petr.svoboda@example.com",
        examination_type_name: "Periodická prohlídka",
        facility_code: "qlar-jenec-dc3",
        last_examination_date: "2024-02-20",
        doctor: "",
        medical_facility: "",
        result: "Způsobilý",
        note: ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Prohlídky");
    XLSX.writeFile(wb, "sablona_import_prohlidky.xlsx");

    toast({
      title: "Šablona stažena",
      description: "Excel šablona pro import prohlídek byla stažena.",
    });
  };

  const downloadTemplateCSV = () => {
    const template = [
      {
        employee_number: "EMP001",
        email: "jan.novak@example.com",
        examination_type_name: "Vstupní prohlídka",
        facility_code: "qlar-jenec-dc3",
        last_examination_date: "2024-01-15",
        doctor: "MUDr. Jan Novák",
        medical_facility: "Poliklinika Praha",
        result: "Způsobilý bez omezení",
        note: "Poznámka"
      },
      {
        employee_number: "EMP002",
        email: "petr.svoboda@example.com",
        examination_type_name: "Periodická prohlídka",
        facility_code: "qlar-jenec-dc3",
        last_examination_date: "2024-02-20",
        doctor: "",
        medical_facility: "",
        result: "Způsobilý",
        note: ""
      }
    ];

    const csv = Papa.unparse(template, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "sablona_import_prohlidky.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Šablona stažena",
      description: "CSV šablona pro import prohlídek byla stažena.",
    });
  };

  // Normalize any date value to YYYY-MM-DD
  const normalizeDate = (val: any): string => {
    if (val == null) return '';
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return String(val);
      return val.toISOString().split('T')[0];
    }
    if (typeof val === 'number') {
      const date = new Date((val - 25569) * 86400 * 1000);
      if (isNaN(date.getTime())) return String(val);
      return date.toISOString().split('T')[0];
    }
    const s = String(val).trim();
    const czMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (czMatch) {
      const [, d, m, y] = czMatch;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return s;
  };

  const parseFile = async (file: File): Promise<ImportRow[]> => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();

    if (fileExtension === "csv") {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",
          complete: (results) => resolve(results.data as ImportRow[]),
          error: (error) => reject(error),
        });
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { dateNF: 'yyyy-mm-dd' }) as ImportRow[];
      for (const row of jsonData) {
        row.last_examination_date = normalizeDate(row.last_examination_date);
      }
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

      const { data: employees } = await supabase
        .from("employees")
        .select("id, employee_number, email, first_name, last_name")
        .limit(10000);

      const { data: types } = await supabase
        .from("medical_examination_types")
        .select("id, name, facility, period_days")
        .limit(10000);

      const { data: existingExaminations } = await supabase
        .from("medical_examinations")
        .select("id, employee_id, examination_type_id, last_examination_date")
        .is("deleted_at", null)
        .limit(50000);

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2;

        const parsedRow: ParsedRow = {
          rowNumber,
          data: row,
          status: 'valid',
        };

        if (!row.examination_type_name?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí název typu prohlídky";
          errorRows.push(parsedRow);
          continue;
        }

        if (!row.facility_code?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí kód provozovny";
          errorRows.push(parsedRow);
          continue;
        }

        const dateStr = String(row.last_examination_date || '').trim();
        if (!dateStr) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí datum prohlídky";
          errorRows.push(parsedRow);
          continue;
        }

        const normalizedDateVal = normalizeDate(dateStr);
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoDateRegex.test(normalizedDateVal)) {
          parsedRow.status = 'error';
          parsedRow.error = `Datum "${dateStr}" není platné (použijte YYYY-MM-DD nebo DD.MM.YYYY)`;
          errorRows.push(parsedRow);
          continue;
        }
        const [y, m, d] = normalizedDateVal.split('-').map(Number);
        const testDate = new Date(y, m - 1, d);
        if (testDate.getFullYear() !== y || testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
          parsedRow.status = 'error';
          parsedRow.error = `Datum "${dateStr}" není platné (použijte YYYY-MM-DD nebo DD.MM.YYYY)`;
          errorRows.push(parsedRow);
          continue;
        }
        row.last_examination_date = normalizedDateVal;

        if (!row.employee_number?.trim() && !row.email?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí osobní číslo i email";
          errorRows.push(parsedRow);
          continue;
        }

        let employee = null;
        if (row.employee_number?.trim()) {
          employee = employees?.find(e => e.employee_number === row.employee_number.trim());
        }
        if (!employee && row.email?.trim()) {
          employee = employees?.find(e => e.email?.toLowerCase() === row.email?.toLowerCase().trim());
        }

        if (!employee) {
          parsedRow.status = 'error';
          parsedRow.error = `Zaměstnanec nenalezen`;
          errorRows.push(parsedRow);
          continue;
        }

        parsedRow.employeeId = employee.id;
        parsedRow.employeeName = `${employee.first_name} ${employee.last_name}`;

        const examinationType = types?.find(
          t => t.name.toLowerCase() === row.examination_type_name.toLowerCase().trim() && 
               t.facility === row.facility_code.trim()
        );

        if (!examinationType) {
          parsedRow.status = 'error';
          parsedRow.error = `Typ prohlídky "${row.examination_type_name}" pro provozovnu "${row.facility_code}" nebyl nalezen`;
          errorRows.push(parsedRow);
          continue;
        }

        parsedRow.examinationTypeId = examinationType.id;
        parsedRow.examinationTypeName = examinationType.name;
        parsedRow.periodDays = examinationType.period_days;

        const existingExamination = existingExaminations?.find(
          e => e.employee_id === employee.id && e.examination_type_id === examinationType.id
        );

        if (existingExamination) {
          parsedRow.status = 'duplicate';
          parsedRow.existingExaminationId = existingExamination.id;
          parsedRow.existingExaminationDate = existingExamination.last_examination_date;
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
        title: "Chyba při validaci",
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

    try {
      const data = await parseFile(file);
      await validateAndPreview(data);
    } catch (error: any) {
      toast({
        title: "Chyba při čtení souboru",
        description: error.message,
        variant: "destructive",
      });
    }
    
    event.target.value = "";
  };

  const executeImport = async () => {
    if (!preview || !user) return;

    setImporting(true);
    setImportProgress(0);
    abortRef.current = false;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    const rowsToProcess = [
      ...preview.validRows,
      ...(duplicateAction === 'overwrite' ? preview.duplicateRows : []),
    ];

    const total = rowsToProcess.length;

    // Separate inserts from updates
    const toInsert = rowsToProcess.filter(r => !r.existingExaminationId);
    const toUpdate = rowsToProcess.filter(r => !!r.existingExaminationId);

    // Batch INSERT (50 at a time)
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      if (abortRef.current) break;
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const insertRows = batch.map(row => {
        const nextDate = new Date(row.data.last_examination_date);
        nextDate.setDate(nextDate.getDate() + (row.periodDays || 365));
        const today = new Date();
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status = "valid";
        if (daysUntil < 0) status = "expired";
        else if (daysUntil <= 30) status = "warning";

        return {
          facility: row.data.facility_code,
          employee_id: row.employeeId,
          examination_type_id: row.examinationTypeId,
          last_examination_date: row.data.last_examination_date,
          next_examination_date: nextDate.toISOString().split("T")[0],
          doctor: row.data.doctor || null,
          medical_facility: row.data.medical_facility || null,
          result: row.data.result || null,
          note: row.data.note || null,
          status,
          is_active: true,
          created_by: user.id,
        };
      });

      try {
        const { error } = await supabase.from("medical_examinations").insert(insertRows);
        if (error) throw error;
        inserted += batch.length;
      } catch (error) {
        console.error("Batch insert error:", error);
        failed += batch.length;
      }
      setImportProgress(Math.round((Math.min(i + BATCH_SIZE, toInsert.length) / total) * 100));
    }

    // Row-by-row UPDATE
    for (let i = 0; i < toUpdate.length; i++) {
      if (abortRef.current) break;
      const row = toUpdate[i];
      try {
        const nextDate = new Date(row.data.last_examination_date);
        nextDate.setDate(nextDate.getDate() + (row.periodDays || 365));
        const today = new Date();
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status = "valid";
        if (daysUntil < 0) status = "expired";
        else if (daysUntil <= 30) status = "warning";

        const { error } = await supabase
          .from("medical_examinations")
          .update({
            last_examination_date: row.data.last_examination_date,
            next_examination_date: nextDate.toISOString().split("T")[0],
            doctor: row.data.doctor || null,
            medical_facility: row.data.medical_facility || null,
            result: row.data.result || null,
            note: row.data.note || null,
            status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.existingExaminationId!);

        if (error) throw error;
        updated++;
      } catch (error) {
        console.error("Import error:", error);
        failed++;
      }
      setImportProgress(Math.round(((toInsert.length + i + 1) / total) * 100));
    }

    if (duplicateAction === 'skip') {
      skipped = preview.duplicateRows.length;
    }

    setImportResult({ inserted, updated, skipped, failed });
    setImporting(false);
    
    toast({
      title: "Import dokončen",
      description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Selhalo: ${failed}`,
    });
  };

  if (!canImport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hromadný import PLP</CardTitle>
          <CardDescription>Nemáte oprávnění k importu dat.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Hromadný import lékařských prohlídek
        </CardTitle>
        <CardDescription>
          Nahrajte CSV nebo Excel soubor s prohlídkami
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ImportDescription
          requiredColumns={[
            { name: "employee_number nebo email", description: "identifikace zaměstnance (alespoň jedno)" },
            { name: "examination_type_name", description: "název typu prohlídky (musí existovat v systému)" },
            { name: "facility_code", description: "kód provozovny (např. qlar-jenec-dc3)" },
            { name: "last_examination_date", description: "datum prohlídky ve formátu YYYY-MM-DD" },
          ]}
          optionalColumns={[
            { name: "doctor", description: "jméno lékaře" },
            { name: "medical_facility", description: "zdravotnické zařízení" },
            { name: "result", description: "výsledek prohlídky" },
            { name: "note", description: "poznámka" },
          ]}
          duplicateInfo="Stejný zaměstnanec + typ prohlídky = aktualizuje se existující záznam (overwrite)."
        />

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplateXLSX}>
            <Download className="w-4 h-4 mr-2" />
            Stáhnout šablonu XLSX
          </Button>
          <Button variant="outline" size="sm" onClick={downloadTemplateCSV}>
            <FileDown className="w-4 h-4 mr-2" />
            Stáhnout šablonu CSV
          </Button>
        </div>

        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="medical-import-file"
            disabled={parsing}
          />
          <label htmlFor="medical-import-file" className="cursor-pointer">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {parsing ? "Zpracovávám..." : "Klikněte nebo přetáhněte soubor"}
            </p>
          </label>
        </div>

        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Náhled importu prohlídek</DialogTitle>
              <DialogDescription>
                Zkontrolujte data před importem
              </DialogDescription>
            </DialogHeader>

          {preview && (
              <div className="space-y-4">
                {/* Large dataset warning */}
                {preview.totalRows >= 1000 && (
                  <Alert className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      Velký dataset ({preview.totalRows} řádků). Import může trvat delší dobu.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex gap-4">
                  <Badge variant="secondary">Celkem: {preview.totalRows}</Badge>
                  <Badge variant="default" className="bg-green-500">Validní: {preview.validRows.length}</Badge>
                  <Badge variant="destructive">Chyby: {preview.errorRows.length}</Badge>
                  <Badge variant="outline">Duplicity: {preview.duplicateRows.length}</Badge>
                </div>

                {preview.duplicateRows.length > 0 && (
                  <div className="space-y-2">
                    <Label>Jak naložit s duplicitami?</Label>
                    <RadioGroup value={duplicateAction} onValueChange={(v) => setDuplicateAction(v as DuplicateAction)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="overwrite" id="overwrite" />
                        <Label htmlFor="overwrite">Přepsat existující záznamy</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id="skip" />
                        <Label htmlFor="skip">Přeskočit duplicity</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {preview.errorRows.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {preview.errorRows.length} řádků obsahuje chyby a nebudou importovány.
                    </AlertDescription>
                  </Alert>
                )}

                {importing && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">{importProgress}%</p>
                      <Button variant="destructive" size="sm" onClick={() => { abortRef.current = true; }}>
                        <StopCircle className="w-4 h-4 mr-1" />
                        Zastavit
                      </Button>
                    </div>
                  </div>
                )}

                {importResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Import dokončen: {importResult.inserted} vloženo, {importResult.updated} aktualizováno, {importResult.skipped} přeskočeno, {importResult.failed} selhalo.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Řádek</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Zaměstnanec</TableHead>
                        <TableHead>Typ prohlídky</TableHead>
                        <TableHead>Datum</TableHead>
                        <TableHead>Poznámka</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...preview.validRows, ...preview.errorRows, ...preview.duplicateRows]
                        .sort((a, b) => a.rowNumber - b.rowNumber)
                        .slice(0, 50)
                        .map((row) => (
                          <TableRow key={row.rowNumber}>
                            <TableCell>{row.rowNumber}</TableCell>
                            <TableCell>
                              {row.status === 'valid' && <Check className="w-4 h-4 text-green-500" />}
                              {row.status === 'error' && <X className="w-4 h-4 text-red-500" />}
                              {row.status === 'duplicate' && <AlertCircle className="w-4 h-4 text-yellow-500" />}
                            </TableCell>
                            <TableCell>{row.employeeName || row.data.employee_number || row.data.email}</TableCell>
                            <TableCell>{row.examinationTypeName || row.data.examination_type_name}</TableCell>
                            <TableCell>{row.data.last_examination_date}</TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {row.error || row.warning || (row.status === 'duplicate' ? 'Existující záznam' : '')}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                Zrušit
              </Button>
              <Button 
                onClick={executeImport} 
                disabled={importing || !preview || (preview.validRows.length === 0 && (duplicateAction === 'skip' || preview.duplicateRows.length === 0))}
              >
                {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Importovat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
