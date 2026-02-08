import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Loader2, Settings2, Wrench } from "lucide-react";
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

  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  const canImport = isAdmin || isManager;

  // ============ EQUIPMENT IMPORT FUNCTIONS ============
  const downloadEquipmentTemplateXLSX = () => {
    const template = [
      {
        inventory_number: "INV-001",
        name: "Vysokozdvižný vozík",
        equipment_type: "VZV",
        facility_code: "qlar-jenec-dc3",
        manufacturer: "Toyota",
        model: "8FG25",
        serial_number: "SN123456",
        location: "Hala A",
        responsible_person: "Jan Novák",
        status: "active",
        notes: "Poznámka k zařízení"
      },
      {
        inventory_number: "INV-002",
        name: "Regálový zakladač",
        equipment_type: "Zakladač",
        facility_code: "qlar-jenec-dc3",
        manufacturer: "Jungheinrich",
        model: "EKX 515",
        serial_number: "SN789012",
        location: "Hala B",
        responsible_person: "",
        status: "active",
        notes: ""
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
        inventory_number: "INV-001",
        name: "Vysokozdvižný vozík",
        equipment_type: "VZV",
        facility_code: "qlar-jenec-dc3",
        manufacturer: "Toyota",
        model: "8FG25",
        serial_number: "SN123456",
        location: "Hala A",
        responsible_person: "Jan Novák",
        status: "active",
        notes: "Poznámka k zařízení"
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

    if (fileExtension === "csv") {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",
          complete: (results) => resolve(results.data as EquipmentImportRow[]),
          error: (error) => reject(error),
        });
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet) as EquipmentImportRow[];
    } else {
      throw new Error("Nepodporovaný formát souboru. Použijte CSV nebo Excel.");
    }
  };

  const validateEquipment = async (data: EquipmentImportRow[]) => {
    setParsingEquipment(true);
    
    try {
      const validRows: ParsedEquipmentRow[] = [];
      const errorRows: ParsedEquipmentRow[] = [];
      const duplicateRows: ParsedEquipmentRow[] = [];

      // Fetch existing equipment for duplicate detection
      const { data: existingEquipment } = await supabase
        .from("equipment")
        .select("id, inventory_number, facility");

      // Fetch facilities for validation
      const { data: facilities } = await supabase
        .from("facilities")
        .select("code, name");

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

        // Validate facility exists
        const facilityExists = facilities?.some(f => f.code === row.facility_code.trim());
        if (!facilityExists) {
          parsedRow.status = 'error';
          parsedRow.error = `Provozovna "${row.facility_code}" neexistuje`;
          errorRows.push(parsedRow);
          continue;
        }

        // Check for duplicates (same inventory_number)
        const existingEq = existingEquipment?.find(
          e => e.inventory_number === row.inventory_number.trim()
        );

        if (existingEq) {
          parsedRow.status = 'duplicate';
          parsedRow.existingId = existingEq.id;
          parsedRow.warning = `Zařízení s inv. číslem "${row.inventory_number}" již existuje`;
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

    const rowsToProcess = [
      ...equipmentPreview.validRows,
      ...(equipmentDuplicateAction === 'overwrite' ? equipmentPreview.duplicateRows : []),
    ];

    let inserted = 0;
    let updated = 0;
    let skipped = equipmentDuplicateAction === 'skip' ? equipmentPreview.duplicateRows.length : 0;
    let failed = 0;

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      
      try {
        const equipmentData = {
          inventory_number: row.data.inventory_number.trim(),
          name: row.data.name.trim(),
          equipment_type: row.data.equipment_type.trim(),
          facility: row.data.facility_code.trim(),
          manufacturer: row.data.manufacturer?.trim() || null,
          model: row.data.model?.trim() || null,
          serial_number: row.data.serial_number?.trim() || null,
          location: row.data.location?.trim() || null,
          responsible_person: row.data.responsible_person?.trim() || null,
          status: row.data.status?.trim() || 'active',
          notes: row.data.notes?.trim() || null,
        };

        if (row.status === 'duplicate' && row.existingId) {
          const { error } = await supabase
            .from("equipment")
            .update(equipmentData)
            .eq("id", row.existingId);
          
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from("equipment")
            .insert(equipmentData);
          
          if (error) throw error;
          inserted++;
        }
      } catch (err) {
        console.error("Error importing equipment:", err);
        failed++;
      }

      setEquipmentProgress(Math.round(((i + 1) / rowsToProcess.length) * 100));
    }

    setEquipmentResult({ inserted, updated, skipped, failed });
    setImportingEquipment(false);

    toast({
      title: "Import zařízení dokončen",
      description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Chyby: ${failed}`,
    });
  };

  // ============ DEADLINE IMPORT FUNCTIONS ============
  const downloadDeadlineTemplateXLSX = () => {
    const template = [
      {
        inventory_number: "INV-001",
        deadline_type_name: "Revize VZV",
        facility_code: "qlar-jenec-dc3",
        last_check_date: "2024-01-15",
        performer: "BOZP Servis s.r.o.",
        company: "Revizní firma",
        note: "Poznámka k lhůtě"
      },
      {
        inventory_number: "INV-002",
        deadline_type_name: "Kalibrace",
        facility_code: "qlar-jenec-dc3",
        last_check_date: "2024-02-20",
        performer: "",
        company: "",
        note: ""
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
        inventory_number: "INV-001",
        deadline_type_name: "Revize VZV",
        facility_code: "qlar-jenec-dc3",
        last_check_date: "2024-01-15",
        performer: "BOZP Servis s.r.o.",
        company: "Revizní firma",
        note: "Poznámka k lhůtě"
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

    if (fileExtension === "csv") {
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          delimiter: "",
          complete: (results) => resolve(results.data as DeadlineImportRow[]),
          error: (error) => reject(error),
        });
      });
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet) as DeadlineImportRow[];
    } else {
      throw new Error("Nepodporovaný formát souboru. Použijte CSV nebo Excel.");
    }
  };

  const validateDeadlines = async (data: DeadlineImportRow[]) => {
    setParsingDeadline(true);
    
    try {
      const validRows: ParsedDeadlineRow[] = [];
      const errorRows: ParsedDeadlineRow[] = [];
      const duplicateRows: ParsedDeadlineRow[] = [];

      // Fetch equipment for matching
      const { data: equipment } = await supabase
        .from("equipment")
        .select("id, inventory_number, name, facility");

      // Fetch deadline types
      const { data: deadlineTypes } = await supabase
        .from("deadline_types")
        .select("id, name, facility, period_days");

      // Fetch existing deadlines for duplicate detection
      const { data: existingDeadlines } = await supabase
        .from("deadlines")
        .select("id, equipment_id, deadline_type_id, last_check_date")
        .is("deleted_at", null);

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

        if (!row.last_check_date?.trim()) {
          parsedRow.status = 'error';
          parsedRow.error = "Chybí datum poslední kontroly";
          errorRows.push(parsedRow);
          continue;
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(row.last_check_date)) {
          parsedRow.status = 'error';
          parsedRow.error = "Datum musí být ve formátu YYYY-MM-DD";
          errorRows.push(parsedRow);
          continue;
        }

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

    const rowsToProcess = [
      ...deadlinePreview.validRows,
      ...(deadlineDuplicateAction === 'overwrite' ? deadlinePreview.duplicateRows : []),
    ];

    let inserted = 0;
    let updated = 0;
    let skipped = deadlineDuplicateAction === 'skip' ? deadlinePreview.duplicateRows.length : 0;
    let failed = 0;

    for (let i = 0; i < rowsToProcess.length; i++) {
      const row = rowsToProcess[i];
      
      try {
        const lastCheckDate = new Date(row.data.last_check_date);
        const periodDays = row.periodDays || 365;
        const nextCheckDate = new Date(lastCheckDate);
        nextCheckDate.setDate(nextCheckDate.getDate() + periodDays);

        const deadlineData = {
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

        if (row.status === 'duplicate' && row.existingDeadlineId) {
          const { error } = await supabase
            .from("deadlines")
            .update({
              ...deadlineData,
              created_by: undefined, // Don't update created_by
            })
            .eq("id", row.existingDeadlineId);
          
          if (error) throw error;
          updated++;
        } else {
          const { error } = await supabase
            .from("deadlines")
            .insert(deadlineData);
          
          if (error) throw error;
          inserted++;
        }
      } catch (err) {
        console.error("Error importing deadline:", err);
        failed++;
      }

      setDeadlineProgress(Math.round(((i + 1) / rowsToProcess.length) * 100));
    }

    setDeadlineResult({ inserted, updated, skipped, failed });
    setImportingDeadline(false);

    toast({
      title: "Import lhůt dokončen",
      description: `Vloženo: ${inserted}, Aktualizováno: ${updated}, Přeskočeno: ${skipped}, Chyby: ${failed}`,
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
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Povinné sloupce:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                    <li><strong>inventory_number</strong> – unikátní inventární číslo zařízení</li>
                    <li><strong>name</strong> – název zařízení</li>
                    <li><strong>equipment_type</strong> – typ zařízení (např. VZV, Zakladač)</li>
                    <li><strong>facility_code</strong> – kód provozovny (musí existovat v systému)</li>
                  </ul>
                  <p className="font-semibold mt-3">Nepovinné sloupce:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                    <li><strong>manufacturer</strong> – výrobce</li>
                    <li><strong>model</strong> – model</li>
                    <li><strong>serial_number</strong> – sériové číslo</li>
                    <li><strong>location</strong> – umístění</li>
                    <li><strong>responsible_person</strong> – odpovědná osoba</li>
                    <li><strong>status</strong> – stav (active/inactive/decommissioned), výchozí: active</li>
                    <li><strong>notes</strong> – poznámky</li>
                  </ul>
                  <p className="text-sm mt-3">
                    <strong>Duplicita:</strong> Zařízení se stejným inventárním číslem = aktualizuje se existující záznam.
                  </p>
                  <p className="text-sm mt-2 text-muted-foreground">
                    <strong>CSV formát:</strong> Delimiter: středník (;), kódování: UTF-8 s BOM
                  </p>
                </div>
              </AlertDescription>
            </Alert>

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
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">Povinné sloupce:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                    <li><strong>inventory_number</strong> – inventární číslo zařízení (musí existovat v systému)</li>
                    <li><strong>deadline_type_name</strong> – název typu lhůty (musí existovat v systému)</li>
                    <li><strong>facility_code</strong> – kód provozovny (musí existovat v systému)</li>
                    <li><strong>last_check_date</strong> – datum poslední kontroly ve formátu YYYY-MM-DD</li>
                  </ul>
                  <p className="font-semibold mt-3">Nepovinné sloupce:</p>
                  <ul className="text-sm list-disc list-inside space-y-1 ml-4">
                    <li><strong>performer</strong> – provádějící osoba/technik</li>
                    <li><strong>company</strong> – servisní/revizní firma</li>
                    <li><strong>note</strong> – poznámka</li>
                  </ul>
                  <p className="text-sm mt-3">
                    <strong>Důležité:</strong> Před importem lhůt se ujistěte, že zařízení a typy lhůt již existují v systému.
                  </p>
                  <p className="text-sm mt-2">
                    <strong>Duplicita:</strong> Stejné zařízení + typ lhůty = aktualizuje se existující záznam (overwrite).
                  </p>
                  <p className="text-sm mt-2 text-muted-foreground">
                    <strong>CSV formát:</strong> Delimiter: středník (;), kódování: UTF-8 s BOM
                  </p>
                </div>
              </AlertDescription>
            </Alert>

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
                    <p className="text-sm text-center text-muted-foreground">
                      Importuji... {equipmentProgress}%
                    </p>
                  </div>
                )}

                {equipmentResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Import dokončen: {equipmentResult.inserted} vloženo, {equipmentResult.updated} aktualizováno, {equipmentResult.skipped} přeskočeno, {equipmentResult.failed} chyb
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
                    <p className="text-sm text-center text-muted-foreground">
                      Importuji... {deadlineProgress}%
                    </p>
                  </div>
                )}

                {deadlineResult && (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Import dokončen: {deadlineResult.inserted} vloženo, {deadlineResult.updated} aktualizováno, {deadlineResult.skipped} přeskočeno, {deadlineResult.failed} chyb
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
