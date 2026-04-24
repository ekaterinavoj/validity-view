import { useState, useMemo, useRef } from "react";
import {
  Plus, RefreshCw, Edit, Trash2, Search, Clock, Download, Upload, Loader2, CheckCircle2, AlertCircle, AlertTriangle,
} from "lucide-react";
import { parsePeriodicityText } from "@/lib/utils";
import { formatPeriodicityDual } from "@/components/TypePeriodicityCell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDeadlineTypes } from "@/hooks/useDeadlineTypes";
import { useFacilities } from "@/hooks/useFacilities";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { DeadlineType } from "@/types/equipment";
import { 
  daysToPeriodicityUnit, periodicityToDays, type PeriodicityUnit,
} from "@/components/PeriodicityInput";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { exportToCSV } from "@/lib/csvExport";
import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import { CSV_IMPORT_TOOLTIP, CSV_FORMAT_TOOLTIP } from "@/lib/exportFilename";

export default function DeadlineTypes() {
  const { deadlineTypes, isLoading, error, refetch, createDeadlineType, updateDeadlineType, deleteDeadlineType, isCreating, isUpdating } = useDeadlineTypes();
  const { facilities } = useFacilities();
  const { toast } = useToast();

  const getFacilityName = (code: string): string => {
    const f = facilities.find(fac => fac.code === code);
    return f ? f.name : code;
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeadlineType | null>(null);
  const [formData, setFormData] = useState({
    name: "", facility: "", periodValue: 1, periodUnit: "years" as PeriodicityUnit, description: "",
  });

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<'overwrite' | 'skip'>('overwrite');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredTypes = useMemo(() => {
    return deadlineTypes.filter(t => {
      if (facilityFilter !== "all" && t.facility !== facilityFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(query) || getFacilityName(t.facility).toLowerCase().includes(query) || (t.description || "").toLowerCase().includes(query);
      }
      return true;
    });
  }, [deadlineTypes, searchQuery, facilityFilter]);

  const { preferences } = useUserPreferences();
  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedTypes, totalItems } = usePagination(filteredTypes, preferences.itemsPerPage);

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({ name: "", facility: "", periodValue: 1, periodUnit: "years", description: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (item: DeadlineType) => {
    setEditingItem(item);
    const { value, unit } = daysToPeriodicityUnit(item.period_days);
    setFormData({ name: item.name, facility: item.facility, periodValue: value, periodUnit: unit, description: item.description || "" });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const period_days = periodicityToDays(formData.periodValue, formData.periodUnit);
    const data = { name: formData.name, facility: formData.facility, period_days, description: formData.description || null };
    if (editingItem) { updateDeadlineType({ id: editingItem.id, ...data }); } else { createDeadlineType(data); }
    setDialogOpen(false);
  };

  // ---- Export ----
  const handleExport = () => {
    try {
      const data = deadlineTypes.map(t => ({
        "Název": t.name,
        "Provozovna": getFacilityName(t.facility),
        "Periodicita": formatPeriodicityDual(t.period_days),
        "Popis": t.description || "",
      }));
      const timestamp = new Date().toISOString().split('T')[0];
      exportToCSV({ filename: `typy_udalosti_${timestamp}.csv`, data });
      toast({ title: "Export dokončen", description: `Exportováno ${data.length} typů.` });
    } catch (err: any) {
      toast({ title: "Chyba exportu", description: err.message, variant: "destructive" });
    }
  };

  // ---- Import ----
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

  const resolveFacility = (raw: string): string | null => {
    const key = raw.toLowerCase().trim();
    const f = facilities.find(fac => fac.code.toLowerCase() === key || fac.name.toLowerCase() === key);
    return f?.code || null;
  };

  const parsePeriodDays = (raw: any): number | null => {
    return parsePeriodicityText(raw);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseFile(file);
      const parsed = rows.map((row: any, i: number) => {
        const name = String(row['Název'] || row['name'] || '').trim();
        const rawFacility = String(row['Provozovna'] || row['facility'] || '').trim();
        const facilityCode = resolveFacility(rawFacility);
        const periodDays = parsePeriodDays(row['Periodicita'] || row['Periodicita (dní)'] || row['period_days']);
        const description = String(row['Popis'] || row['description'] || '').trim();
        const errors: string[] = [];
        if (!name) errors.push("Chybí název");
        if (!facilityCode) errors.push(`Provozovna "${rawFacility}" neexistuje`);
        if (!periodDays) errors.push("Chybí nebo neplatná periodicita");
        const isDuplicate = deadlineTypes.some(t => t.name.toLowerCase() === name.toLowerCase() && t.facility === facilityCode);
        return { name, facilityCode, facilityRaw: rawFacility, periodDays, description, errors, rowNumber: i + 2, isDuplicate, isValid: errors.length === 0 };
      });
      setImportPreview(parsed);
      setImportResult(null);
      setImportErrors([]);
      setImportDialogOpen(true);
    } catch (err: any) {
      toast({ title: "Chyba při čtení souboru", description: err.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    const result = { inserted: 0, updated: 0, skipped: 0, failed: 0 };
    const errors: string[] = [];

    for (const row of importPreview) {
      if (!row.isValid) { result.skipped++; continue; }
      if (row.isDuplicate) {
        if (duplicateAction === 'skip') { result.skipped++; continue; }
        const existing = deadlineTypes.find(t => t.name.toLowerCase() === row.name.toLowerCase() && t.facility === row.facilityCode);
        if (existing) {
          try {
            const { error } = await supabase.from("deadline_types").update({ period_days: row.periodDays, description: row.description || null }).eq("id", existing.id);
            if (error) throw error;
            result.updated++;
          } catch (err: any) { result.failed++; errors.push(`Řádek ${row.rowNumber} (${row.name}): ${err.message}`); }
        }
      } else {
        try {
          const { error } = await supabase.from("deadline_types").insert({ name: row.name, facility: row.facilityCode!, period_days: row.periodDays!, description: row.description || null });
          if (error) throw error;
          result.inserted++;
        } catch (err: any) { result.failed++; errors.push(`Řádek ${row.rowNumber} (${row.name}): ${err.message}`); }
      }
    }

    setImportResult(result);
    setImportErrors(errors);
    setIsImporting(false);
    if (result.inserted > 0 || result.updated > 0) refetch();
  };

  if (error) {
    return <ErrorDisplay title="Chyba při načítání typů událostí" message={error.message} onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return <TableSkeleton columns={5} rows={8} />;
  }

  const validRows = importPreview?.filter(r => r.isValid && !r.isDuplicate) || [];
  const duplicateRows = importPreview?.filter(r => r.isValid && r.isDuplicate) || [];
  const invalidRows = importPreview?.filter(r => !r.isValid) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Typy technických událostí</h1>
          <p className="text-muted-foreground">Celkem {filteredTypes.length} typů</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title={CSV_IMPORT_TOOLTIP}>
            <Upload className="w-4 h-4 mr-2" />Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} title={CSV_FORMAT_TOOLTIP}>
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />Obnovit
          </Button>
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />Nový typ
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Hledat typy událostí..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={facilityFilter} onValueChange={setFacilityFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Provozovna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všechny provozovny</SelectItem>
            {facilities.map(f => (
              <SelectItem key={f.id} value={f.code}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Provozovna</TableHead>
                <TableHead>Perioda</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTypes.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground"><Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />Nebyly nalezeny žádné typy událostí</TableCell></TableRow>
              ) : (
                paginatedTypes.map(type => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{getFacilityName(type.facility)}</TableCell>
                    <TableCell>{formatPeriodicityDual(type.period_days)}</TableCell>
                    <TableCell className="text-muted-foreground">{type.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteDeadlineType(type.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={preferences.itemsPerPage} onPageChange={setCurrentPage} />
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingItem ? "Upravit typ události" : "Nový typ události"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Název *</Label>
              <Input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Např. Revize elektro" />
            </div>
            <div className="space-y-2">
              <Label>Provozovna *</Label>
              <Select value={formData.facility} onValueChange={val => setFormData(prev => ({ ...prev, facility: val }))}>
                <SelectTrigger><SelectValue placeholder="Vyberte provozovnu" /></SelectTrigger>
                <SelectContent>{facilities.map(f => <SelectItem key={f.id} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Periodicita *</Label>
              <div className="flex gap-2">
                <Input type="number" min="1" value={formData.periodValue} onChange={e => setFormData(prev => ({ ...prev, periodValue: parseInt(e.target.value) || 1 }))} className="w-24" />
                <Select value={formData.periodUnit} onValueChange={(v) => setFormData(prev => ({ ...prev, periodUnit: v as PeriodicityUnit }))}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Dní</SelectItem>
                    <SelectItem value="months">Měsíců</SelectItem>
                    <SelectItem value="years">Roků</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">= {periodicityToDays(formData.periodValue, formData.periodUnit)} dní celkem</p>
            </div>
            <div className="space-y-2">
              <Label>Popis</Label>
              <Textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Volitelný popis typu události" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>{editingItem ? "Uložit změny" : "Vytvořit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import typů technických událostí</DialogTitle></DialogHeader>
          {importPreview && !importResult && (
            <>
              <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-green-600" /><span className="font-medium">{validRows.length} nových</span></div>
                {duplicateRows.length > 0 && <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-amber-600" /><span className="font-medium">{duplicateRows.length} duplicitních</span></div>}
                {invalidRows.length > 0 && <div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" /><span className="font-medium">{invalidRows.length} chybných</span></div>}
                {duplicateRows.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Button size="sm" variant={duplicateAction === 'overwrite' ? 'default' : 'outline'} onClick={() => setDuplicateAction('overwrite')}>Přepsat</Button>
                    <Button size="sm" variant={duplicateAction === 'skip' ? 'default' : 'outline'} onClick={() => setDuplicateAction('skip')}>Přeskočit</Button>
                  </div>
                )}
              </div>
              <div className="max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Řádek</TableHead><TableHead>Název</TableHead><TableHead>Provozovna</TableHead><TableHead>Periodicita</TableHead><TableHead>Výsledek</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.facilityRaw}</TableCell>
                        <TableCell>{row.periodDays ? `${row.periodDays} dní` : "-"}</TableCell>
                        <TableCell>
                          {!row.isValid ? <Badge variant="destructive">{row.errors.join(", ")}</Badge> : row.isDuplicate ? <Badge variant="outline" className="text-amber-600 border-amber-600">Duplicitní</Badge> : <Badge variant="default">Nový</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleImport} disabled={isImporting}>{isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Importovat</Button>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Zrušit</Button>
              </div>
            </>
          )}
          {importResult && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {importResult.inserted > 0 && <Badge className="bg-green-600">{importResult.inserted} vloženo</Badge>}
                {importResult.updated > 0 && <Badge className="bg-blue-600">{importResult.updated} aktualizováno</Badge>}
                {importResult.skipped > 0 && <Badge variant="secondary">{importResult.skipped} přeskočeno</Badge>}
                {importResult.failed > 0 && <Badge variant="destructive">{importResult.failed} chyb</Badge>}
              </div>
              {importErrors.length > 0 && (
                <div className="p-3 bg-destructive/10 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-destructive">Detail chyb:</p>
                  {importErrors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Zavřít</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
