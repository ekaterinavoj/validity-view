import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Loader2, Settings2, Wrench, AlertTriangle, StopCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ImportDescription } from "@/components/ImportDescription";
import { downloadCSVTemplate } from "@/lib/csvExport";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { calculateNextDateFromPeriodDays } from "@/lib/effectivePeriod";

// ============ EQUIPMENT IMPORT ============
interface EquipmentImportRow {
  inventory_number: string;
  name: string;
  equipment_type: string;
  facility_code: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  location?: string;
  responsible_person?: string;
  status?: string;
  notes?: string;
}

interface ParsedEquipmentRow {
  rowNumber: number;
  data: EquipmentImportRow;
  status: 'valid' | 'error' | 'duplicate';
  error?: string;
  warning?: string;
  existingId?: string;
}

// ============ DEADLINE IMPORT ============
interface DeadlineImportRow {
  inventory_number: string;
  deadline_type_name: string;
  facility_code: string;
  last_check_date: string;
  performer?: string;
  company?: string;
  note?: string;
  requester?: string;
  result?: string;
}

interface ParsedDeadlineRow {
  rowNumber: number;
  data: DeadlineImportRow;
  status: 'valid' | 'error' | 'duplicate';
  error?: string;
  warning?: string;
  equipmentId?: string;
  equipmentName?: string;
  deadlineTypeId?: string;
  deadlineTypeName?: string;
  periodDays?: number;
  existingDeadlineId?: string;
  existingLastCheckDate?: string;
}

type DuplicateAction = 'skip' | 'overwrite';

interface ImportSettings {
  minSimilarityThreshold: number;
}

const DEFAULT_SETTINGS: ImportSettings = {
  minSimilarityThreshold: 70,
};

// Equipment status mapping: Czech/English → DB values
const EQUIPMENT_STATUS_MAP: Record<string, string> = {
  'aktivní': 'active',
  'aktivni': 'active',
  'active': 'active',
  'neaktivní': 'inactive',
  'neaktivni': 'inactive',
  'inactive': 'inactive',
  'vyřazeno': 'decommissioned',
  'vyrazeno': 'decommissioned',
  'vyřazené': 'decommissioned',
  'vyrazene': 'decommissioned',
  'decommissioned': 'decommissioned',
};

const resolveEquipmentStatus = (raw: any): string => {
  const val = String(raw || '').toLowerCase().trim();
  return EQUIPMENT_STATUS_MAP[val] || 'active';
};

// Column name mapping: Czech export names → English import names
const EQUIPMENT_COLUMN_MAP: Record<string, string> = {
  "Inventární č.": "inventory_number",
  "Inventární číslo": "inventory_number",
  "Inv. číslo": "inventory_number",
  "Zařízení": "name",
  "Název": "name",
  "Typ zařízení": "equipment_type",
  "Typ": "equipment_type",
  "Provozovna": "facility_code",
  "Výrobce": "manufacturer",
  "Model": "model",
  "Sériové číslo": "serial_number",
  "Sériové č.": "serial_number",
  "Umístění": "location",
  "Odpovědná osoba": "responsible_person",
  "Stav": "status",
  "Poznámka": "notes",
  "Poznámky": "notes",
};

const DEADLINE_COLUMN_MAP: Record<string, string> = {
  "Inventární č.": "inventory_number",
  "Inventární číslo": "inventory_number",
  "Inv. číslo": "inventory_number",
  "Typ události": "deadline_type_name",
  "Typ lhůty": "deadline_type_name",
  "Provozovna": "facility_code",
  "Poslední kontrola": "last_check_date",
  "Datum kontroly": "last_check_date",
  "Provádějící": "performer",
  "Firma": "company",
  "Poznámka": "note",
  "Zadavatel": "requester",
  "Výsledek": "result",
  "Stav": "_stav_export",
  "Příští kontrola": "_pristi_kontrola",
  "Zařízení": "_zarizeni",
  "Typ zařízení": "_typ_zarizeni",
  "Výrobce": "_vyrobce",
  "Model": "_model",
  "Odpovědní": "_odpovedni",
  "Periodicita": "_periodicita",
};

// Build reverse map: Czech label → DB value for deadline results
const DEADLINE_RESULT_LABELS: Record<string, string> = {
  "vyhovuje": "passed",
  "vyhovuje s výhradami": "passed_with_reservations",
  "nevyhovuje": "failed",
};

const resolveDeadlineResult = (raw: string | undefined): string | null => {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (["passed", "passed_with_reservations", "failed"].includes(trimmed)) return trimmed;
  const matched = DEADLINE_RESULT_LABELS[trimmed.toLowerCase()];
  return matched || null;
};

/**
 * Map Czech column names from exports to English import column names.
 * If a column already has the English name, it passes through unchanged.
 */
const mapEquipmentRowColumns = (row: Record<string, any>): EquipmentImportRow => {
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = EQUIPMENT_COLUMN_MAP[key] || key;
    if (!(mappedKey in mapped) || !mapped[mappedKey]) {
      mapped[mappedKey] = value;
    }
  }
  return mapped as EquipmentImportRow;
};

const mapDeadlineRowColumns = (row: Record<string, any>): DeadlineImportRow => {
  const mapped: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    const mappedKey = DEADLINE_COLUMN_MAP[key] || key;
    if (!(mappedKey in mapped) || !mapped[mappedKey]) {
      mapped[mappedKey] = value;
    }
  }
  return mapped as DeadlineImportRow;
};


// Remove diacritics from string
const removeDiacritics = (str: string): string => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

// Normalize name for comparison
const normalizeName = (name: string): string => {
  let normalized = name.toLowerCase().trim();
  normalized = removeDiacritics(normalized);
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
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

export const BulkDeadlineImport = () => {
  const { toast } = useToast();
  const { isAdmin, isManager, user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"equipment" | "deadlines">("equipment");
  
  // Equipment import state
  const [importingEquipment, setImportingEquipment] = useState(false);
  const [parsingEquipment, setParsingEquipment] = useState(false);
  const [equipmentPreview, setEquipmentPreview] = useState<{
    totalRows: number;
    validRows: ParsedEquipmentRow[];
    errorRows: ParsedEquipmentRow[];
    duplicateRows: ParsedEquipmentRow[];
  } | null>(null);
  const [showEquipmentPreview, setShowEquipmentPreview] = useState(false);
  const [equipmentDuplicateAction, setEquipmentDuplicateAction] = useState<DuplicateAction>('overwrite');
  const [equipmentProgress, setEquipmentProgress] = useState(0);
  const [equipmentResult, setEquipmentResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [equipmentErrors, setEquipmentErrors] = useState<string[]>([]);

  // Deadline import state
  const [importingDeadline, setImportingDeadline] = useState(false);
  const [parsingDeadline, setParsingDeadline] = useState(false);
  const [deadlinePreview, setDeadlinePreview] = useState<{
    totalRows: number;
    validRows: ParsedDeadlineRow[];
    errorRows: ParsedDeadlineRow[];
    duplicateRows: ParsedDeadlineRow[];
  } | null>(null);
  const [showDeadlinePreview, setShowDeadlinePreview] = useState(false);
  const [deadlineDuplicateAction, setDeadlineDuplicateAction] = useState<DuplicateAction>('overwrite');
  const [deadlineProgress, setDeadlineProgress] = useState(0);
  const [deadlineResult, setDeadlineResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [deadlineErrors, setDeadlineErrors] = useState<string[]>([]);

  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  const canImport = isAdmin || isManager;
  const abortEquipmentRef = useRef(false);
  const abortDeadlineRef = useRef(false);
  // ============ EQUIPMENT IMPORT FUNCTIONS ============
  const downloadEquipmentTemplateXLSX = () => {
    const template = [
      {
        "Inventární č.": "INV-001",
        "Název": "Vysokozdvižný vozík",
        "Typ zařízení": "VZV",
        "Provozovna": "qlar-jenec-dc3",
        "Výrobce": "Toyota",
        "Model": "8FG25",
        "Sériové č.": "SN123456",
        "Umístění": "Hala A",
        "Odpovědná osoba": "jan.novak@firma.cz",
        "Stav": "Aktivní",
        "Poznámka": "Poznámka k zařízení"
      },
      {
        "Inventární č.": "INV-002",
        "Název": "Regálový zakladač",
        "Typ zařízení": "Zakladač",
        "Provozovna": "qlar-jenec-dc3",
        "Výrobce": "Jungheinrich",
        "Model": "EKX 515",
        "Sériové č.": "SN789012",
        "Umístění": "Hala B",
        "Odpovědná osoba": "",
        "Stav": "Aktivní",
        "Poznámka": ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Zařízení");
    XLSX.writeFile(wb, "sablona_import_zarizeni.xlsx");

    toast({
      title: "Šablona stažena",
      description: "Excel šablona pro import zařízení byla stažena.",
    });
  };

  const downloadEquipmentTemplateCSV = () => {
    const template = [
      {
        "Inventární č.": "INV-001",
        "Název": "Vysokozdvižný vozík",
        "Typ zařízení": "VZV",
        "Provozovna": "qlar-jenec-dc3",
        "Výrobce": "Toyota",
        "Model": "8FG25",
        "Sériové č.": "SN123456",
        "Umístění": "Hala A",
        "Odpovědná osoba": "jan.novak@firma.cz",
        "Stav": "Aktivní",
        "Poznámka": "Poznámka k zařízení"
      }
    ];

    const csv = Papa.unparse(template, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sablona_import_zarizeni.csv";
    link.click();

    toast({
      title: "Šablona stažena",
      description: "CSV šablona pro import zařízení byla stažena (delimiter: středník, kódování: UTF-8 BOM).",
    });
  };

  const parseEquipmentFile = async (file: File): Promise<EquipmentImportRow[]> => {
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
      rawData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
    } else {
      throw new Error("Nepodporovaný formát souboru. Použijte CSV nebo Excel.");
    }

    // Map Czech column names from exports to English import names
    return rawData.map(row => mapEquipmentRowColumns(row));
  };

  const validateEquipment = async (data: EquipmentImportRow[]) => {
    setParsingEquipment(true);
    
    try {
      const validRows: ParsedEquipmentRow[] = [];
      const errorRows: ParsedEquipmentRow[] = [];
      const duplicateRows: ParsedEquipmentRow[] = [];

      // Fetch existing equipment for duplicate detection (override default 1000 row limit)
      const { data: existingEquipment } = await supabase
        .from("equipment")
        .select("id, inventory_number, name, facility, equipment_type, manufacturer, serial_number")
        .limit(10000);

      // Fetch facilities for validation
      const { data: facilities } = await supabase
        .from("facilities")
        .select("code, name")
        .limit(10000);

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

        const parsedRow: ParsedEquipmentRow = {
          rowNumber,
          data: row,
          status: 'valid',
        };

        // Validate required fields
        if (!row.inventory_number?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí inventární číslo";
          errorRows.push(parsedRow);
          continue;
        }

        if (!row.name?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí název zařízení";
          errorRows.push(parsedRow);
          continue;
        }

        if (!row.equipment_type?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí typ zařízení";
          errorRows.push(parsedRow);
          continue;
        }

        if (!row.facility_code?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí kód provozovny";
          errorRows.push(parsedRow);
          continue;
        }

        // Validate facility exists (by code or name)
        const resolvedFacilityCode = resolveFacility(row.facility_code);
        if (!resolvedFacilityCode) {
          parsedRow.status = 'error';
          parsedRow.error = `Provozovna "${row.facility_code}" neexistuje v systému`;
          errorRows.push(parsedRow);
          continue;
        }
        row.facility_code = resolvedFacilityCode;

        // Check for duplicates — exact match on ALL key fields
        const trimmedInv = row.inventory_number.trim();
        const trimmedName = row.name?.trim() || "";
        const trimmedType = row.equipment_type?.trim() || "";
        const trimmedManufacturer = (row as any).manufacturer?.trim() || "";
        const trimmedSerial = (row as any).serial_number?.trim() || "";
        
        const existingEq = existingEquipment?.find(e => {
          return (
            e.inventory_number === trimmedInv &&
            (e.name || '') === trimmedName &&
            (e.equipment_type || '') === trimmedType &&
            (e.manufacturer || '') === trimmedManufacturer &&
            (e.serial_number || '') === trimmedSerial
          );
        });

        if (existingEq) {
          parsedRow.status = 'duplicate';
          parsedRow.existingId = existingEq.id;
          const details = [
            `inv. č. "${trimmedInv}"`,
            trimmedType ? `typ "${trimmedType}"` : null,
            trimmedManufacturer ? `výrobce "${trimmedManufacturer}"` : null,
            trimmedSerial ? `s/n "${trimmedSerial}"` : null,
          ].filter(Boolean).join(", ");
          parsedRow.warning = `Zařízení (${details}) již existuje`;
          duplicateRows.push(parsedRow);
          continue;
        }

        validRows.push(parsedRow);
      }

      setEquipmentPreview({
        totalRows: data.length,
        validRows,
        errorRows,
        duplicateRows,
      });
      setShowEquipmentPreview(true);
    } catch (err) {
      toast({
        title: "Chyba při validaci",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setParsingEquipment(false);
    }
  };

  const handleEquipmentFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseEquipmentFile(file);
      await validateEquipment(data);
    } catch (err) {
      toast({
        title: "Chyba při čtení souboru",
        description: (err as Error).message,
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const executeEquipmentImport = async () => {
    if (!equipmentPreview || !user) return;

    setImportingEquipment(true);
    setEquipmentProgress(0);
    setEquipmentErrors([]);
    abortEquipmentRef.current = false;

    const rowsToProcess = [
      ...equipmentPreview.validRows,
      ...(equipmentDuplicateAction === 'overwrite' ? equipmentPreview.duplicateRows : []),
    ];

    let inserted = 0;
    let updated = 0;
    let skipped = equipmentDuplicateAction === 'skip' ? equipmentPreview.duplicateRows.length : 0;
    let failed = 0;
    const errors: string[] = [];

    // Separate inserts from updates
    const toInsert = rowsToProcess.filter(r => !(r.status === 'duplicate' && r.existingId));
    const toUpdate = rowsToProcess.filter(r => r.status === 'duplicate' && r.existingId);
    const total = rowsToProcess.length;

    // Batch INSERT (50 at a time)
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      if (abortEquipmentRef.current) break;
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const insertRows = batch.map(row => ({
        inventory_number: row.data.inventory_number.trim(),
        name: row.data.name.trim(),
        equipment_type: row.data.equipment_type.trim(),
        facility: row.data.facility_code.trim(),
        manufacturer: row.data.manufacturer?.trim() || null,
        model: row.data.model?.trim() || null,
        serial_number: row.data.serial_number?.trim() || null,
        location: row.data.location?.trim() || null,
        responsible_person: row.data.responsible_person?.trim() || null,
        status: resolveEquipmentStatus(row.data.status),
        notes: row.data.notes?.trim() || null,
      }));

      try {
        const { error } = await supabase.from("equipment").insert(insertRows);
        if (error) throw error;
        inserted += batch.length;
      } catch (batchErr: any) {
        console.warn("Batch equipment insert failed, falling back to row-by-row:", batchErr);
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          try {
            const { error: rowError } = await supabase.from("equipment").insert([insertRows[j]]);
            if (rowError) throw rowError;
            inserted++;
          } catch (rowErr: any) {
            failed++;
            errors.push(`Řádek ${row.rowNumber} (${row.data.inventory_number}): ${rowErr?.message || 'Neznámá chyba při vkládání'}`);
          }
        }
      }
      setEquipmentProgress(Math.round((Math.min(i + BATCH_SIZE, toInsert.length) / total) * 100));
    }

    // Row-by-row UPDATE
    for (let i = 0; i < toUpdate.length; i++) {
      if (abortEquipmentRef.current) break;
      const row = toUpdate[i];
      try {
        const { error } = await supabase
          .from("equipment")
          .update({
            inventory_number: row.data.inventory_number.trim(),
            name: row.data.name.trim(),
            equipment_type: row.data.equipment_type.trim(),
            facility: row.data.facility_code.trim(),
            manufacturer: row.data.manufacturer?.trim() || null,
            model: row.data.model?.trim() || null,
            serial_number: row.data.serial_number?.trim() || null,
            location: row.data.location?.trim() || null,
            responsible_person: row.data.responsible_person?.trim() || null,
            status: resolveEquipmentStatus(row.data.status),
            notes: row.data.notes?.trim() || null,
          })
          .eq("id", row.existingId!);
        if (error) throw error;
        updated++;
      } catch (err: any) {
        console.error("Error updating equipment:", err);
        failed++;
        errors.push(`Řádek ${row.rowNumber} (${row.data.inventory_number}): ${err?.message || 'Neznámá chyba při aktualizaci'}`);
      }
      setEquipmentProgress(Math.round(((toInsert.length + i + 1) / total) * 100));
    }

    setEquipmentResult({ inserted, updated, skipped, failed });
    setEquipmentErrors(errors);
    setImportingEquipment(false);

    toast({
      title: failed > 0 ? "Import zařízení dokončen s chybami" : "Import zařízení dokončen",
      description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Chyby: ${failed}`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  // ============ DEADLINE IMPORT FUNCTIONS ============
  const downloadDeadlineTemplateXLSX = () => {
    const template = [
      {
        "Inventární č.": "INV-001",
        "Typ události": "Revize VZV",
        "Provozovna": "qlar-jenec-dc3",
        "Poslední kontrola": "15.01.2024",
        "Provádějící": "BOZP Servis s.r.o.",
        "Firma": "Revizní firma",
        "Poznámka": "Poznámka k lhůtě"
      },
      {
        "Inventární č.": "INV-002",
        "Typ události": "Kalibrace",
        "Provozovna": "qlar-jenec-dc3",
        "Poslední kontrola": "20.02.2024",
        "Provádějící": "",
        "Firma": "",
        "Poznámka": ""
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lhůty");
    XLSX.writeFile(wb, "sablona_import_lhut.xlsx");

    toast({
      title: "Šablona stažena",
      description: "Excel šablona pro import lhůt byla stažena.",
    });
  };

  const downloadDeadlineTemplateCSV = () => {
    const template = [
      {
        "Inventární č.": "INV-001",
        "Typ události": "Revize VZV",
        "Provozovna": "qlar-jenec-dc3",
        "Poslední kontrola": "15.01.2024",
        "Provádějící": "BOZP Servis s.r.o.",
        "Firma": "Revizní firma",
        "Poznámka": "Poznámka k lhůtě"
      }
    ];

    const csv = Papa.unparse(template, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sablona_import_lhut.csv";
    link.click();

    toast({
      title: "Šablona stažena",
      description: "CSV šablona pro import lhůt byla stažena (delimiter: středník, kódování: UTF-8 BOM).",
    });
  };

  const parseDeadlineFile = async (file: File): Promise<DeadlineImportRow[]> => {
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
    const mapped = rawData.map(row => mapDeadlineRowColumns(row));
    for (const row of mapped) {
      row.last_check_date = normalizeDate(row.last_check_date);
    }
    return mapped;
  };

  const validateDeadlines = async (data: DeadlineImportRow[]) => {
    setParsingDeadline(true);
    
    try {
      const validRows: ParsedDeadlineRow[] = [];
      const errorRows: ParsedDeadlineRow[] = [];
      const duplicateRows: ParsedDeadlineRow[] = [];

      // Fetch all needed data in parallel
      const [{ data: equipment }, { data: deadlineTypes }, { data: existingDeadlines }, { data: facilities }] = await Promise.all([
        supabase.from("equipment").select("id, inventory_number, name, facility").limit(10000),
        supabase.from("deadline_types").select("id, name, facility, period_days").limit(10000),
        supabase.from("deadlines").select("id, equipment_id, deadline_type_id, last_check_date").is("deleted_at", null).limit(50000),
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

        const parsedRow: ParsedDeadlineRow = {
          rowNumber,
          data: row,
          status: 'valid',
        };

        // Validate required fields
        if (!row.inventory_number?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí inventární číslo zařízení";
          errorRows.push(parsedRow);
          continue;
        }

        if (!row.deadline_type_name?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí název typu lhůty";
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

        const dateStr = String(row.last_check_date || '').trim();
        if (!dateStr) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí datum poslední kontroly";
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
        const [y, m, d] = normalizedDateVal.split('-').map(Number);
        const testDate = new Date(y, m - 1, d);
        if (testDate.getFullYear() !== y || testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
          parsedRow.status = 'error';
          parsedRow.error = `Datum "${dateStr}" není platné (použijte YYYY-MM-DD nebo DD.MM.YYYY)`;
          errorRows.push(parsedRow);
          continue;
        }
        row.last_check_date = normalizedDateVal;

        // Find equipment by inventory_number
        const eq = equipment?.find(e => e.inventory_number === row.inventory_number.trim());
        if (!eq) {
          parsedRow.status = 'error';
          parsedRow.error = `Zařízení s inv. číslem "${row.inventory_number}" nebylo nalezeno`;
          errorRows.push(parsedRow);
          continue;
        }

        parsedRow.equipmentId = eq.id;
        parsedRow.equipmentName = eq.name;

        // Find deadline type (exact match first, then fuzzy)
        let deadlineType = deadlineTypes?.find(
          t => normalizeName(t.name) === normalizeName(row.deadline_type_name) && 
               t.facility === row.facility_code.trim()
        );

        if (!deadlineType) {
          // Try case-insensitive match
          deadlineType = deadlineTypes?.find(
            t => t.name.toLowerCase() === row.deadline_type_name.toLowerCase() && 
                 t.facility === row.facility_code.trim()
          );
        }

        if (!deadlineType) {
          parsedRow.status = 'error';
          parsedRow.error = `Typ lhůty "${row.deadline_type_name}" pro provozovnu "${row.facility_code}" nebyl nalezen`;
          errorRows.push(parsedRow);
          continue;
        }

        parsedRow.deadlineTypeId = deadlineType.id;
        parsedRow.deadlineTypeName = deadlineType.name;
        parsedRow.periodDays = deadlineType.period_days;

        // Check for duplicates (same equipment + deadline type)
        const existingDeadline = existingDeadlines?.find(
          d => d.equipment_id === eq.id && d.deadline_type_id === deadlineType!.id
        );

        if (existingDeadline) {
          parsedRow.status = 'duplicate';
          parsedRow.existingDeadlineId = existingDeadline.id;
          parsedRow.existingLastCheckDate = existingDeadline.last_check_date;
          parsedRow.warning = `Lhůta pro toto zařízení a typ již existuje`;
          duplicateRows.push(parsedRow);
          continue;
        }

        validRows.push(parsedRow);
      }

      setDeadlinePreview({
        totalRows: data.length,
        validRows,
        errorRows,
        duplicateRows,
      });
      setShowDeadlinePreview(true);
    } catch (err) {
      toast({
        title: "Chyba při validaci",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setParsingDeadline(false);
    }
  };

  const handleDeadlineFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await parseDeadlineFile(file);
      await validateDeadlines(data);
    } catch (err) {
      toast({
        title: "Chyba při čtení souboru",
        description: (err as Error).message,
        variant: "destructive",
      });
    }

    event.target.value = "";
  };

  const executeDeadlineImport = async () => {
    if (!deadlinePreview || !user) return;

    setImportingDeadline(true);
    setDeadlineProgress(0);
    setDeadlineErrors([]);
    abortDeadlineRef.current = false;

    const rowsToProcess = [
      ...deadlinePreview.validRows,
      ...(deadlineDuplicateAction === 'overwrite' ? deadlinePreview.duplicateRows : []),
    ];

    let inserted = 0;
    let updated = 0;
    let skipped = deadlineDuplicateAction === 'skip' ? deadlinePreview.duplicateRows.length : 0;
    let failed = 0;
    const errors: string[] = [];

    // Separate inserts from updates
    const toInsert = rowsToProcess.filter(r => !(r.status === 'duplicate' && r.existingDeadlineId));
    const toUpdate = rowsToProcess.filter(r => r.status === 'duplicate' && r.existingDeadlineId);
    const total = rowsToProcess.length;

    // Batch INSERT (50 at a time)
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      if (abortDeadlineRef.current) break;
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const insertRows = batch.map(row => {
        const nextCheckDate = calculateNextDateFromPeriodDays(new Date(row.data.last_check_date), null, row.periodDays || 365);
        return {
          equipment_id: row.equipmentId!,
          deadline_type_id: row.deadlineTypeId!,
          facility: row.data.facility_code.trim(),
          last_check_date: row.data.last_check_date,
          next_check_date: nextCheckDate.toISOString().split("T")[0],
          performer: row.data.performer?.trim() || null,
          company: row.data.company?.trim() || null,
          note: row.data.note?.trim() || null,
          status: 'valid',
          is_active: true,
          created_by: user.id,
        };
      });

      try {
        const { error } = await supabase.from("deadlines").insert(insertRows);
        if (error) throw error;
        inserted += batch.length;
      } catch (batchErr: any) {
        console.warn("Batch deadline insert failed, falling back to row-by-row:", batchErr);
        for (let j = 0; j < batch.length; j++) {
          const row = batch[j];
          try {
            const { error: rowError } = await supabase.from("deadlines").insert([insertRows[j]]);
            if (rowError) throw rowError;
            inserted++;
          } catch (rowErr: any) {
            failed++;
            errors.push(`Řádek ${row.rowNumber} (${row.data.inventory_number}): ${rowErr?.message || 'Neznámá chyba při vkládání'}`);
          }
        }
      }
      setDeadlineProgress(Math.round((Math.min(i + BATCH_SIZE, toInsert.length) / total) * 100));
    }

    // Row-by-row UPDATE
    for (let i = 0; i < toUpdate.length; i++) {
      if (abortDeadlineRef.current) break;
      const row = toUpdate[i];
      try {
          const nextCheckDate = calculateNextDateFromPeriodDays(new Date(row.data.last_check_date), null, row.periodDays || 365);

        const { error } = await supabase
          .from("deadlines")
          .update({
            facility: row.data.facility_code.trim(),
            last_check_date: row.data.last_check_date,
            next_check_date: nextCheckDate.toISOString().split("T")[0],
            performer: row.data.performer?.trim() || null,
            company: row.data.company?.trim() || null,
            note: row.data.note?.trim() || null,
            status: 'valid',
          })
          .eq("id", row.existingDeadlineId!);
        if (error) throw error;
        updated++;
      } catch (err: any) {
        console.error("Error updating deadline:", err);
        failed++;
        errors.push(`Řádek ${row.rowNumber} (${row.data.inventory_number}): ${err?.message || 'Neznámá chyba při aktualizaci'}`);
      }
      setDeadlineProgress(Math.round(((toInsert.length + i + 1) / total) * 100));
    }

    setDeadlineResult({ inserted, updated, skipped, failed });
    setDeadlineErrors(errors);
    setImportingDeadline(false);

    toast({
      title: failed > 0 ? "Import lhůt dokončen s chybami" : "Import lhůt dokončen",
      description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Chyby: ${failed}`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  if (!canImport) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nemáte oprávnění k importu dat. Kontaktujte administrátora.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Hromadný import - Technické lhůty
        </CardTitle>
        <CardDescription>
          Importujte zařízení a technické lhůty z Excel nebo CSV souboru
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "equipment" | "deadlines")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="equipment">Zařízení</TabsTrigger>
            <TabsTrigger value="deadlines">Technické lhůty</TabsTrigger>
          </TabsList>

          <TabsContent value="equipment" className="space-y-4">
            <ImportDescription
              requiredColumns={[
                { name: "Inventární č.", description: "unikátní inventární číslo zařízení" },
                { name: "Název", description: "název zařízení" },
                { name: "Typ zařízení", description: "typ zařízení (např. VZV, Zakladač)" },
                { name: "Provozovna", description: "kód provozovny (musí existovat v systému)" },
              ]}
              optionalColumns={[
                { name: "Výrobce", description: "výrobce zařízení" },
                { name: "Model", description: "model zařízení" },
                { name: "Sériové č.", description: "sériové číslo" },
                { name: "Umístění", description: "fyzické umístění" },
                { name: "Odpovědná osoba", description: "email odpovědné osoby" },
                { name: "Stav", description: "aktivní / neaktivní / vyřazeno (výchozí: aktivní)" },
                { name: "Poznámka", description: "poznámky" },
              ]}
              duplicateInfo="Zařízení se stejným inventárním číslem = aktualizuje se existující záznam."
            />

            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadEquipmentTemplateXLSX}>
                  <Download className="w-4 h-4 mr-2" />
                  Šablona XLSX
                </Button>
                <Button variant="outline" size="sm" onClick={downloadEquipmentTemplateCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Šablona CSV
                </Button>
              </div>

              <div className="flex-1">
                <label htmlFor="equipment-file-upload" className="cursor-pointer">
                  <Button asChild disabled={parsingEquipment}>
                    <span>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      {parsingEquipment ? (
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
                  id="equipment-file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleEquipmentFileSelect}
                  className="hidden"
                  disabled={parsingEquipment}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deadlines" className="space-y-4">
            <ImportDescription
              requiredColumns={[
                { name: "Inventární č.", description: "inventární číslo zařízení (musí existovat v systému)" },
                { name: "Typ události", description: "název typu lhůty (musí existovat v systému)" },
                { name: "Provozovna", description: "kód provozovny (musí existovat v systému)" },
                { name: "Poslední kontrola", description: "datum poslední kontroly (DD.MM.YYYY nebo YYYY-MM-DD)" },
              ]}
              optionalColumns={[
                { name: "Realizátor", description: "provádějící osoba/technik" },
                { name: "Firma", description: "servisní/revizní firma" },
                { name: "Poznámka", description: "poznámka" },
              ]}
              duplicateInfo="Stejné zařízení + typ lhůty = aktualizuje se existující záznam (overwrite). Zařízení a typy lhůt musí existovat v systému."
            />

            <div className="flex flex-wrap gap-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={downloadDeadlineTemplateXLSX}>
                  <Download className="w-4 h-4 mr-2" />
                  Šablona XLSX
                </Button>
                <Button variant="outline" size="sm" onClick={downloadDeadlineTemplateCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Šablona CSV
                </Button>
              </div>

              <div className="flex-1">
                <label htmlFor="deadline-file-upload" className="cursor-pointer">
                  <Button asChild disabled={parsingDeadline}>
                    <span>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      {parsingDeadline ? (
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
                  id="deadline-file-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleDeadlineFileSelect}
                  className="hidden"
                  disabled={parsingDeadline}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Equipment Preview Dialog */}
        <Dialog open={showEquipmentPreview} onOpenChange={setShowEquipmentPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Náhled importu zařízení</DialogTitle>
              <DialogDescription>
                Zkontrolujte data před importem
              </DialogDescription>
            </DialogHeader>

            {equipmentPreview && (
              <div className="space-y-4">
                {equipmentPreview.totalRows >= 1000 && (
                  <Alert className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      Velký dataset ({equipmentPreview.totalRows} řádků). Import může trvat delší dobu.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{equipmentPreview.totalRows}</p>
                    <p className="text-sm text-muted-foreground">Celkem řádků</p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {equipmentPreview.validRows.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Validních</p>
                  </div>
                  <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                      {equipmentPreview.duplicateRows.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Duplicit</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {equipmentPreview.errorRows.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Chyb</p>
                  </div>
                </div>

                {equipmentPreview.duplicateRows.length > 0 && (
                  <div className="space-y-2">
                    <Label>Jak zacházet s duplicitami?</Label>
                    <RadioGroup value={equipmentDuplicateAction} onValueChange={(v) => setEquipmentDuplicateAction(v as DuplicateAction)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="overwrite" id="eq-overwrite" />
                        <Label htmlFor="eq-overwrite">Přepsat existující záznamy</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id="eq-skip" />
                        <Label htmlFor="eq-skip">Přeskočit duplicity</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {equipmentPreview.errorRows.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Zobrazit chyby ({equipmentPreview.errorRows.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Řádek</TableHead>
                            <TableHead>Inv. číslo</TableHead>
                            <TableHead>Chyba</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {equipmentPreview.errorRows.slice(0, 10).map((row) => (
                            <TableRow key={row.rowNumber}>
                              <TableCell>{row.rowNumber}</TableCell>
                              <TableCell>{row.data.inventory_number || "-"}</TableCell>
                              <TableCell className="text-red-600">{row.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {importingEquipment && (
                  <div className="space-y-2">
                    <Progress value={equipmentProgress} />
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Importuji... {equipmentProgress}%</p>
                      <Button variant="destructive" size="sm" onClick={() => { abortEquipmentRef.current = true; }}>
                        <StopCircle className="w-4 h-4 mr-1" />Zastavit
                      </Button>
                    </div>
                  </div>
                )}

                {equipmentResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Import dokončen: {equipmentResult.inserted} vloženo, {equipmentResult.updated} aktualizováno, {equipmentResult.skipped} přeskočeno, {equipmentResult.failed} chyb
                      {equipmentErrors.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-medium text-destructive">Detail chyb:</p>
                          <ul className="text-sm text-destructive list-disc list-inside max-h-[150px] overflow-y-auto">
                            {equipmentErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowEquipmentPreview(false);
                setEquipmentPreview(null);
                setEquipmentResult(null);
              }}>
                Zavřít
              </Button>
              {!equipmentResult && (
                <Button
                  onClick={executeEquipmentImport}
                  disabled={importingEquipment || (equipmentPreview?.validRows.length === 0 && equipmentPreview?.duplicateRows.length === 0)}
                >
                  {importingEquipment ? (
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

        {/* Deadline Preview Dialog */}
        <Dialog open={showDeadlinePreview} onOpenChange={setShowDeadlinePreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Náhled importu lhůt</DialogTitle>
              <DialogDescription>
                Zkontrolujte data před importem
              </DialogDescription>
            </DialogHeader>

            {deadlinePreview && (
              <div className="space-y-4">
                {deadlinePreview.totalRows >= 1000 && (
                  <Alert className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      Velký dataset ({deadlinePreview.totalRows} řádků). Import může trvat delší dobu.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{deadlinePreview.totalRows}</p>
                    <p className="text-sm text-muted-foreground">Celkem řádků</p>
                  </div>
                  <div className="bg-green-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {deadlinePreview.validRows.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Validních</p>
                  </div>
                  <div className="bg-yellow-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                      {deadlinePreview.duplicateRows.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Duplicit</p>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-300">
                      {deadlinePreview.errorRows.length}
                    </p>
                    <p className="text-sm text-muted-foreground">Chyb</p>
                  </div>
                </div>

                {deadlinePreview.duplicateRows.length > 0 && (
                  <div className="space-y-2">
                    <Label>Jak zacházet s duplicitami?</Label>
                    <RadioGroup value={deadlineDuplicateAction} onValueChange={(v) => setDeadlineDuplicateAction(v as DuplicateAction)}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="overwrite" id="dl-overwrite" />
                        <Label htmlFor="dl-overwrite">Přepsat existující záznamy</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="skip" id="dl-skip" />
                        <Label htmlFor="dl-skip">Přeskočit duplicity</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {deadlinePreview.errorRows.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="text-red-600">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Zobrazit chyby ({deadlinePreview.errorRows.length})
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Řádek</TableHead>
                            <TableHead>Inv. číslo</TableHead>
                            <TableHead>Typ lhůty</TableHead>
                            <TableHead>Chyba</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {deadlinePreview.errorRows.slice(0, 10).map((row) => (
                            <TableRow key={row.rowNumber}>
                              <TableCell>{row.rowNumber}</TableCell>
                              <TableCell>{row.data.inventory_number || "-"}</TableCell>
                              <TableCell>{row.data.deadline_type_name || "-"}</TableCell>
                              <TableCell className="text-red-600">{row.error}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {importingDeadline && (
                  <div className="space-y-2">
                    <Progress value={deadlineProgress} />
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Importuji... {deadlineProgress}%</p>
                      <Button variant="destructive" size="sm" onClick={() => { abortDeadlineRef.current = true; }}>
                        <StopCircle className="w-4 h-4 mr-1" />Zastavit
                      </Button>
                    </div>
                  </div>
                )}

                {deadlineResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Import dokončen: {deadlineResult.inserted} vloženo, {deadlineResult.updated} aktualizováno, {deadlineResult.skipped} přeskočeno, {deadlineResult.failed} chyb
                      {deadlineErrors.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-sm font-medium text-destructive">Detail chyb:</p>
                          <ul className="text-sm text-destructive list-disc list-inside max-h-[150px] overflow-y-auto">
                            {deadlineErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowDeadlinePreview(false);
                setDeadlinePreview(null);
                setDeadlineResult(null);
              }}>
                Zavřít
              </Button>
              {!deadlineResult && (
                <Button
                  onClick={executeDeadlineImport}
                  disabled={importingDeadline || (deadlinePreview?.validRows.length === 0 && deadlinePreview?.duplicateRows.length === 0)}
                >
                  {importingDeadline ? (
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
      </CardContent>
    </Card>
  );
};
