import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, FileDown, Shield, Eye, Loader2, Settings2, Check, X, AlertTriangle, StopCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ImportDescription } from "@/components/ImportDescription";
import { downloadCSVTemplate } from "@/lib/csvExport";
import { buildExportFilename, CSV_IMPORT_TOOLTIP } from "@/lib/exportFilename";
import { calculateNextDateFromPeriodDays } from "@/lib/effectivePeriod";
import Papa from "papaparse";
// XLSX removed — bulk import accepts only CSV

interface ImportRow {
  employee_number?: string;
  email?: string;
  training_type_name: string;
  facility_code: string;
  last_training_date: string;
  trainer?: string;
  company?: string;
  note?: string;
  requester?: string;
  result?: string;
}

interface ParsedRow {
  rowNumber: number;
  data: ImportRow;
  status: 'valid' | 'error' | 'duplicate' | 'auto_matched' | 'suggestion';
  error?: string;
  warning?: string;
  employeeId?: string;
  employeeName?: string;
  trainingTypeId?: string;
  trainingTypeName?: string;
  matchedTrainingTypeName?: string;
  matchConfidence?: number;
  periodDays?: number;
  existingTrainingId?: string;
  existingTrainingDate?: string;
  isCrossFacility?: boolean;
  manualOverrideTypeId?: string;
  isApproved?: boolean;
}

interface TrainingType {
  id: string;
  name: string;
  facility: string;
  period_days: number;
}

interface FuzzyMatch {
  item: TrainingType;
  score: number;
  isCrossFacility: boolean;
}

// Column name mapping: Czech export names → English import names
const TRAINING_COLUMN_MAP: Record<string, string> = {
  "Osobní číslo": "employee_number",
  "Os. číslo": "employee_number",
  "Email": "email",
  "Typ školení": "training_type_name",
  "Provozovna": "facility_code",
  "Datum školení": "last_training_date",
  "Školitel": "trainer",
  "Firma": "company",
  "Zadavatel": "requester",
  "Výsledek": "result",
  "Poznámka": "note",
  "Jméno": "_employee_name", // ignored but mapped to avoid collision
  "Stav": "_stav_export",
  "Školení platné do": "_platnost_do",
  "Středisko": "_stredisko",
  "Periodicita": "_periodicita",
};

// Build reverse map: Czech label → DB value for training results
const TRAINING_RESULT_LABELS: Record<string, string> = {
  "splněno": "passed",
  "splněno s výhradami": "passed_with_reservations",
  "nesplněno": "failed",
};

const resolveTrainingResult = (raw: string | undefined): string | null => {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  // Already a DB value?
  if (["passed", "passed_with_reservations", "failed"].includes(trimmed)) return trimmed;
  // Try Czech label match
  const matched = TRAINING_RESULT_LABELS[trimmed.toLowerCase()];
  return matched || null;
};

const mapTrainingRowColumns = (row: Record<string, any>): ImportRow => {
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = TRAINING_COLUMN_MAP[key] || key;
    if (!(mappedKey in mapped) || !mapped[mappedKey]) {
      mapped[mappedKey] = value;
    }
  }
  return mapped as ImportRow;
};

// Remove diacritics from string
const removeDiacritics = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Normalize name for comparison
const normalizeName = (name: string): string => {
  let normalized = name.toLowerCase().trim();
  normalized = removeDiacritics(normalized);
  // Remove years (4-digit numbers)
  normalized = normalized.replace(/\b\d{4}\b/g, "");
  // Remove common words
  const commonWords = ["skoleni", "training", "kurz", "course", "zakladni", "basic", "pokrocile", "advanced", "opakované", "opakovane", "refresher"];
  commonWords.forEach(word => {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, "gi"), "");
  });
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
};

// Levenshtein distance for fuzzy matching
const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
};

// Calculate similarity score (0-100%) using normalized names
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);
  
  if (s1 === s2) return 100;
  
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(s1, s2);
  return Math.round((1 - distance / maxLen) * 100);
};

// Find best fuzzy match for training type with cross-facility support
const findBestTrainingTypeMatch = (
  searchName: string, 
  facilityCode: string,
  trainingTypes: TrainingType[] | null,
  minSimilarity: number = 70
): FuzzyMatch | null => {
  if (!trainingTypes || trainingTypes.length === 0) return null;
  
  // Filter by facility first
  const facilityTypes = trainingTypes.filter(t => t.facility === facilityCode);
  
  let bestMatch: FuzzyMatch | null = null;
  
  // Search in same facility first
  for (const type of facilityTypes) {
    const similarity = calculateSimilarity(searchName, type.name);
    
    if (similarity >= minSimilarity) {
      if (!bestMatch || similarity > bestMatch.score) {
        bestMatch = {
          item: type,
          score: similarity,
          isCrossFacility: false
        };
      }
    }
  }
  
  // If no match in facility, search all types (cross-facility)
  if (!bestMatch) {
    for (const type of trainingTypes) {
      if (type.facility === facilityCode) continue; // Skip already searched
      
      const similarity = calculateSimilarity(searchName, type.name);
      
      if (similarity >= minSimilarity) {
        if (!bestMatch || similarity > bestMatch.score) {
          bestMatch = {
            item: type,
            score: similarity,
            isCrossFacility: true
          };
        }
      }
    }
  }
  
  return bestMatch;
};

interface ImportPreview {
  totalRows: number;
  validRows: ParsedRow[];
  errorRows: ParsedRow[];
  duplicateRows: ParsedRow[];
  autoMatchedRows: ParsedRow[];
  suggestionRows: ParsedRow[];
}

type DuplicateAction = 'skip' | 'overwrite';

interface ImportSettings {
  minSimilarityThreshold: number;
  autoMatchThreshold: number;
}

const DEFAULT_SETTINGS: ImportSettings = {
  minSimilarityThreshold: 70,
  autoMatchThreshold: 90,
};

const REQUIRED_COLUMNS = ['training_type_name', 'facility_code', 'last_training_date'];
const OPTIONAL_COLUMNS = ['employee_number', 'email', 'trainer', 'company', 'note'];

export const BulkTrainingImport = () => {
  const { toast } = useToast();
  const { isAdmin, isManager, user, profile } = useAuth();
  const [importing, setImporting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('overwrite');
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const abortRef = useRef(false);

  // Only admin and manager can import
  const canImport = isAdmin || isManager;

  // Template download was removed — round-trip is via existing data export.

  const downloadTemplateCSV = () => {
    const template = [
      {
        "Osobní číslo": "EMP001",
        "Email": "jan.novak@example.com",
        "Typ školení": "BOZP",
        "Provozovna": "qlar-jenec-dc3",
        "Datum školení": "15.01.2024",
        "Školitel": "Jan Novák",
        "Firma": "Bezpečnostní akademie",
        "Poznámka": "Poznámka k školení"
      },
      {
        "Osobní číslo": "EMP002",
        "Email": "petr.svoboda@example.com",
        "Typ školení": "ATEX",
        "Provozovna": "qlar-jenec-dc3",
        "Datum školení": "20.02.2024",
        "Školitel": "",
        "Firma": "",
        "Poznámka": ""
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

  // Normalize any date value (Date object, Excel serial, DD.MM.YYYY, string) to YYYY-MM-DD
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
    // Handle DD.MM.YYYY or D.M.YYYY Czech format
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
          delimiter: "", // Auto-detect delimiter
          complete: (results) => resolve(results.data as Record<string, any>[]),
          error: (error) => reject(error),
        });
      });
    } else {
      throw new Error("Nepodporovaný formát souboru. Použijte CSV.");
    }

    // Header validation against required columns (with Czech ↔ English aliases)
    const headers = rawData.length > 0 ? Object.keys(rawData[0]) : [];
    const { checkRequiredHeaders } = await import("@/lib/importValidation");
    const headerCheck = checkRequiredHeaders(headers, {
      "Typ školení": ["Typ školení", "training_type_name"],
      "Provozovna": ["Provozovna", "facility_code"],
      "Datum školení": ["Datum školení", "last_training_date"],
    });
    if (!headerCheck.ok) {
      throw new Error(`Chybí povinné sloupce: ${headerCheck.missing.join(", ")}. Stáhněte si vzorovou šablonu.`);
    }

    // Map Czech column names from exports to English import names
    const mapped = rawData.map(row => mapTrainingRowColumns(row));
    // Normalize date fields that may come as Date objects from Excel
    for (const row of mapped) {
      row.last_training_date = normalizeDate(row.last_training_date);
    }
    return mapped;
  };

  const validateAndPreview = async (data: ImportRow[]) => {
    setParsing(true);
    
    try {
      const validRows: ParsedRow[] = [];
      const errorRows: ParsedRow[] = [];
      const duplicateRows: ParsedRow[] = [];
      const autoMatchedRows: ParsedRow[] = [];
      const suggestionRows: ParsedRow[] = [];

      // Fetch all employees for matching (override default 1000 row limit)
      const [{ data: employees }, { data: types }, { data: facilities }] = await Promise.all([
        supabase.from("employees").select("id, employee_number, email, first_name, last_name").limit(10000),
        supabase.from("training_types").select("id, name, facility, period_days").limit(10000),
        supabase.from("facilities").select("code, name").limit(10000),
      ]);

      setTrainingTypes(types || []);

      // Build facility lookup maps (code and name → code)
      const facilityByCode = new Map((facilities || []).map(f => [f.code.toLowerCase(), f.code]));
      const facilityByName = new Map((facilities || []).map(f => [f.name.toLowerCase(), f.code]));
      const resolveFacility = (val: string): string | null => {
        const key = val.toLowerCase().trim();
        return facilityByCode.get(key) || facilityByName.get(key) || null;
      };

      // Fetch existing trainings for duplicate detection
      const { data: existingTrainings } = await supabase
        .from("trainings")
        .select("id, employee_id, training_type_id, last_training_date")
        .is("deleted_at", null)
        .limit(50000);

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

        // Resolve facility code/name to actual code
        const resolvedFacilityCode = resolveFacility(row.facility_code);
        if (!resolvedFacilityCode) {
          parsedRow.status = 'error';
          parsedRow.error = `Provozovna "${row.facility_code}" neexistuje v systému`;
          errorRows.push(parsedRow);
          continue;
        }
        row.facility_code = resolvedFacilityCode;

        const dateStr = String(row.last_training_date || '').trim();
        if (!dateStr) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí datum posledního školení";
          errorRows.push(parsedRow);
          continue;
        }

        // Validate and normalize date - support YYYY-MM-DD and DD.MM.YYYY
        const normalizedDateVal = normalizeDate(dateStr);
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!isoDateRegex.test(normalizedDateVal)) {
          parsedRow.status = 'error';
          parsedRow.error = `Datum "${dateStr}" není platné (použijte YYYY-MM-DD nebo DD.MM.YYYY)`;
          errorRows.push(parsedRow);
          continue;
        }
        // Verify it's a real calendar date
        const [y, m, d] = normalizedDateVal.split('-').map(Number);
        const testDate = new Date(y, m - 1, d);
        if (testDate.getFullYear() !== y || testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
          parsedRow.status = 'error';
          parsedRow.error = `Datum "${dateStr}" není platné (použijte YYYY-MM-DD nebo DD.MM.YYYY)`;
          errorRows.push(parsedRow);
          continue;
        }
        // Store normalized date back
        row.last_training_date = normalizedDateVal;

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
          employee = employees?.find(e => e.employee_number === row.employee_number?.trim());
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

        // Validate training type - exact match first (case-insensitive, normalized)
        let trainingType = types?.find(
          t => normalizeName(t.name) === normalizeName(row.training_type_name) && 
               t.facility === row.facility_code.trim()
        );

        let matchType: 'exact' | 'auto' | 'suggestion' | 'none' = 'exact';
        let matchConfidence = 100;
        let isCrossFacility = false;

        // If no exact match, try fuzzy matching
        if (!trainingType) {
          const fuzzyMatch = findBestTrainingTypeMatch(
            row.training_type_name,
            row.facility_code.trim(),
            types,
            settings.minSimilarityThreshold
          );

          if (fuzzyMatch) {
            trainingType = fuzzyMatch.item;
            matchConfidence = fuzzyMatch.score;
            isCrossFacility = fuzzyMatch.isCrossFacility;
            parsedRow.matchedTrainingTypeName = trainingType.name;
            parsedRow.matchConfidence = matchConfidence;
            parsedRow.isCrossFacility = isCrossFacility;

            // Determine match type based on thresholds
            // ≥90% AND same facility = auto match
            // Cross-facility = always suggestion (never auto)
            // 70-89% = suggestion
            if (matchConfidence >= settings.autoMatchThreshold && !isCrossFacility) {
              matchType = 'auto';
              parsedRow.warning = `Auto-match: "${row.training_type_name}" → "${trainingType.name}" (${matchConfidence}%)`;
            } else {
              matchType = 'suggestion';
              const crossNote = isCrossFacility ? ` [cross-facility: ${trainingType.facility}]` : '';
              parsedRow.warning = `Návrh: "${row.training_type_name}" → "${trainingType.name}" (${matchConfidence}%)${crossNote}`;
            }
          } else {
            matchType = 'none';
          }
        }

        if (!trainingType) {
          parsedRow.status = 'error';
          parsedRow.error = `Typ školení "${row.training_type_name}" pro provozovnu "${row.facility_code}" nebyl nalezen (min. shoda ${settings.minSimilarityThreshold}%)`;
          errorRows.push(parsedRow);
          continue;
        }

        parsedRow.trainingTypeId = trainingType.id;
        parsedRow.trainingTypeName = trainingType.name;
        parsedRow.periodDays = trainingType.period_days;

        // Check for duplicates (same employee + training type)
        const existingTraining = existingTrainings?.find(
          t => t.employee_id === employee.id && 
               t.training_type_id === trainingType!.id
        );

        if (existingTraining) {
          parsedRow.status = 'duplicate';
          parsedRow.existingTrainingId = existingTraining.id;
          parsedRow.existingTrainingDate = existingTraining.last_training_date;
          duplicateRows.push(parsedRow);
          continue;
        }

        // Categorize by match type
        if (matchType === 'auto') {
          parsedRow.status = 'auto_matched';
          autoMatchedRows.push(parsedRow);
        } else if (matchType === 'suggestion') {
          parsedRow.status = 'suggestion';
          parsedRow.isApproved = false; // Needs approval
          suggestionRows.push(parsedRow);
        } else {
          validRows.push(parsedRow);
        }
      }

      setPreview({
        totalRows: data.length,
        validRows,
        errorRows,
        duplicateRows,
        autoMatchedRows,
        suggestionRows,
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

  // Handle suggestion approval/rejection
  const handleSuggestionApproval = (rowNumber: number, approved: boolean) => {
    if (!preview) return;
    
    setPreview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        suggestionRows: prev.suggestionRows.map(row => 
          row.rowNumber === rowNumber 
            ? { ...row, isApproved: approved }
            : row
        )
      };
    });
  };

  // Handle manual override of training type for suggestion
  const handleManualOverride = (rowNumber: number, newTypeId: string) => {
    if (!preview) return;
    
    const newType = trainingTypes.find(t => t.id === newTypeId);
    if (!newType) return;
    
    setPreview(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        suggestionRows: prev.suggestionRows.map(row => {
          if (row.rowNumber === rowNumber) {
            return {
              ...row,
              manualOverrideTypeId: newTypeId,
              trainingTypeId: newTypeId,
              trainingTypeName: newType.name,
              matchedTrainingTypeName: newType.name,
              periodDays: newType.period_days,
              matchConfidence: 100,
              isCrossFacility: newType.facility !== row.data.facility_code,
              isApproved: true,
              warning: `Manuálně vybráno: "${newType.name}"`
            };
          }
          return row;
        })
      };
    });
  };

  const executeImport = async () => {
    if (!preview || !user) return;

    setImporting(true);
    setImportProgress(0);
    setImportResult(null);
    setImportErrors([]);
    abortRef.current = false;

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];

    // Include valid rows, auto-matched rows, and approved suggestions
    const rowsToProcess = [
      ...preview.validRows, 
      ...preview.autoMatchedRows,
      ...preview.suggestionRows.filter(r => r.isApproved)
    ];
    
    // Handle duplicates - always overwrite since that's the confirmed behavior
    if (duplicateAction === 'overwrite') {
      rowsToProcess.push(...preview.duplicateRows);
    } else {
      skipped = preview.duplicateRows.length;
    }

    // Count skipped suggestions
    skipped += preview.suggestionRows.filter(r => !r.isApproved).length;

    const totalRows = rowsToProcess.length;

    try {
      // Separate inserts from updates
      const toInsert = rowsToProcess.filter(r => !(r.status === 'duplicate' && r.existingTrainingId));
      const toUpdate = rowsToProcess.filter(r => r.status === 'duplicate' && r.existingTrainingId);

      // Batch INSERT (50 at a time)
      const BATCH_SIZE = 50;
      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        if (abortRef.current) break;
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const insertRows = batch.map(row => {
          const nextDate = calculateNextDateFromPeriodDays(new Date(row.data.last_training_date), null, row.periodDays || 365);
          const resolvedResult = resolveTrainingResult(row.data.result);
          return {
            employee_id: row.employeeId!,
            training_type_id: row.trainingTypeId!,
            facility: row.data.facility_code,
            last_training_date: row.data.last_training_date,
            next_training_date: nextDate.toISOString().split('T')[0],
            trainer: row.data.trainer || null,
            company: row.data.company || null,
            requester: row.data.requester || null,
            result: resolvedResult || 'passed',
            note: row.data.note || null,
            created_by: user.id,
            status: 'valid',
            is_active: true,
          };
        });

        try {
          const { error } = await supabase.from("trainings").insert(insertRows);
          if (error) throw error;
          inserted += batch.length;
        } catch (error: any) {
          console.error(`Batch insert error:`, error);
          for (const row of batch) {
            if (abortRef.current) break;

            const nextDate = calculateNextDateFromPeriodDays(new Date(row.data.last_training_date), null, row.periodDays || 365);

            const singleRow = {
              employee_id: row.employeeId!,
              training_type_id: row.trainingTypeId!,
              facility: row.data.facility_code,
              last_training_date: row.data.last_training_date,
              next_training_date: nextDate.toISOString().split('T')[0],
              trainer: row.data.trainer || null,
              company: row.data.company || null,
              requester: row.data.requester || null,
              result: resolveTrainingResult(row.data.result) || 'passed',
              note: row.data.note || null,
              created_by: user.id,
              status: 'valid',
              is_active: true,
            };

            const { error: rowError } = await supabase.from("trainings").insert([singleRow]);
            if (rowError) {
              failed++;
              errors.push(`Řádek ${row.rowNumber} (${row.employeeName || row.data.employee_number || row.data.email || '?'}): ${rowError.message || 'Neznámá chyba při vkládání'}`);
            } else {
              inserted++;
            }
          }
        }

        setImportProgress(Math.round(((Math.min(i + BATCH_SIZE, toInsert.length) + toUpdate.length * 0) / totalRows) * 100));
      }

      // Row-by-row UPDATE (need individual IDs)
      for (let i = 0; i < toUpdate.length; i++) {
        if (abortRef.current) break;
        const row = toUpdate[i];
        try {
          const nextDate = calculateNextDateFromPeriodDays(new Date(row.data.last_training_date), null, row.periodDays || 365);

          const { error } = await supabase
            .from("trainings")
            .update({
              facility: row.data.facility_code,
              last_training_date: row.data.last_training_date,
              next_training_date: nextDate.toISOString().split('T')[0],
              trainer: row.data.trainer || null,
              company: row.data.company || null,
              requester: row.data.requester || null,
              result: resolveTrainingResult(row.data.result) || undefined,
              note: row.data.note || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.existingTrainingId!);

          if (error) throw error;
          updated++;
        } catch (error: any) {
          console.error(`Error updating row ${row.rowNumber}:`, error);
          failed++;
          errors.push(`Řádek ${row.rowNumber} (${row.employeeName || '?'}): ${error.message || 'Neznámá chyba při aktualizaci'}`);
        }

        setImportProgress(Math.round(((toInsert.length + i + 1) / totalRows) * 100));
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
          auto_matched: preview.autoMatchedRows.length,
          suggestions_approved: preview.suggestionRows.filter(r => r.isApproved).length,
        },
        user_id: user.id,
        user_email: profile?.email || user.email,
        user_name: profile ? `${profile.first_name} ${profile.last_name}` : null,
        changed_fields: ['bulk_import'],
      });

      setImportResult({ inserted, updated, skipped, failed });
      setImportErrors(errors);

      toast({
        title: failed > 0 ? "Import dokončen s chybami" : "Import dokončen",
        description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Selhalo: ${failed}`,
        variant: failed > 0 ? "destructive" : "default",
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

  const exportErrors = () => {
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

    const csv = Papa.unparse(errorData, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = buildExportFilename("skoleni-chyby");
    link.click();

    toast({
      title: "Export dokončen",
      description: `Exportováno ${errorData.length} chybných záznamů.`,
    });
  };

  const closePreview = () => {
    setShowPreviewDialog(false);
    setPreview(null);
    setImportResult(null);
    setImportErrors([]);
    setImportProgress(0);
  };

  // Calculate how many rows will be imported
  const getImportableRowsCount = () => {
    if (!preview) return 0;
    let count = preview.validRows.length + preview.autoMatchedRows.length;
    count += preview.suggestionRows.filter(r => r.isApproved).length;
    if (duplicateAction === 'overwrite') {
      count += preview.duplicateRows.length;
    }
    return count;
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
          {/* Settings Collapsible */}
          <Collapsible open={showSettings} onOpenChange={setShowSettings}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="mb-4">
                <Settings2 className="w-4 h-4 mr-2" />
                Nastavení fuzzy matchingu
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="p-4 mb-4 bg-muted/50">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Minimální práh shody (pro návrhy)</Label>
                      <Badge variant="outline">{settings.minSimilarityThreshold}%</Badge>
                    </div>
                    <Slider
                      value={[settings.minSimilarityThreshold]}
                      onValueChange={([value]) => setSettings(s => ({ ...s, minSimilarityThreshold: value }))}
                      min={70}
                      max={95}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Pod tímto prahem bude záznam označen jako chyba.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Práh pro automatické párování</Label>
                      <Badge variant="outline">{settings.autoMatchThreshold}%</Badge>
                    </div>
                    <Slider
                      value={[settings.autoMatchThreshold]}
                      onValueChange={([value]) => setSettings(s => ({ ...s, autoMatchThreshold: Math.max(value, s.minSimilarityThreshold) }))}
                      min={settings.minSimilarityThreshold}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Při shodě ≥{settings.autoMatchThreshold}% (a stejná provozovna) se záznam spáruje automaticky. 
                      Mezi {settings.minSimilarityThreshold}% a {settings.autoMatchThreshold - 1}% se zobrazí jako návrh k potvrzení.
                    </p>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      <strong>Cross-facility párování:</strong> Pokud není nalezena shoda v provozovně, hledá se napříč všemi provozovnami. 
                      Cross-facility shody jsou vždy zobrazeny jako návrhy (nikdy automaticky).
                    </AlertDescription>
                  </Alert>
                </div>
              </Card>
            </CollapsibleContent>
          </Collapsible>

          <ImportDescription
            requiredColumns={[
              { name: "Osobní číslo nebo Email", description: "identifikace zaměstnance (alespoň jedno povinné)" },
              { name: "Typ školení", description: "název typu školení (musí existovat v systému)" },
              { name: "Provozovna", description: "kód provozovny (musí existovat v systému)" },
              { name: "Datum školení", description: "datum posledního školení (DD.MM.YYYY nebo YYYY-MM-DD)" },
            ]}
            optionalColumns={[
              { name: "Školitel", description: "jméno školitele" },
              { name: "Firma", description: "školící firma" },
              { name: "Poznámka", description: "poznámka" },
            ]}
            duplicateInfo={`Stejný zaměstnanec + typ školení = aktualizuje se existující záznam. Fuzzy matching: ≥${settings.autoMatchThreshold}% = auto, ${settings.minSimilarityThreshold}-${settings.autoMatchThreshold - 1}% = návrh, <${settings.minSimilarityThreshold}% = chyba.`}
          />

          <div className="flex flex-wrap gap-4">

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
                accept=".csv"
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Náhled importu
            </DialogTitle>
            <DialogDescription>
              Zkontrolujte data před importem. Schvalte nebo upravte návrhy párování.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4">
              {/* Large dataset warning */}
              {preview.totalRows >= 1000 && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-700 dark:text-amber-300">
                    Velký dataset ({preview.totalRows} řádků). Import může trvat delší dobu. Můžete jej kdykoli zastavit tlačítkem „Zastavit".
                  </AlertDescription>
                </Alert>
              )}
              {/* Summary bar - consistent style */}
              <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">Celkem: {preview.totalRows}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium">{preview.validRows.length} přesná shoda</span>
                </div>
                {preview.autoMatchedRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span className="font-medium">{preview.autoMatchedRows.length} auto-match</span>
                  </div>
                )}
                {preview.suggestionRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="font-medium">{preview.suggestionRows.length} návrhů</span>
                  </div>
                )}
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

              {/* Auto-matched rows info */}
              {preview.autoMatchedRows.length > 0 && (
                <Alert className="border-primary/50 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription>
                    <p className="font-semibold text-primary">Auto-match ({preview.autoMatchedRows.length} záznamů)</p>
                    <p className="text-sm text-muted-foreground">
                      Tyto záznamy byly automaticky spárovány (≥{settings.autoMatchThreshold}% shoda, stejná provozovna).
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {/* Suggestion rows - need approval */}
              {preview.suggestionRows.length > 0 && (
                <div className="space-y-2">
                  <Label className="font-semibold text-accent-foreground">Návrhy k potvrzení ({preview.suggestionRows.length})</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Schvalte nebo upravte párování. Neschválené záznamy nebudou importovány.
                  </p>
                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Řádek</TableHead>
                          <TableHead>Zaměstnanec</TableHead>
                          <TableHead>Původní název</TableHead>
                          <TableHead>Spárovat s</TableHead>
                          <TableHead className="w-20">Shoda</TableHead>
                          <TableHead className="w-32">Akce</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.suggestionRows.map((row) => (
                          <TableRow key={row.rowNumber} className={row.isApproved ? "bg-primary/5" : "bg-muted/50"}>
                            <TableCell className="font-mono">{row.rowNumber}</TableCell>
                            <TableCell className="text-sm">{row.employeeName}</TableCell>
                            <TableCell className="text-sm">{row.data.training_type_name}</TableCell>
                            <TableCell>
                              <Select
                                value={row.manualOverrideTypeId || row.trainingTypeId}
                                onValueChange={(value) => handleManualOverride(row.rowNumber, value)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {trainingTypes.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                      {type.name} ({type.facility})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Badge variant={row.matchConfidence && row.matchConfidence >= 90 ? "default" : "secondary"}>
                                  {row.matchConfidence}%
                                </Badge>
                                {row.isCrossFacility && (
                                  <Badge variant="outline" className="text-xs">CF</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={row.isApproved ? "default" : "outline"}
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleSuggestionApproval(row.rowNumber, true)}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={row.isApproved === false ? "destructive" : "outline"}
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleSuggestionApproval(row.rowNumber, false)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreview(prev => prev ? {
                          ...prev,
                          suggestionRows: prev.suggestionRows.map(r => ({ ...r, isApproved: true }))
                        } : prev);
                      }}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Schválit vše
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setPreview(prev => prev ? {
                          ...prev,
                          suggestionRows: prev.suggestionRows.map(r => ({ ...r, isApproved: false }))
                        } : prev);
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Zamítnout vše
                    </Button>
                  </div>
                </div>
              )}

              {/* Duplicate handling */}
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

              {/* Error rows */}
              {preview.errorRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="font-semibold text-destructive">Chybné záznamy ({preview.errorRows.length})</Label>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={exportErrors} title="Formát: CSV (středník, UTF-8)">
                        <FileDown className="w-4 h-4 mr-1" />
                        Export chyb
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

              {/* Summary of what will be imported */}
              {!importResult && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Bude importováno: <strong>{getImportableRowsCount()}</strong> záznamů
                    {preview.suggestionRows.filter(r => r.isApproved).length > 0 && (
                      <span className="text-muted-foreground"> (včetně {preview.suggestionRows.filter(r => r.isApproved).length} schválených návrhů)</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closePreview}>
              {importResult ? "Zavřít" : "Zrušit"}
            </Button>
            {!importResult && preview && getImportableRowsCount() > 0 && (
              <Button onClick={executeImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importuji...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Spustit import ({getImportableRowsCount()})
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
