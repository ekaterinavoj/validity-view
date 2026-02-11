import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, FileDown, Shield, Eye, Loader2, Settings2, Check, X } from "lucide-react";
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
  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);

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
      const workbook = XLSX.read(data, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { dateNF: 'yyyy-mm-dd' }) as ImportRow[];
      // Normalize date fields that may come as Date objects from Excel
      for (const row of jsonData) {
        const dateVal = row.last_training_date as any;
        if (dateVal instanceof Date) {
          row.last_training_date = dateVal.toISOString().split('T')[0];
        } else if (typeof dateVal === 'number') {
          const date = new Date((dateVal - 25569) * 86400 * 1000);
          row.last_training_date = date.toISOString().split('T')[0];
        }
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
      const autoMatchedRows: ParsedRow[] = [];
      const suggestionRows: ParsedRow[] = [];

      // Fetch all employees for matching (override default 1000 row limit)
      const { data: employees } = await supabase
        .from("employees")
        .select("id, employee_number, email, first_name, last_name")
        .limit(10000);

      // Fetch all training types
      const { data: types } = await supabase
        .from("training_types")
        .select("id, name, facility, period_days")
        .limit(10000);

      setTrainingTypes(types || []);

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

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;

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
      for (let i = 0; i < rowsToProcess.length; i++) {
        const row = rowsToProcess[i];
        
        try {
          // Calculate next training date
          const lastDate = new Date(row.data.last_training_date);
          const nextDate = new Date(lastDate);
          nextDate.setDate(nextDate.getDate() + (row.periodDays || 365));

          if (row.status === 'duplicate' && row.existingTrainingId) {
            // Update existing training (overwrite)
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
          auto_matched: preview.autoMatchedRows.length,
          suggestions_approved: preview.suggestionRows.filter(r => r.isApproved).length,
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
                  <strong>Duplicita:</strong> Stejný zaměstnanec + typ školení = aktualizuje se existující záznam (overwrite).
                </p>
                <p className="text-sm mt-2">
                  <strong>Fuzzy matching:</strong> Normalizace názvů (bez diakritiky, roku, běžných slov). 
                  ≥{settings.autoMatchThreshold}% = auto-match, {settings.minSimilarityThreshold}-{settings.autoMatchThreshold - 1}% = návrh k potvrzení, &lt;{settings.minSimilarityThreshold}% = chyba.
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
              {/* Summary */}
              <div className="grid grid-cols-6 gap-2">
                <Card className="p-3">
                  <div className="text-xl font-bold">{preview.totalRows}</div>
                  <div className="text-xs text-muted-foreground">Celkem</div>
                </Card>
                <Card className="p-3 border-primary/50 bg-primary/10">
                  <div className="text-xl font-bold text-primary">{preview.validRows.length}</div>
                  <div className="text-xs text-muted-foreground">Přesná shoda</div>
                </Card>
                <Card className="p-3 border-primary/50 bg-primary/10">
                  <div className="text-xl font-bold text-primary">{preview.autoMatchedRows.length}</div>
                  <div className="text-xs text-muted-foreground">Auto-match</div>
                </Card>
                <Card className="p-3 border-secondary/50 bg-secondary/10">
                  <div className="text-xl font-bold text-secondary-foreground">{preview.suggestionRows.length}</div>
                  <div className="text-xs text-muted-foreground">Návrhy</div>
                </Card>
                <Card className="p-3 border-accent/50 bg-accent/10">
                  <div className="text-xl font-bold text-accent-foreground">{preview.duplicateRows.length}</div>
                  <div className="text-xs text-muted-foreground">Duplicity</div>
                </Card>
                <Card className="p-3 border-destructive/50 bg-destructive/10">
                  <div className="text-xl font-bold text-destructive">{preview.errorRows.length}</div>
                  <div className="text-xs text-muted-foreground">Chyby</div>
                </Card>
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
                <div className="space-y-3">
                  <Label className="font-semibold">Jak naložit s duplicitami?</Label>
                  <RadioGroup value={duplicateAction} onValueChange={(value: DuplicateAction) => setDuplicateAction(value)}>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="overwrite" id="overwrite" />
                        <Label htmlFor="overwrite" className="cursor-pointer flex-1">
                          <span className="font-medium">Přepsat (výchozí)</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            – aktualizovat existující záznamy
                          </span>
                        </Label>
                      </div>
                      <div className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50">
                        <RadioGroupItem value="skip" id="skip" />
                        <Label htmlFor="skip" className="cursor-pointer flex-1">
                          <span className="font-medium">Přeskočit</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            – duplicity nebudou importovány
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
