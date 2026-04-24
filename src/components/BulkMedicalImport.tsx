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
import { HEALTH_RISK_FIELDS, HEALTH_RISK_VALUES, type HealthRiskValue, toDbHealthRisks, createEmptyHealthRisks, type HealthRisks } from "@/lib/healthRisks";
import { calculateNextDateFromPeriodDays } from "@/lib/effectivePeriod";
import { medicalExaminationResultOptions } from "@/lib/medicalExaminationResults";
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
  requester?: string;
  long_term_fitness_loss_date?: string;
  _healthRisks?: HealthRisks;
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

// Column name mapping: Czech export names → English import names
const MEDICAL_COLUMN_MAP: Record<string, string> = {
  "Osobní číslo": "employee_number",
  "Os. číslo": "employee_number",
  "Email": "email",
  "Typ prohlídky": "examination_type_name",
  "Provozovna": "facility_code",
  "Datum prohlídky": "last_examination_date",
  "Lékař": "doctor",
  "Zdravotnické zařízení": "medical_facility",
  "Výsledek": "result",
  "Poznámka": "note",
  "Zadavatel": "requester",
  "Jméno": "_employee_name",
  "Kategorie": "_kategorie",
  "Stav": "_stav_export",
  "Platnost do": "_platnost_do",
  "Stav zaměstnance": "_stav_zamestnance",
  "Datum narození": "_datum_narozeni",
  "Věk": "_vek",
  "Středisko": "_stredisko",
  "Periodicita": "_periodicita",
  "Datum pozbytí dlouhodobé způsobilosti": "long_term_fitness_loss_date",
  ...Object.fromEntries(
    HEALTH_RISK_FIELDS.map(field => [`Zdravotní riziko – ${field.label}`, `_hr_${field.key}`])
  ),
};

// Build reverse map: Czech label → DB value for results
const RESULT_LABEL_TO_VALUE: Record<string, string> = {};
for (const opt of medicalExaminationResultOptions) {
  RESULT_LABEL_TO_VALUE[opt.label.toLowerCase()] = opt.value;
}

const resolveResultValue = (raw: string | undefined): string | null => {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  // Already a DB value?
  if (medicalExaminationResultOptions.some(o => o.value === trimmed)) return trimmed;
  // Try Czech label match
  const matched = RESULT_LABEL_TO_VALUE[trimmed.toLowerCase()];
  return matched || trimmed; // pass through if unknown
};

const parseHealthRiskValue = (val: unknown): HealthRiskValue | null => {
  if (val == null || val === "") return null;
  const s = String(val).trim().toUpperCase();
  const normalized = s === "2R" ? "2R" : s;
  if ((HEALTH_RISK_VALUES as readonly string[]).includes(normalized)) return normalized as HealthRiskValue;
  return null;
};

const mapMedicalRowColumns = (row: Record<string, any>): ImportRow => {
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = MEDICAL_COLUMN_MAP[key] || key;
    if (!(mappedKey in mapped) || !mapped[mappedKey]) {
      mapped[mappedKey] = value;
    }
  }

  // Extract health risks from mapped columns
  const healthRisks = createEmptyHealthRisks();
  for (const field of HEALTH_RISK_FIELDS) {
    const hrKey = `_hr_${field.key}`;
    if (mapped[hrKey] != null) {
      healthRisks[field.key] = parseHealthRiskValue(mapped[hrKey]);
    }
  }
  mapped._healthRisks = healthRisks;

  // Resolve result label → DB value
  mapped.result = resolveResultValue(mapped.result);

  return mapped as ImportRow;
};

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
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const canImport = isAdmin || isManager;

  const downloadTemplateXLSX = () => {
    const template = [
      {
        "Os. číslo": "EMP001",
        "Email": "jan.novak@example.com",
        "Typ prohlídky": "Vstupní prohlídka",
        "Provozovna": "qlar-jenec-dc3",
        "Datum prohlídky": "15.01.2024",
        "Lékař": "MUDr. Jan Novák",
        "Zdravotnické zařízení": "Poliklinika Praha",
        "Výsledek": "Způsobilý bez omezení",
        "Poznámka": "Poznámka"
      },
      {
        "Os. číslo": "EMP002",
        "Email": "petr.svoboda@example.com",
        "Typ prohlídky": "Periodická prohlídka",
        "Provozovna": "qlar-jenec-dc3",
        "Datum prohlídky": "20.02.2024",
        "Lékař": "",
        "Zdravotnické zařízení": "",
        "Výsledek": "Způsobilý",
        "Poznámka": ""
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
        "Os. číslo": "EMP001",
        "Email": "jan.novak@example.com",
        "Typ prohlídky": "Vstupní prohlídka",
        "Provozovna": "qlar-jenec-dc3",
        "Datum prohlídky": "15.01.2024",
        "Lékař": "MUDr. Jan Novák",
        "Zdravotnické zařízení": "Poliklinika Praha",
        "Výsledek": "Způsobilý bez omezení",
        "Poznámka": "Poznámka"
      },
      {
        "Os. číslo": "EMP002",
        "Email": "petr.svoboda@example.com",
        "Typ prohlídky": "Periodická prohlídka",
        "Provozovna": "qlar-jenec-dc3",
        "Datum prohlídky": "20.02.2024",
        "Lékař": "",
        "Zdravotnické zařízení": "",
        "Výsledek": "Způsobilý",
        "Poznámka": ""
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
    let rawData: Record<string, any>[];

    if (fileExtension === "csv") {
      rawData = await new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",
          complete: (results) => resolve(results.data as Record<string, any>[]),
          error: (error) => reject(error),
        });
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rawData = XLSX.utils.sheet_to_json(worksheet, { dateNF: 'yyyy-mm-dd' }) as Record<string, any>[];
    } else {
      throw new Error("Nepodporovaný formát souboru. Použijte CSV nebo Excel.");
    }

    // Map Czech column names from exports to English import names
    const mapped = rawData.map(row => mapMedicalRowColumns(row));
    for (const row of mapped) {
      row.last_examination_date = normalizeDate(row.last_examination_date);
      if (row.long_term_fitness_loss_date) {
        row.long_term_fitness_loss_date = normalizeDate(row.long_term_fitness_loss_date);
      }
    }
    return mapped;
  };

  const validateAndPreview = async (data: ImportRow[]) => {
    setParsing(true);
    
    try {
      const validRows: ParsedRow[] = [];
      const errorRows: ParsedRow[] = [];
      const duplicateRows: ParsedRow[] = [];

      const [{ data: employees }, { data: types }, { data: existingExaminations }, { data: facilities }] = await Promise.all([
        supabase.from("employees").select("id, employee_number, email, first_name, last_name").limit(10000),
        supabase.from("medical_examination_types").select("id, name, facility, period_days").limit(10000),
        supabase.from("medical_examinations").select("id, employee_id, examination_type_id, last_examination_date").is("deleted_at", null).limit(50000),
        supabase.from("facilities").select("code, name").limit(10000),
      ]);

      // Build facility lookup maps (code and name → code)
      const facilityByCode = new Map((facilities || []).map(f => [f.code.toLowerCase(), f.code]));
      const facilityByName = new Map((facilities || []).map(f => [f.name.toLowerCase(), f.code]));
      const resolveFacility = (val: string): string | null => {
        const key = val.toLowerCase().trim();
        return facilityByCode.get(key) || facilityByName.get(key) || null;
      };

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

        // Resolve facility code/name to actual code
        const resolvedFacilityCode = resolveFacility(row.facility_code);
        if (!resolvedFacilityCode) {
          parsedRow.status = 'error';
          parsedRow.error = `Provozovna "${row.facility_code}" neexistuje v systému`;
          errorRows.push(parsedRow);
          continue;
        }
        row.facility_code = resolvedFacilityCode;

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
          employee = employees?.find(e => e.employee_number === row.employee_number?.trim());
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
    setImportErrors([]);
    abortRef.current = false;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

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
        const nextDate = calculateNextDateFromPeriodDays(new Date(row.data.last_examination_date), null, row.periodDays || 365);
        const today = new Date();
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status = "valid";
        if (row.data.result === "failed" || row.data.result === "lost_long_term") {
          status = "expired";
        } else if (daysUntil < 0) {
          status = "expired";
        } else if (daysUntil <= 30) {
          status = "warning";
        }

        return {
          facility: row.data.facility_code,
          employee_id: row.employeeId!,
          examination_type_id: row.examinationTypeId!,
          last_examination_date: row.data.last_examination_date,
          next_examination_date: nextDate.toISOString().split("T")[0],
          doctor: row.data.doctor || null,
          medical_facility: row.data.medical_facility || null,
          result: row.data.result || null,
          note: row.data.note || null,
          requester: row.data.requester || null,
          long_term_fitness_loss_date: row.data.long_term_fitness_loss_date || null,
          zdravotni_rizika: row.data._healthRisks ? toDbHealthRisks(row.data._healthRisks) : undefined,
          status,
          is_active: true,
          created_by: user.id,
        };
      });

      try {
        const { error } = await supabase.from("medical_examinations").insert(insertRows);
        if (error) throw error;
        inserted += batch.length;
      } catch (error: any) {
        console.error("Batch insert error:", error);
        for (const row of batch) {
          if (abortRef.current) break;

          const nextDate = calculateNextDateFromPeriodDays(new Date(row.data.last_examination_date), null, row.periodDays || 365);
          const today = new Date();
          const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          let status = "valid";
          if (row.data.result === "failed" || row.data.result === "lost_long_term") {
            status = "expired";
          } else if (daysUntil < 0) {
            status = "expired";
          } else if (daysUntil <= 30) {
            status = "warning";
          }

          const singleRow = {
            facility: row.data.facility_code,
            employee_id: row.employeeId!,
            examination_type_id: row.examinationTypeId!,
            last_examination_date: row.data.last_examination_date,
            next_examination_date: nextDate.toISOString().split("T")[0],
            doctor: row.data.doctor || null,
            medical_facility: row.data.medical_facility || null,
            result: row.data.result || null,
            note: row.data.note || null,
            requester: row.data.requester || null,
            long_term_fitness_loss_date: row.data.long_term_fitness_loss_date || null,
            zdravotni_rizika: row.data._healthRisks ? toDbHealthRisks(row.data._healthRisks) : undefined,
            status,
            is_active: true,
            created_by: user.id,
          };

          const { error: rowError } = await supabase.from("medical_examinations").insert([singleRow]);
          if (rowError) {
            failed++;
            errors.push(`Řádek ${row.rowNumber} (${row.employeeName || '?'}): ${rowError?.message || 'Neznámá chyba při vkládání'}`);
          } else {
            inserted++;
          }
        }
      }
      setImportProgress(Math.round((Math.min(i + BATCH_SIZE, toInsert.length) / total) * 100));
    }

    // Row-by-row UPDATE
    for (let i = 0; i < toUpdate.length; i++) {
      if (abortRef.current) break;
      const row = toUpdate[i];
      try {
        const nextDate = calculateNextDateFromPeriodDays(new Date(row.data.last_examination_date), null, row.periodDays || 365);
        const today = new Date();
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        let status = "valid";
        if (row.data.result === "failed" || row.data.result === "lost_long_term") {
          status = "expired";
        } else if (daysUntil < 0) {
          status = "expired";
        } else if (daysUntil <= 30) {
          status = "warning";
        }

        const updateData: Record<string, any> = {
            last_examination_date: row.data.last_examination_date,
            next_examination_date: nextDate.toISOString().split("T")[0],
            doctor: row.data.doctor || null,
            medical_facility: row.data.medical_facility || null,
            result: row.data.result || null,
            note: row.data.note || null,
            requester: row.data.requester || null,
            long_term_fitness_loss_date: row.data.long_term_fitness_loss_date || null,
            status,
            updated_at: new Date().toISOString(),
        };
        if (row.data._healthRisks) {
            updateData.zdravotni_rizika = toDbHealthRisks(row.data._healthRisks);
        }

        const { error } = await supabase
          .from("medical_examinations")
          .update(updateData)
          .eq("id", row.existingExaminationId!);

        if (error) throw error;
        updated++;
      } catch (error: any) {
        console.error("Import error:", error);
        failed++;
        errors.push(`Řádek ${row.rowNumber} (${row.employeeName || '?'}): ${error?.message || 'Neznámá chyba při aktualizaci'}`);
      }
      setImportProgress(Math.round(((toInsert.length + i + 1) / total) * 100));
    }

    if (duplicateAction === 'skip') {
      skipped = preview.duplicateRows.length;
    }

    setImportResult({ inserted, updated, skipped, failed });
    setImportErrors(errors);
    setImporting(false);
    
    toast({
      title: failed > 0 ? "Import dokončen s chybami" : "Import dokončen",
      description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Selhalo: ${failed}`,
      variant: failed > 0 ? "destructive" : "default",
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
            { name: "Osobní číslo nebo Email", description: "identifikace zaměstnance (alespoň jedno)" },
            { name: "Typ prohlídky", description: "název typu prohlídky (musí existovat v systému)" },
            { name: "Provozovna", description: "kód provozovny (musí existovat v systému)" },
            { name: "Datum prohlídky", description: "datum prohlídky (DD.MM.YYYY nebo YYYY-MM-DD)" },
          ]}
          optionalColumns={[
            { name: "Lékař", description: "jméno lékaře" },
            { name: "Zdravotnické zařízení", description: "název zdravotnického zařízení" },
            { name: "Výsledek", description: "výsledek prohlídky" },
            { name: "Poznámka", description: "poznámka" },
          ]}
          duplicateInfo="Stejný zaměstnanec + typ prohlídky = aktualizuje se existující záznam (overwrite)."
        />

        <div className="flex gap-2">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="medical-import-file"
            disabled={parsing}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('medical-import-file')?.click()}
            disabled={parsing}
            title="Podporované formáty: XLSX, XLS, CSV (středník, UTF-8)"
          >
            <Upload className="w-4 h-4 mr-2" />
            {parsing ? "Zpracovávám..." : "Vybrat soubor"}
          </Button>
        </div>

        <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh]">
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

                {/* Summary bar - consistent with Employee/Equipment */}
                <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-medium">{preview.validRows.length} nových</span>
                  </div>
                  {preview.duplicateRows.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <span className="font-medium">{preview.duplicateRows.length} duplicitních</span>
                    </div>
                  )}
                  {preview.errorRows.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <span className="font-medium">{preview.errorRows.length} s chybami</span>
                    </div>
                  )}
                </div>

                {/* Duplicate strategy - button toggle */}
                {preview.duplicateRows.length > 0 && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <span className="text-sm font-medium">Duplicitní záznamy:</span>
                    <Button
                      variant={duplicateAction === 'overwrite' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDuplicateAction('overwrite')}
                    >
                      Přepsat ({preview.duplicateRows.length})
                    </Button>
                    <Button
                      variant={duplicateAction === 'skip' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setDuplicateAction('skip')}
                    >
                      Přeskočit
                    </Button>
                  </div>
                )}

                {/* Error rows info */}
                {preview.errorRows.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {preview.errorRows.length} řádků obsahuje chyby a nebudou importovány.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Import progress */}
                {importing && (
                  <div className="space-y-2">
                    <Progress value={importProgress} />
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Importuji... {importProgress}%
                      </p>
                      <Button variant="destructive" size="sm" onClick={() => { abortRef.current = true; }}>
                        <StopCircle className="w-4 h-4 mr-1" />
                        Zastavit
                      </Button>
                    </div>
                  </div>
                )}

                {/* Import result - badge style */}
                {importResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex flex-wrap gap-4">
                        <Badge variant="default">Vloženo: {importResult.inserted}</Badge>
                        <Badge variant="outline">Aktualizováno: {importResult.updated}</Badge>
                        <Badge variant="secondary">Přeskočeno: {importResult.skipped}</Badge>
                        {importResult.failed > 0 && (
                          <Badge variant="destructive">Selhalo: {importResult.failed}</Badge>
                        )}
                      </div>
                      {importErrors.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-medium text-destructive">Detail chyb:</p>
                          <ul className="text-sm text-destructive list-disc list-inside max-h-[150px] overflow-y-auto">
                            {importErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Data table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[50vh] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Ř.</TableHead>
                          <TableHead>Zaměstnanec</TableHead>
                          <TableHead>Typ prohlídky</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Lékař</TableHead>
                          <TableHead className="w-24">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...preview.validRows, ...preview.errorRows, ...preview.duplicateRows]
                          .sort((a, b) => a.rowNumber - b.rowNumber)
                          .map((row) => (
                            <TableRow
                              key={row.rowNumber}
                              className={
                                row.status === 'error' ? "bg-destructive/5" :
                                row.status === 'duplicate' ? "bg-amber-50 dark:bg-amber-950/20" : ""
                              }
                            >
                              <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                              <TableCell>{row.employeeName || row.data.employee_number || row.data.email}</TableCell>
                              <TableCell>{row.examinationTypeName || row.data.examination_type_name}</TableCell>
                              <TableCell>{row.data.last_examination_date}</TableCell>
                              <TableCell className="text-sm">{row.data.doctor || '-'}</TableCell>
                              <TableCell>
                                {row.status === 'error' ? (
                                  <Badge variant="destructive">
                                    <X className="w-3 h-3 mr-1" />
                                    Chyba
                                  </Badge>
                                ) : row.status === 'duplicate' ? (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Duplikát
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                                    <Check className="w-3 h-3 mr-1" />
                                    Nový
                                  </Badge>
                                )}
                                {row.status === 'error' && row.error && (
                                  <div className="text-xs text-destructive mt-1">
                                    {row.error}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t">
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)} disabled={importing}>
                {importResult ? "Zavřít" : "Zrušit"}
              </Button>
              {!importResult && preview && (
                <Button 
                  onClick={executeImport} 
                  disabled={importing || (preview.validRows.length === 0 && (duplicateAction === 'skip' || preview.duplicateRows.length === 0))}
                >
                  {importing ? "Importuji..." : `Importovat (${duplicateAction === 'overwrite' ? preview.validRows.length + preview.duplicateRows.length : preview.validRows.length})`}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
