import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Edit, Plus, Trash2, Loader2, Download, Upload, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPeriodicity, parsePeriodicityText } from "@/lib/utils";
import { useFacilities } from "@/hooks/useFacilities";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { exportToCSV } from "@/lib/csvExport";
import * as XLSX from "xlsx";

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  name: z.string().min(1, "Zadejte název typu školení"),
  periodValue: z.string().min(1, "Zadejte periodicitu"),
  periodUnit: z.enum(["days", "months", "years"]),
  durationHours: z.string().min(1, "Zadejte délku školení v hodinách"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface TrainingType {
  id: string; facility: string; name: string; period_days: number; duration_hours: number | null; description: string | null; created_at: string;
}

export default function TrainingTypes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TrainingType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<TrainingType | null>(null);
  const [trainingTypes, setTrainingTypes] = useState<TrainingType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { facilities, loading: facilitiesLoading } = useFacilities();
  const [searchQuery, setSearchQuery] = useState("");
  const [facilityFilter, setFacilityFilter] = useState<string>("all");
  const { preferences } = useUserPreferences();

  const filteredTypes = useMemo(() => {
    return trainingTypes.filter(t => {
      if (facilityFilter !== "all" && t.facility !== facilityFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return t.name.toLowerCase().includes(query) || (t.description || "").toLowerCase().includes(query);
      }
      return true;
    });
  }, [trainingTypes, searchQuery, facilityFilter]);

  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedTypes, totalItems } = usePagination(filteredTypes, preferences.itemsPerPage);

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<'overwrite' | 'skip'>('overwrite');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { periodValue: "2", periodUnit: "years", durationHours: "2", description: "" },
  });

  const loadTrainingTypes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("training_types").select("*").order("name");
      if (error) throw error;
      setTrainingTypes(data || []);
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodařilo se načíst typy školení.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadTrainingTypes(); }, []);

  const getFacilityName = (code: string) => {
    const facility = facilities.find(f => f.code === code);
    return facility?.name || code;
  };

  const convertToDays = (value: number, unit: "days" | "months" | "years"): number => {
    if (unit === "years") return Math.round(value * 365);
    if (unit === "months") return Math.round(value * 30);
    return Math.round(value);
  };

  const convertFromDays = (days: number, unit: "days" | "months" | "years"): number => {
    if (unit === "years") return days / 365;
    if (unit === "months") return days / 30;
    return days;
  };

  const resolveFacility = (raw: string): string | null => {
    const key = raw.toLowerCase().trim();
    const f = facilities.find(fac => fac.code.toLowerCase() === key || fac.name.toLowerCase() === key);
    return f?.code || null;
  };

  // ---- Export ----
  const handleExport = () => {
    try {
      const data = trainingTypes.map(t => ({
        "Název": t.name,
        "Provozovna": getFacilityName(t.facility),
        "Periodicita": formatPeriodicity(t.period_days),
        "Délka (hodiny)": t.duration_hours || "",
        "Popis": t.description || "",
      }));
      const timestamp = new Date().toISOString().split('T')[0];
      exportToCSV({ filename: `typy_skoleni_${timestamp}.csv`, data });
      toast({ title: "Export dokončen", description: `Exportováno ${data.length} typů.` });
    } catch (err: any) {
      toast({ title: "Chyba exportu", description: err.message, variant: "destructive" });
    }
  };

  // ---- Import ----
  const parseFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          resolve(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]));
        } catch (error) { reject(error); }
      };
      reader.onerror = () => reject(new Error("Chyba čtení souboru"));
      reader.readAsArrayBuffer(file);
    });
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
        const periodDays = parsePeriodicityText(row['Periodicita'] || row['Periodicita (dní)'] || row['period_days']);
        const durationHours = parseFloat(String(row['Délka (hodiny)'] || row['duration_hours'] || '0'));
        const description = String(row['Popis'] || row['description'] || '').trim();
        const errors: string[] = [];
        if (!name) errors.push("Chybí název");
        if (!facilityCode) errors.push(`Provozovna "${rawFacility}" neexistuje`);
        if (!periodDays || periodDays <= 0) errors.push("Neplatná periodicita");
        const isDuplicate = trainingTypes.some(t => t.name.toLowerCase() === name.toLowerCase() && t.facility === facilityCode);
        return { name, facilityCode, facilityRaw: rawFacility, periodDays, durationHours: isNaN(durationHours) ? null : durationHours, description, errors, rowNumber: i + 2, isDuplicate, isValid: errors.length === 0 };
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
        const existing = trainingTypes.find(t => t.name.toLowerCase() === row.name.toLowerCase() && t.facility === row.facilityCode);
        if (existing) {
          try {
            const { error } = await supabase.from("training_types").update({ period_days: row.periodDays, duration_hours: row.durationHours, description: row.description || null }).eq("id", existing.id);
            if (error) throw error;
            result.updated++;
          } catch (err: any) { result.failed++; errors.push(`Řádek ${row.rowNumber} (${row.name}): ${err.message}`); }
        }
      } else {
        try {
          const { error } = await supabase.from("training_types").insert({ name: row.name, facility: row.facilityCode!, period_days: row.periodDays, duration_hours: row.durationHours, description: row.description || null });
          if (error) throw error;
          result.inserted++;
        } catch (err: any) { result.failed++; errors.push(`Řádek ${row.rowNumber} (${row.name}): ${err.message}`); }
      }
    }

    setImportResult(result);
    setImportErrors(errors);
    setIsImporting(false);
    if (result.inserted > 0 || result.updated > 0) loadTrainingTypes();
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const periodDays = convertToDays(parseFloat(data.periodValue), data.periodUnit);
      const durationHours = parseFloat(data.durationHours);
      const trainingTypeData = { facility: data.facility, name: data.name, period_days: periodDays, duration_hours: durationHours, description: data.description || null };
      if (editingType) {
        const { error } = await supabase.from("training_types").update(trainingTypeData).eq("id", editingType.id);
        if (error) throw error;
        toast({ title: "Typ školení aktualizován" });
      } else {
        const { error } = await supabase.from("training_types").insert([trainingTypeData]);
        if (error) throw error;
        toast({ title: "Typ školení vytvořen" });
      }
      setDialogOpen(false);
      setEditingType(null);
      form.reset();
      loadTrainingTypes();
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodařilo se uložit typ školení.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (type: TrainingType) => {
    setEditingType(type);
    const periodUnit: "days" | "months" | "years" = type.period_days % 365 === 0 ? "years" : type.period_days % 30 === 0 ? "months" : "days";
    const periodValue = convertFromDays(type.period_days, periodUnit);
    form.reset({ facility: type.facility, name: type.name, periodValue: periodValue.toString(), periodUnit, durationHours: (type.duration_hours || 0).toString(), description: type.description || "" });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      const { count, error: countError } = await supabase.from("trainings").select("id", { count: "exact", head: true }).eq("training_type_id", typeToDelete.id);
      if (countError) throw countError;
      if (count && count > 0) {
        toast({ title: "Nelze smazat", description: `Typ školení "${typeToDelete.name}" má přiřazených ${count} školení.`, variant: "destructive" });
        setDeleteDialogOpen(false); setTypeToDelete(null); return;
      }
      const { error } = await supabase.from("training_types").delete().eq("id", typeToDelete.id);
      if (error) throw error;
      toast({ title: "Typ školení smazán" });
      loadTrainingTypes();
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodařilo se smazat typ školení.", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false); setTypeToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setEditingType(null); form.reset(); }
  };

  const validRows = importPreview?.filter(r => r.isValid && !r.isDuplicate) || [];
  const duplicateRows = importPreview?.filter(r => r.isValid && r.isDuplicate) || [];
  const invalidRows = importPreview?.filter(r => !r.isValid) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Typy školení</h2>
          <p className="text-muted-foreground">Celkem {filteredTypes.length} typů</p>
        </div>
        
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Import</Button>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Přidat nový typ</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editingType ? "Upravit typ školení" : "Nový typ školení"}</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="facility" render={({ field }) => (
                    <FormItem><FormLabel>Provozovna *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Vyberte provozovnu" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {facilitiesLoading ? <SelectItem value="__loading" disabled>Načítání...</SelectItem> : facilities.length === 0 ? <SelectItem value="__empty" disabled>Žádné provozovny</SelectItem> : facilities.map(f => <SelectItem key={f.id} value={f.code}>{f.name}</SelectItem>)}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Název typu události *</FormLabel><FormControl><Input placeholder="např. ATEX" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="durationHours" render={({ field }) => (
                    <FormItem><FormLabel>Délka školení (hodiny) *</FormLabel><FormControl><Input type="number" step="0.5" placeholder="např. 2" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="space-y-2">
                    <FormLabel>Periodicita *</FormLabel>
                    <div className="flex gap-2 items-center">
                      <FormField control={form.control} name="periodValue" render={({ field }) => (
                        <FormItem className="flex-1"><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={form.control} name="periodUnit" render={({ field }) => (
                        <FormItem className="w-32">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="days">Dní</SelectItem><SelectItem value="months">Měsíců</SelectItem><SelectItem value="years">Roků</SelectItem></SelectContent>
                          </Select><FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Popis školení</FormLabel><FormControl><Textarea placeholder="Volitelný popis typu školení..." rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="flex gap-4 pt-4">
                    <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{isSubmitting ? "Ukládá se..." : "Uložit"}</Button>
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)} disabled={isSubmitting}>Zrušit</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Hledat typy školení..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
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
        {isLoading ? (
          <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provozovna</TableHead><TableHead>Název</TableHead><TableHead>Periodicita</TableHead><TableHead>Délka (hodiny)</TableHead><TableHead>Popis</TableHead><TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTypes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Žádné typy školení nenalezeny.</TableCell></TableRow>
              ) : (
                paginatedTypes.map(type => (
                  <TableRow key={type.id}>
                    <TableCell className="text-sm">{getFacilityName(type.facility)}</TableCell>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell>{formatPeriodicity(type.period_days)}</TableCell>
                    <TableCell>{type.duration_hours}</TableCell>
                    <TableCell className="max-w-xs truncate" title={type.description || ""}>{type.description || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(type)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setTypeToDelete(type); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
        <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={preferences.itemsPerPage} onPageChange={setCurrentPage} />
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import typů školení</DialogTitle></DialogHeader>
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
                  <TableHeader><TableRow><TableHead>Řádek</TableHead><TableHead>Název</TableHead><TableHead>Provozovna</TableHead><TableHead>Periodicita</TableHead><TableHead>Délka</TableHead><TableHead>Výsledek</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.facilityRaw}</TableCell>
                        <TableCell>{row.periodDays ? `${row.periodDays} dní` : "-"}</TableCell>
                        <TableCell>{row.durationHours ?? "-"}</TableCell>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu chcete smazat tento typ školení?</AlertDialogTitle>
            <AlertDialogDescription>Tato akce je nevratná. Typ školení "{typeToDelete?.name}" bude trvale odstraněn.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Smazat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
