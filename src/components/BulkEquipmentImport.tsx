import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, AlertCircle, CheckCircle, CheckCircle2, X, FileDown, RefreshCw, AlertTriangle, StopCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { downloadCSVTemplate } from "@/lib/csvExport";
import { ImportDescription } from "@/components/ImportDescription";

const equipmentSchema = z.object({
  inventoryNumber: z.string().min(1, "Inventární číslo je povinné").max(100),
  name: z.string().min(1, "Název je povinný").max(255),
  equipmentType: z.string().min(1, "Typ zařízení je povinný").max(100),
  facility: z.string().min(1, "Provozovna je povinná").max(50),
  status: z.enum(["active", "inactive", "decommissioned"]).optional(),
});

type DuplicateStrategy = 'skip' | 'overwrite';

interface ImportedEquipment {
  data: any;
  isValid: boolean;
  errors: string[];
  rowNumber: number;
  isDuplicate?: boolean;
}

interface BulkEquipmentImportProps {
  onImportComplete?: () => void;
}

const STATUS_MAP: Record<string, string> = {
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

export function BulkEquipmentImport({ onImportComplete }: BulkEquipmentImportProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<ImportedEquipment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('overwrite');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const abortRef = useRef(false);
  const { toast } = useToast();

  const parseFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error("Chyba čtení souboru"));
      reader.readAsArrayBuffer(file);
    });
  };

  const mapRowToEquipment = (row: any) => {
    const rawStatus = String(row['Stav'] || row['status'] || 'active').toLowerCase().trim();
    const rawResponsibles = String(row['Odpovědná osoba'] || row['Odpovědné osoby'] || row['responsible'] || '').trim();
    // Support multiple emails separated by ; or ,
    const responsibleEmails = rawResponsibles
      ? rawResponsibles.split(/[;,]/).map((e: string) => e.trim().toLowerCase()).filter(Boolean)
      : [];
    const resolvedStatus = STATUS_MAP[rawStatus] || null;
    return {
      inventoryNumber: String(row['Inv. číslo'] || row['Inventární číslo'] || row['inventory_number'] || '').trim(),
      name: String(row['Název'] || row['name'] || '').trim(),
      equipmentType: String(row['Typ'] || row['Typ zařízení'] || row['equipment_type'] || '').trim(),
      facility: String(row['Provozovna'] || row['facility'] || '').trim(),
      manufacturer: String(row['Výrobce'] || row['manufacturer'] || '').trim() || null,
      model: String(row['Model'] || row['model'] || '').trim() || null,
      serialNumber: String(row['Sériové číslo'] || row['Sériové č.'] || row['serial_number'] || '').trim() || null,
      location: String(row['Umístění'] || row['location'] || '').trim() || null,
      department: String(row['Středisko'] || row['department'] || '').trim() || null,
      status: resolvedStatus || 'active',
      _statusUnknown: !resolvedStatus && rawStatus !== '' && rawStatus !== 'active',
      _rawStatus: rawStatus,
      notes: String(row['Poznámka'] || row['notes'] || '').trim() || null,
      responsibleEmails,
    };
  };

  const validateAndMarkDuplicates = async (rows: any[]): Promise<ImportedEquipment[]> => {
    const [
      { data: existingEquipment },
      { data: facilities },
      { data: departments },
      { data: profiles },
    ] = await Promise.all([
      supabase.from("equipment").select("id, inventory_number, equipment_type, manufacturer, serial_number").limit(50000),
      supabase.from("facilities").select("id, code, name").limit(10000),
      supabase.from("departments").select("id, code, name").limit(10000),
      supabase.from("profiles").select("id, email").limit(50000),
    ]);

    const facilityByCode = new Map((facilities || []).map(f => [f.code.toLowerCase(), f]));
    const facilityByName = new Map((facilities || []).map(f => [f.name.toLowerCase(), f]));
    const deptByCode = new Map((departments || []).map(d => [d.code.toLowerCase(), d]));
    const deptByName = new Map((departments || []).map(d => [d.name.toLowerCase(), d]));
    const profileByEmail = new Map((profiles || []).map(p => [p.email.toLowerCase(), p.id]));

    const seenInvNumbers = new Map<string, number>();

    return rows.map((row, index) => {
      const eqData = mapRowToEquipment(row);
      const errors: string[] = [];

      // Unknown status warning
      if (eqData._statusUnknown) {
        errors.push(`Neznámý stav "${eqData._rawStatus}" – použit výchozí "active"`);
      }

      const validation = equipmentSchema.safeParse(eqData);
      if (!validation.success) {
        errors.push(...validation.error.errors.map(e => e.message));
      }

      // Facility validation
      const facKey = eqData.facility.toLowerCase();
      const fac = facilityByCode.get(facKey) || facilityByName.get(facKey);
      if (!fac && eqData.facility) {
        errors.push(`Provozovna "${eqData.facility}" neexistuje v systému`);
      }

      // Department validation (optional)
      let departmentId: string | null = null;
      if (eqData.department) {
        const deptKey = eqData.department.toLowerCase();
        const dept = deptByCode.get(deptKey) || deptByName.get(deptKey);
        if (!dept) {
          errors.push(`Středisko "${eqData.department}" neexistuje v systému`);
        } else {
          departmentId = dept.id;
        }
      }

      // Responsible persons validation
      const resolvedProfileIds: string[] = [];
      const unresolvedEmails: string[] = [];
      for (const email of eqData.responsibleEmails) {
        const profileId = profileByEmail.get(email);
        if (profileId) {
          resolvedProfileIds.push(profileId);
        } else {
          unresolvedEmails.push(email);
        }
      }
      if (unresolvedEmails.length > 0) {
        errors.push(`Odpovědné osoby nenalezeny: ${unresolvedEmails.join(', ')}`);
      }

      // In-file duplicate check
      const invKey = eqData.inventoryNumber.toLowerCase();
      if (seenInvNumbers.has(invKey)) {
        errors.push(`Duplicitní inv. číslo v souboru (řádek ${seenInvNumbers.get(invKey)})`);
      } else if (invKey) {
        seenInvNumbers.set(invKey, index + 2);
      }

      // DB duplicate check - inv number AND type must both match
      const isDuplicate = (existingEquipment || []).some(e => {
        if (e.inventory_number.toLowerCase() !== invKey) return false;
        // Type must always match for duplicate detection
        if ((e.equipment_type || '').toLowerCase() !== (eqData.equipmentType || '').toLowerCase()) return false;
        if (eqData.manufacturer && e.manufacturer?.toLowerCase() !== eqData.manufacturer.toLowerCase()) return false;
        if (eqData.serialNumber && e.serial_number?.toLowerCase() !== eqData.serialNumber.toLowerCase()) return false;
        return true;
      });

      return {
        data: {
          ...eqData,
          _facilityCode: fac?.code || null,
          _departmentId: departmentId,
          _responsibleProfileIds: resolvedProfileIds,
        },
        isValid: errors.length === 0,
        errors,
        rowNumber: index + 2,
        isDuplicate,
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Soubor je příliš velký", description: "Maximální velikost je 5MB.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const jsonData = await parseFile(file);
      if (jsonData.length > 5000) {
        toast({ title: "Příliš mnoho řádků", description: "Maximální počet řádků je 5000.", variant: "destructive" });
        setIsProcessing(false);
        e.target.value = '';
        return;
      }

      const validatedData = await validateAndMarkDuplicates(jsonData);
      setImportedData(validatedData);
      setImportResult(null);
      setDialogOpen(true);

      const validCount = validatedData.filter(d => d.isValid).length;
      const dupeCount = validatedData.filter(d => d.isDuplicate).length;
      toast({
        title: "Soubor načten",
        description: `${validatedData.length} záznamů. ${validCount} platných, ${dupeCount} duplicitních.`,
      });
    } catch {
      toast({ title: "Chyba při zpracování", description: "Soubor nemá správný formát.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleImport = async () => {
    const validData = importedData.filter(d => d.isValid);
    if (validData.length === 0) return;

    const toInsert = validData.filter(d => !d.isDuplicate);
    const toUpdate = duplicateStrategy === 'overwrite' ? validData.filter(d => d.isDuplicate) : [];
    const totalOps = toInsert.length + toUpdate.length;

    if (totalOps === 0) {
      toast({ title: "Nic k importu", description: "Všechny záznamy jsou duplicitní a strategie je 'Přeskočit'." });
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: totalOps });
    setImportResult(null);
    setImportErrors([]);
    abortRef.current = false;

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Load existing for update matching
    const { data: existingEquipment } = await supabase
      .from("equipment")
      .select("id, inventory_number, equipment_type, manufacturer, serial_number")
      .limit(50000);

    // Get current user for created_by
    const { data: currentUser } = await supabase.auth.getUser();
    const currentUserId = currentUser.user?.id || null;

    // Batch INSERT - use .select() to get back IDs for responsible assignment
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      if (abortRef.current) break;
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const insertRows = batch.map(item => ({
        inventory_number: item.data.inventoryNumber,
        name: item.data.name,
        equipment_type: item.data.equipmentType,
        facility: item.data._facilityCode || item.data.facility,
        department_id: item.data._departmentId || null,
        manufacturer: item.data.manufacturer || null,
        model: item.data.model || null,
        serial_number: item.data.serialNumber || null,
        location: item.data.location || null,
        status: item.data.status,
        notes: item.data.notes || null,
      }));

      const { data: inserted, error } = await supabase.from("equipment").insert(insertRows).select("id, inventory_number");
      if (error) {
        for (const item of batch) {
          if (abortRef.current) break;

          const singleRow = {
            inventory_number: item.data.inventoryNumber,
            name: item.data.name,
            equipment_type: item.data.equipmentType,
            facility: item.data._facilityCode || item.data.facility,
            department_id: item.data._departmentId || null,
            manufacturer: item.data.manufacturer || null,
            model: item.data.model || null,
            serial_number: item.data.serialNumber || null,
            location: item.data.location || null,
            status: item.data.status,
            notes: item.data.notes || null,
          };

          const { data: singleInserted, error: rowError } = await supabase
            .from("equipment")
            .insert([singleRow])
            .select("id")
            .maybeSingle();

          if (rowError) {
            errorCount++;
            errors.push(`Řádek ${item.rowNumber} (${item.data.inventoryNumber}): ${rowError.message || 'Neznámá chyba při vkládání'}`);
          } else {
            insertedCount++;
            const profileIds: string[] = item.data._responsibleProfileIds || [];
            if (profileIds.length > 0 && singleInserted?.id) {
              const responsiblesData = profileIds.map(profileId => ({
                equipment_id: singleInserted.id,
                profile_id: profileId,
                created_by: currentUserId,
              }));
              await supabase.from("equipment_responsibles").insert(responsiblesData);
            }
          }
        }
      } else {
        insertedCount += batch.length;
        // Assign responsible persons for newly inserted equipment
        if (inserted) {
          for (let j = 0; j < batch.length; j++) {
            const profileIds: string[] = batch[j].data._responsibleProfileIds || [];
            if (profileIds.length > 0 && inserted[j]) {
              const responsiblesData = profileIds.map(profileId => ({
                equipment_id: inserted[j].id,
                profile_id: profileId,
                created_by: currentUserId,
              }));
              await supabase.from("equipment_responsibles").insert(responsiblesData);
            }
          }
        }
      }
      setImportProgress({ current: Math.min(i + BATCH_SIZE, toInsert.length), total: totalOps });
    }

    // UPDATE duplicates one by one
    for (let i = 0; i < toUpdate.length; i++) {
      if (abortRef.current) break;
      const item = toUpdate[i];
      const invKey = item.data.inventoryNumber.toLowerCase();
      
      const existing = (existingEquipment || []).find(e => {
        if (e.inventory_number.toLowerCase() !== invKey) return false;
        if (item.data.equipmentType && e.equipment_type?.toLowerCase() !== item.data.equipmentType.toLowerCase()) return false;
        if (item.data.manufacturer && e.manufacturer?.toLowerCase() !== item.data.manufacturer.toLowerCase()) return false;
        if (item.data.serialNumber && e.serial_number?.toLowerCase() !== item.data.serialNumber.toLowerCase()) return false;
        return true;
      });

      if (!existing) {
        errorCount++;
        errors.push(`Řádek ${item.rowNumber} (${item.data.inventoryNumber}): Nelze najít existující záznam pro aktualizaci`);
        continue;
      }

      const { error } = await supabase.from("equipment").update({
        name: item.data.name,
        equipment_type: item.data.equipmentType,
        facility: item.data._facilityCode || item.data.facility,
        department_id: item.data._departmentId || null,
        manufacturer: item.data.manufacturer || null,
        model: item.data.model || null,
        serial_number: item.data.serialNumber || null,
        location: item.data.location || null,
        status: item.data.status,
        notes: item.data.notes || null,
      }).eq("id", existing.id);

      if (error) {
        errorCount++;
        errors.push(`Řádek ${item.rowNumber} (${item.data.inventoryNumber}): ${error.message || 'Neznámá chyba při aktualizaci'}`);
      } else {
        updatedCount++;
        // Reassign responsible persons for updated equipment
        const profileIds: string[] = item.data._responsibleProfileIds || [];
        if (profileIds.length > 0) {
          // Delete existing responsibles and insert new ones
          await supabase.from("equipment_responsibles").delete().eq("equipment_id", existing.id);
          const responsiblesData = profileIds.map(profileId => ({
            equipment_id: existing.id,
            profile_id: profileId,
            created_by: currentUserId,
          }));
          await supabase.from("equipment_responsibles").insert(responsiblesData);
        }
      }
      setImportProgress({ current: toInsert.length + i + 1, total: totalOps });
    }

    setIsImporting(false);
    const skippedCount = duplicateStrategy === 'skip' ? validData.filter(d => d.isDuplicate).length : 0;
    setImportResult({ inserted: insertedCount, updated: updatedCount, skipped: skippedCount, failed: errorCount });
    setImportErrors(errors);

    toast({
      title: errorCount > 0 ? "Import dokončen s chybami" : "Import dokončen",
      description: `Úspěšně: ${insertedCount + updatedCount}, chyby: ${errorCount}`,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    onImportComplete?.();
  };

  const handleReImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const jsonData = await parseFile(file);
      const validatedData = await validateAndMarkDuplicates(jsonData);
      setImportedData(validatedData);
      setImportResult(null);
      toast({ title: "Soubor znovu načten", description: `${validatedData.length} záznamů, ${validatedData.filter(d => d.isValid).length} platných.` });
    } catch {
      toast({ title: "Chyba při zpracování", description: "Soubor nemá správný formát.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const exportErrors = () => {
    const errorData = importedData
      .filter(d => !d.isValid)
      .map(d => ({
        'Inv. číslo': d.data.inventoryNumber,
        'Název': d.data.name,
        'Typ': d.data.equipmentType,
        'Provozovna': d.data.facility,
        'Výrobce': d.data.manufacturer || '',
        'Sériové číslo': d.data.serialNumber || '',
        '_chyby': d.errors.join('; '),
        '_řádek': d.rowNumber,
      }));

    if (errorData.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(errorData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chyby");
    XLSX.writeFile(wb, `chyby_import_zarizeni_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const validCount = importedData.filter(d => d.isValid).length;
  const invalidCount = importedData.filter(d => !d.isValid).length;
  const duplicateCount = importedData.filter(d => d.isDuplicate && d.isValid).length;
  const newCount = importedData.filter(d => !d.isDuplicate && d.isValid).length;

  const handleDownloadTemplate = () => {
    downloadCSVTemplate("sablona_import_zarizeni.csv", [
      {
        "Inv. číslo": "Z001",
        "Název": "Svářečka MIG 250",
        "Typ": "Svářečka",
        "Provozovna": "HL",
        "Výrobce": "Fronius",
        "Model": "TransSteel 2500",
        "Sériové číslo": "SN-12345",
        "Umístění": "Hala A",
        "Středisko": "VYR",
        "Stav": "aktivní",
        "Odpovědná osoba": "jan.novak@firma.cz",
        "Poznámka": "",
      },
      {
        "Inv. číslo": "Z002",
        "Název": "Kompresor 500L",
        "Typ": "Kompresor",
        "Provozovna": "HL",
        "Výrobce": "Atlas Copco",
        "Model": "GA 30+",
        "Sériové číslo": "AC-67890",
        "Umístění": "Strojovna",
        "Středisko": "UD",
        "Stav": "aktivní",
        "Odpovědná osoba": "karel.dvorak@firma.cz; marie.nova@firma.cz",
        "Poznámka": "Pravidelný servis",
      },
    ]);
  };

  return (
    <>
      <input
        type="file"
        id="equipment-import"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        className="hidden"
      />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
          <FileDown className="w-4 h-4 mr-2" />
          Šablona CSV
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById('equipment-import')?.click()}
          disabled={isProcessing}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isProcessing ? "Zpracovávám..." : "Import zařízení"}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!isImporting) setDialogOpen(open); }}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Náhled importu zařízení</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <ImportDescription
              requiredColumns={[
                { name: "Inv. číslo", description: "inventární číslo zařízení (unikátní identifikátor)" },
                { name: "Název", description: "název zařízení" },
                { name: "Typ", description: "typ zařízení (např. Svářečka, Kompresor)" },
                { name: "Provozovna", description: "kód nebo název provozovny" },
              ]}
              optionalColumns={[
                { name: "Výrobce", description: "výrobce zařízení" },
                { name: "Model", description: "model zařízení" },
                { name: "Sériové číslo", description: "sériové číslo" },
                { name: "Umístění", description: "fyzické umístění" },
                { name: "Středisko", description: "kód nebo název střediska" },
                { name: "Stav", description: "aktivní / neaktivní / vyřazeno" },
                { name: "Odpovědná osoba", description: "email uživatele (více emailů oddělte středníkem)" },
                { name: "Poznámka", description: "volitelná poznámka" },
              ]}
              duplicateInfo="Podle inv. čísla + typu + výrobce + sériového čísla (pokud jsou vyplněny)"
            />

            {importedData.length >= 1000 && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  Velký dataset ({importedData.length} řádků). Import může trvat delší dobu.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-medium">{newCount} nových</span>
              </div>
              {duplicateCount > 0 && (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-600" />
                  <span className="font-medium">{duplicateCount} duplicitních</span>
                </div>
              )}
              {invalidCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <span className="font-medium">{invalidCount} s chybami</span>
                </div>
              )}
            </div>

            {duplicateCount > 0 && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <span className="text-sm font-medium">Duplicitní záznamy:</span>
                <Button
                  variant={duplicateStrategy === 'overwrite' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDuplicateStrategy('overwrite')}
                >
                  Přepsat ({duplicateCount})
                </Button>
                <Button
                  variant={duplicateStrategy === 'skip' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDuplicateStrategy('skip')}
                >
                  Přeskočit
                </Button>
              </div>
            )}

            {invalidCount > 0 && (
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={exportErrors}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Exportovat chyby
                </Button>
                <input
                  type="file"
                  id="equipment-reimport"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleReImport}
                  className="hidden"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => document.getElementById('equipment-reimport')?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Nahrát opravený soubor
                </Button>
              </div>
            )}

            {isImporting && (
              <div className="space-y-2">
                <Progress value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0} />
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Importuji... {importProgress.current} / {importProgress.total}
                  </p>
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

            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-[50vh] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Ř.</TableHead>
                      <TableHead>Inv. číslo</TableHead>
                      <TableHead>Název</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Provozovna</TableHead>
                      <TableHead>Výrobce</TableHead>
                       <TableHead>Sériové č.</TableHead>
                      <TableHead>Umístění</TableHead>
                      <TableHead>Odp. osoba</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importedData.map((item, index) => (
                      <TableRow
                        key={index}
                        className={
                          !item.isValid ? "bg-destructive/5" :
                          item.isDuplicate ? "bg-amber-50 dark:bg-amber-950/20" : ""
                        }
                      >
                        <TableCell className="font-mono text-xs">{item.rowNumber}</TableCell>
                        <TableCell className="font-mono">{item.data.inventoryNumber}</TableCell>
                        <TableCell>{item.data.name}</TableCell>
                        <TableCell>{item.data.equipmentType}</TableCell>
                        <TableCell>{item.data.facility}</TableCell>
                        <TableCell className="text-sm">{item.data.manufacturer || '-'}</TableCell>
                        <TableCell className="text-sm">{item.data.serialNumber || '-'}</TableCell>
                        <TableCell className="text-sm">{item.data.location || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.data.responsibleEmails?.join(', ') || '-'}</TableCell>
                        <TableCell>
                          {!item.isValid ? (
                            <Badge variant="destructive">
                              <X className="w-3 h-3 mr-1" />
                              Chyba
                            </Badge>
                          ) : item.isDuplicate ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200">
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Duplikát
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Nový
                            </Badge>
                          )}
                          {!item.isValid && (
                            <div className="text-xs text-destructive mt-1">
                              {item.errors.join(", ")}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isImporting}>
                Zrušit
              </Button>
              <Button
                onClick={handleImport}
                disabled={validCount === 0 || isImporting}
              >
                {isImporting ? "Importuji..." : `Importovat (${duplicateStrategy === 'overwrite' ? validCount : newCount})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
