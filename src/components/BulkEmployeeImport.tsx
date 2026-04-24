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
import Papa from 'papaparse';
import { z } from 'zod';
import { downloadCSVTemplate } from "@/lib/csvExport";

const employeeSchema = z.object({
  firstName: z.string().min(1, "Jméno je povinné").max(100),
  lastName: z.string().min(1, "Příjmení je povinné").max(100),
  email: z.string().email("Neplatný email").max(255),
  employeeNumber: z.string().min(1, "Osobní číslo je povinné").max(50),
  position: z.string().min(1, "Pozice je povinná").max(100),
  department: z.string().min(1, "Středisko je povinné").max(50),
  status: z.enum(["employed", "parental_leave", "sick_leave", "terminated"]),
  managerEmail: z.string().email("Neplatný email nadřízeného").max(255).optional().or(z.literal('')),
  workCategory: z.enum(['1', '2', '2R', '3', '4']).optional().or(z.literal('')).or(z.undefined()),
});

type DuplicateStrategy = 'skip' | 'overwrite';

interface ImportedEmployee {
  data: any;
  isValid: boolean;
  errors: string[];
  rowNumber: number;
  isDuplicate?: boolean;
}

interface BulkEmployeeImportProps {
  onImportComplete?: () => void;
}

export function BulkEmployeeImport({ onImportComplete }: BulkEmployeeImportProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importedData, setImportedData] = useState<ImportedEmployee[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('overwrite');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [importErrorsList, setImportErrorsList] = useState<string[]>([]);
  const abortRef = useRef(false);
  const { toast } = useToast();

  const parseFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        delimiter: "",
        complete: (results) => resolve(results.data as any[]),
        error: (error) => reject(error),
      });
    });
  };

  const parseBirthDate = (raw: any): string | null => {
    if (!raw) return null;
    // Handle Excel Date objects
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      const y = raw.getFullYear();
      const m = String(raw.getMonth() + 1).padStart(2, '0');
      const d = String(raw.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    const str = String(raw).trim();
    if (!str) return null;
    // DD.MM.YYYY
    const czMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (czMatch) return `${czMatch[3]}-${czMatch[2].padStart(2, '0')}-${czMatch[1].padStart(2, '0')}`;
    // YYYY-MM-DD
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) return str;
    return null;
  };

  const EMPLOYEE_STATUS_MAP: Record<string, string> = {
    'aktivní': 'employed',
    'employed': 'employed',
    'mateřská/rodičovská': 'parental_leave',
    'mateřská': 'parental_leave',
    'rodičovská': 'parental_leave',
    'parental_leave': 'parental_leave',
    'nemocenská': 'sick_leave',
    'dpn': 'sick_leave',
    'sick_leave': 'sick_leave',
    'ukončený': 'terminated',
    'ukončen': 'terminated',
    'terminated': 'terminated',
    'neaktivní': 'terminated',
  };

  const parseDepartmentCode = (raw: string): string => {
    // Handle "Kód - Název" format from export (e.g., "IT - IT oddělení" → "IT")
    const dashMatch = raw.match(/^([^\s-]+)\s*-\s*.+$/);
    if (dashMatch) return dashMatch[1].trim();
    return raw;
  };

  const mapRowToEmployee = (row: any) => {
    const rawCategory = row['Kategorie práce'] || row['Kategorie'] || row['workCategory'] || row['work_category'];
    const workCategory = rawCategory ? String(rawCategory).trim().toUpperCase().replace(/^kategorie\s+/i, '') : undefined;
    const rawStatus = String(row['Stav'] || row['status'] || 'employed').toLowerCase().trim();
    const resolvedStatus = EMPLOYEE_STATUS_MAP[rawStatus] || null;

    return {
      firstName: String(row['Jméno'] || row['firstName'] || '').trim(),
      lastName: String(row['Příjmení'] || row['lastName'] || '').trim(),
      email: String(row['Email'] || row['email'] || '').trim().toLowerCase(),
      employeeNumber: String(row['Osobní číslo'] || row['employeeNumber'] || row['employee_number'] || '').trim(),
      position: String(row['Pozice'] || row['position'] || '').trim(),
      department: parseDepartmentCode(String(row['Středisko'] || row['department'] || '').trim()),
      status: resolvedStatus || 'employed',
      _statusUnknown: !resolvedStatus && rawStatus !== '' && rawStatus !== 'employed' && rawStatus !== 'aktivní',
      _rawStatus: rawStatus,
      managerEmail: String(row['Email nadřízeného'] || row['managerEmail'] || row['Manager Email'] || row['manager_email'] || '').trim().toLowerCase(),
      workCategory: workCategory && ['1', '2', '2R', '3', '4'].includes(workCategory) ? workCategory : undefined,
      birthDate: parseBirthDate(row['Datum narození'] || row['birthDate'] || row['birth_date']),
    };
  };

  const validateAndMarkDuplicates = async (rows: any[]): Promise<ImportedEmployee[]> => {
    // Load existing employees for duplicate detection
    const { data: existingEmployees } = await supabase
      .from("employees")
      .select("id, employee_number, email")
      .limit(50000);

    const existingByNumber = new Map(
      (existingEmployees || []).filter(e => e.employee_number).map(e => [(e.employee_number!).toLowerCase(), e.id])
    );
    const existingByEmail = new Map(
      (existingEmployees || []).map(e => [e.email.toLowerCase(), e.id])
    );

    // Load departments for validation
    const { data: departments } = await supabase
      .from("departments")
      .select("id, code, name")
      .limit(10000);

    const deptByCode = new Map(
      (departments || []).map(d => [d.code.toLowerCase(), d])
    );
    const deptByName = new Map(
      (departments || []).map(d => [d.name.toLowerCase(), d])
    );

    // Check for in-file duplicates
    const seenNumbers = new Map<string, number>();

    return rows.map((row, index) => {
      const employeeData = mapRowToEmployee(row);
      const errors: string[] = [];

      // Unknown status warning
      if (employeeData._statusUnknown) {
        errors.push(`Neznámý stav "${employeeData._rawStatus}" – použit výchozí "employed"`);
      }

      // Zod validation
      const validation = employeeSchema.safeParse(employeeData);
      if (!validation.success) {
        errors.push(...validation.error.errors.map(e => e.message));
      }

      // Department validation
      const deptKey = employeeData.department.toLowerCase();
      const dept = deptByCode.get(deptKey) || deptByName.get(deptKey);
      if (!dept && employeeData.department) {
        errors.push(`Středisko "${employeeData.department}" neexistuje v systému`);
      }

      // In-file duplicate check
      const numKey = employeeData.employeeNumber.toLowerCase();
      if (seenNumbers.has(numKey)) {
        errors.push(`Duplicitní osobní číslo v souboru (řádek ${seenNumbers.get(numKey)})`);
      } else {
        seenNumbers.set(numKey, index + 2);
      }

      // DB duplicate check
      const isDuplicate = existingByNumber.has(numKey) || existingByEmail.has(employeeData.email);

      return {
        data: { ...employeeData, _departmentId: dept?.id || null },
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

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
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

      if (jsonData.length > 1000) {
        toast({ title: "Velký soubor", description: `Soubor obsahuje ${jsonData.length} řádků. Validace může trvat déle.` });
      }

      const validatedData = await validateAndMarkDuplicates(jsonData);
      setImportedData(validatedData);
      setDialogOpen(true);

      const validCount = validatedData.filter(d => d.isValid).length;
      const dupeCount = validatedData.filter(d => d.isDuplicate).length;
      toast({
        title: "Soubor načten",
        description: `${validatedData.length} záznamů. ${validCount} platných, ${dupeCount} duplicitních.`,
      });
    } catch (error) {
      toast({ title: "Chyba při zpracování", description: "Soubor nemá správný formát.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const handleImport = async () => {
    const validData = importedData.filter(d => d.isValid);
    if (validData.length === 0) return;

    // Separate new vs duplicate records
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
    setImportErrorsList([]);
    abortRef.current = false;

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const importErrors: string[] = [];

    // Load existing employees for update matching
    const { data: existingEmployees } = await supabase
      .from("employees")
      .select("id, employee_number, email")
      .limit(50000);

    const existingByNumber = new Map(
      (existingEmployees || []).filter(e => e.employee_number).map(e => [(e.employee_number!).toLowerCase(), e.id])
    );

    // Batch INSERT new employees (batches of 50)
    const BATCH_SIZE = 50;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      if (abortRef.current) break;
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const insertRows = batch.map(item => ({
        first_name: item.data.firstName,
        last_name: item.data.lastName,
        email: item.data.email,
        employee_number: item.data.employeeNumber,
        position: item.data.position,
        department_id: item.data._departmentId || null,
        status: item.data.status,
        work_category: item.data.workCategory || null,
        birth_date: item.data.birthDate || null,
      }));

      const { error } = await supabase.from("employees").insert(insertRows);
      if (error) {
        for (const item of batch) {
          if (abortRef.current) break;
          const singleRow = {
            first_name: item.data.firstName,
            last_name: item.data.lastName,
            email: item.data.email,
            employee_number: item.data.employeeNumber,
            position: item.data.position,
            department_id: item.data._departmentId || null,
            status: item.data.status,
            work_category: item.data.workCategory || null,
            birth_date: item.data.birthDate || null,
          };

          const { error: rowError } = await supabase.from("employees").insert([singleRow]);
          if (rowError) {
            errorCount++;
            importErrors.push(`Řádek ${item.rowNumber} (${item.data.employeeNumber || item.data.email}): ${rowError.message || 'Neznámá chyba při vkládání'}`);
          } else {
            insertedCount++;
          }
        }
      } else {
        insertedCount += batch.length;
      }
      setImportProgress({ current: Math.min(i + BATCH_SIZE, toInsert.length), total: totalOps });
    }

    // UPDATE duplicates one by one (need individual IDs)
    for (let i = 0; i < toUpdate.length; i++) {
      if (abortRef.current) break;
      const item = toUpdate[i];
      const existingId = existingByNumber.get(item.data.employeeNumber.toLowerCase());
      if (!existingId) {
        errorCount++;
        importErrors.push(`Řádek ${item.rowNumber}: Nelze najít existující záznam pro update`);
        continue;
      }

      const { error } = await supabase.from("employees").update({
        first_name: item.data.firstName,
        last_name: item.data.lastName,
        email: item.data.email,
        position: item.data.position,
        department_id: item.data._departmentId || null,
        status: item.data.status,
        work_category: item.data.workCategory || null,
        birth_date: item.data.birthDate || null,
      }).eq("id", existingId);

      if (error) {
        errorCount++;
        importErrors.push(`Řádek ${item.rowNumber}: ${error.message}`);
      } else {
        updatedCount++;
      }
      setImportProgress({ current: toInsert.length + i + 1, total: totalOps });
    }

    // Resolve manager hierarchy: match managerEmail → employee.email → set manager_employee_id
    try {
      const { data: allEmps } = await supabase
        .from("employees")
        .select("id, email")
        .limit(50000);

      if (allEmps) {
        const emailToId = new Map(allEmps.map(e => [e.email.toLowerCase(), e.id]));
        
        // Find imported employees that have managerEmail but no manager_employee_id
        const itemsWithManagerEmail = validData.filter(d => d.data.managerEmail);
        for (const item of itemsWithManagerEmail) {
          const managerId = emailToId.get(item.data.managerEmail!.toLowerCase());
          if (managerId) {
            // Find this employee's ID by email
            const empId = emailToId.get(item.data.email.toLowerCase());
            if (empId && empId !== managerId) {
              await supabase
                .from("employees")
                .update({ manager_employee_id: managerId })
                .eq("id", empId)
                .is("manager_employee_id", null);
            }
          }
        }
      }
    } catch {
      // Non-critical - hierarchy can be resolved later
    }

    setIsImporting(false);

    const skippedCount = duplicateStrategy === 'skip' ? validData.filter(d => d.isDuplicate).length : 0;
    setImportResult({ inserted: insertedCount, updated: updatedCount, skipped: skippedCount, failed: errorCount });
    setImportErrorsList(importErrors);

    if (errorCount > 0) {
      toast({
        title: "Import dokončen s chybami",
        description: `Úspěšně: ${insertedCount + updatedCount}, chyby: ${errorCount}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Import dokončen",
        description: `Úspěšně importováno ${insertedCount + updatedCount} zaměstnanců.`,
      });
    }

    onImportComplete?.();
  };

  const handleReImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast({ title: "Soubor je příliš velký", description: "Maximální velikost je 5MB.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const jsonData = await parseFile(file);
      const validatedData = await validateAndMarkDuplicates(jsonData);
      setImportedData(validatedData);

      const validCount = validatedData.filter(d => d.isValid).length;
      toast({ title: "Soubor znovu načten", description: `${validatedData.length} záznamů, ${validCount} platných.` });
    } catch (error) {
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
        'Jméno': d.data.firstName,
        'Příjmení': d.data.lastName,
        'Email': d.data.email,
        'Osobní číslo': d.data.employeeNumber,
        'Pozice': d.data.position,
        'Středisko': d.data.department,
        'Stav': d.data.status,
        'Email nadřízeného': d.data.managerEmail,
        '_chyby': d.errors.join('; '),
        '_řádek': d.rowNumber,
      }));

    if (errorData.length === 0) {
      toast({ title: "Žádné chyby", description: "Žádné chybné záznamy k exportu." });
      return;
    }

    const csv = Papa.unparse(errorData, { delimiter: ";" });
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = buildExportFilename("zamestnanci-chyby");
    link.click();

    toast({ title: "Export dokončen", description: `Exportováno ${errorData.length} chybných záznamů.` });
  };

  const validCount = importedData.filter(d => d.isValid).length;
  const invalidCount = importedData.filter(d => !d.isValid).length;
  const duplicateCount = importedData.filter(d => d.isDuplicate && d.isValid).length;
  const newCount = importedData.filter(d => !d.isDuplicate && d.isValid).length;

  const handleDownloadTemplate = () => {
    downloadCSVTemplate("sablona_import_zamestnancu.csv", [
      {
        "Jméno": "Jan",
        "Příjmení": "Novák",
        "Email": "jan.novak@firma.cz",
        "Osobní číslo": "E001",
        "Pozice": "Technik",
        "Středisko": "IT",
        "Stav": "aktivní",
        "Datum narození": "15.03.1985",
        "Kategorie práce": 2,
        "Email nadřízeného": "karel.dvorak@firma.cz",
        "Poznámka": ""
      },
      {
        "Jméno": "Marie",
        "Příjmení": "Svobodová",
        "Email": "marie.svobodova@firma.cz",
        "Osobní číslo": "E002",
        "Pozice": "Účetní",
        "Středisko": "FIN",
        "Stav": "aktivní",
        "Datum narození": "22.07.1990",
        "Kategorie práce": 1,
        "Email nadřízeného": "",
        "Poznámka": "Nová zaměstnankyně"
      },
      {
        "Jméno": "Petr",
        "Příjmení": "Černý",
        "Email": "petr.cerny@firma.cz",
        "Osobní číslo": "E003",
        "Pozice": "Skladník",
        "Středisko": "SKLAD",
        "Stav": "aktivní",
        "Datum narození": "01.12.1978",
        "Kategorie práce": 3,
        "Email nadřízeného": "jan.novak@firma.cz",
        "Poznámka": ""
      }
    ]);
  };

  return (
    <>
      <input
        type="file"
        id="employee-import"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => document.getElementById('employee-import')?.click()}
          disabled={isProcessing}
          title={CSV_IMPORT_TOOLTIP}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isProcessing ? "Zpracovávám..." : "Import"}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!isImporting) setDialogOpen(open); }}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Náhled importu zaměstnanců</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Large dataset warning */}
            {importedData.length >= 1000 && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 dark:text-amber-300">
                  Velký dataset ({importedData.length} řádků). Import může trvat delší dobu. Můžete jej kdykoli zastavit.
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
                  id="employee-reimport"
                  accept=".csv"
                  onChange={handleReImport}
                  className="hidden"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => document.getElementById('employee-reimport')?.click()}
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

            {/* Import result */}
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
                  {importErrorsList.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-medium text-destructive">Detail chyb:</p>
                      <ul className="text-sm text-destructive list-disc list-inside max-h-[150px] overflow-y-auto">
                        {importErrorsList.map((err, i) => (
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
                      <TableHead>Jméno</TableHead>
                      <TableHead>Příjmení</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Os. číslo</TableHead>
                      <TableHead>Pozice</TableHead>
                      <TableHead>Středisko</TableHead>
                      <TableHead>Nadřízený</TableHead>
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
                        <TableCell>{item.data.firstName}</TableCell>
                        <TableCell>{item.data.lastName}</TableCell>
                        <TableCell className="text-sm">{item.data.email}</TableCell>
                        <TableCell className="font-mono">{item.data.employeeNumber}</TableCell>
                        <TableCell className="text-sm">{item.data.position}</TableCell>
                        <TableCell className="font-mono text-sm">{item.data.department}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{item.data.managerEmail || '-'}</TableCell>
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
