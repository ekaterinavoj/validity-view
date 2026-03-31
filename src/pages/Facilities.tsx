import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit, Plus, Trash2, Loader2, Building2, Download, Upload, CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { exportToCSV } from "@/lib/csvExport";
import * as XLSX from "xlsx";

const formSchema = z.object({
  name: z.string().min(1, "Zadejte název provozovny"),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
});

const generateCodeFromName = (name: string): string => {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 50);
};

type FormValues = z.infer<typeof formSchema>;

interface Facility {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const ACTIVE_STATUS_MAP: Record<string, boolean> = {
  'aktivní': true, 'aktivni': true, 'active': true, 'ano': true, 'yes': true, 'true': true,
  'neaktivní': false, 'neaktivni': false, 'inactive': false, 'ne': false, 'no': false, 'false': false,
};

export default function Facilities() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [facilityToDelete, setFacilityToDelete] = useState<Facility | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { preferences } = useUserPreferences();
  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedFacilities, totalItems } = usePagination(facilities, preferences.itemsPerPage);

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
    defaultValues: { name: "", description: "", is_active: true },
  });

  const loadFacilities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("facilities").select("*").order("name");
      if (error) throw error;
      setFacilities(data || []);
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodařilo se načíst provozovny.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadFacilities(); }, []);

  // ---- Export ----
  const handleExport = () => {
    try {
      const data = facilities.map(f => ({
        "Název": f.name,
        "Kód": f.code,
        "Popis": f.description || "",
        "Stav": f.is_active ? "Aktivní" : "Neaktivní",
      }));
      const timestamp = new Date().toISOString().split('T')[0];
      exportToCSV({ filename: `provozovny_${timestamp}.csv`, data });
      toast({ title: "Export dokončen", description: `Exportováno ${data.length} provozoven.` });
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
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(firstSheet));
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
        const description = String(row['Popis'] || row['description'] || '').trim();
        const rawStatus = String(row['Stav'] || row['is_active'] || 'Aktivní').toLowerCase().trim();
        const is_active = ACTIVE_STATUS_MAP[rawStatus] ?? true;
        const errors: string[] = [];
        if (!name) errors.push("Chybí název");
        const isDuplicate = facilities.some(f => f.name.toLowerCase() === name.toLowerCase());
        return { name, description, is_active, errors, rowNumber: i + 2, isDuplicate, isValid: errors.length === 0 };
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
      const code = generateCodeFromName(row.name);

      if (row.isDuplicate) {
        if (duplicateAction === 'skip') { result.skipped++; continue; }
        const existing = facilities.find(f => f.name.toLowerCase() === row.name.toLowerCase());
        if (existing) {
          try {
            const { error } = await supabase.from("facilities").update({ description: row.description || null, is_active: row.is_active }).eq("id", existing.id);
            if (error) throw error;
            result.updated++;
          } catch (err: any) { result.failed++; errors.push(`Řádek ${row.rowNumber} (${row.name}): ${err.message}`); }
        }
      } else {
        try {
          const { error } = await supabase.from("facilities").insert({ code, name: row.name, description: row.description || null, is_active: row.is_active });
          if (error) throw error;
          result.inserted++;
        } catch (err: any) { result.failed++; errors.push(`Řádek ${row.rowNumber} (${row.name}): ${err.message}`); }
      }
    }

    setImportResult(result);
    setImportErrors(errors);
    setIsImporting(false);
    if (result.inserted > 0 || result.updated > 0) loadFacilities();
  };

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const facilityData = { code: generateCodeFromName(data.name), name: data.name, description: data.description || null, is_active: data.is_active };
      if (editingFacility) {
        const { error } = await supabase.from("facilities").update(facilityData).eq("id", editingFacility.id);
        if (error) throw error;
        toast({ title: "Provozovna aktualizována" });
      } else {
        const { error } = await supabase.from("facilities").insert([facilityData]);
        if (error) throw error;
        toast({ title: "Provozovna vytvořena" });
      }
      setDialogOpen(false);
      setEditingFacility(null);
      form.reset();
      loadFacilities();
    } catch (error: any) {
      toast({ title: "Chyba", description: error.message?.includes("duplicate") ? "Provozovna s tímto kódem již existuje." : "Nepodařilo se uložit provozovnu.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    form.reset({ name: facility.name, description: facility.description || "", is_active: facility.is_active });
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!facilityToDelete) return;
    try {
      const { error } = await supabase.from("facilities").delete().eq("id", facilityToDelete.id);
      if (error) throw error;
      toast({ title: "Provozovna smazána" });
      loadFacilities();
    } catch (error) {
      toast({ title: "Chyba", description: "Nepodařilo se smazat provozovnu.", variant: "destructive" });
    } finally {
      setDeleteDialogOpen(false);
      setFacilityToDelete(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setEditingFacility(null); form.reset(); }
  };

  const validRows = importPreview?.filter(r => r.isValid && !r.isDuplicate) || [];
  const duplicateRows = importPreview?.filter(r => r.isValid && r.isDuplicate) || [];
  const invalidRows = importPreview?.filter(r => !r.isValid) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold text-foreground">Provozovny</h2>
        </div>
        
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Přidat provozovnu</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFacility ? "Upravit provozovnu" : "Nová provozovna"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Název provozovny *</FormLabel><FormControl><Input placeholder="např. Qlar Czech s.r.o. - závod Jeneč" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Popis</FormLabel><FormControl><Textarea placeholder="Volitelný popis provozovny..." rows={3} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="is_active" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Aktivní</FormLabel>
                        <div className="text-sm text-muted-foreground">Neaktivní provozovny se nezobrazují při výběru</div>
                      </div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
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
      
      <Card>
        {isLoading ? (
          <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Název</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead>Stav</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {facilities.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Žádné provozovny nenalezeny.</TableCell></TableRow>
              ) : (
                paginatedFacilities.map((facility) => (
                  <TableRow key={facility.id}>
                    <TableCell className="font-medium">{facility.name}</TableCell>
                    <TableCell className="max-w-xs truncate" title={facility.description || ""}>{facility.description || "-"}</TableCell>
                    <TableCell><Badge variant={facility.is_active ? "default" : "secondary"}>{facility.is_active ? "Aktivní" : "Neaktivní"}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(facility)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { setFacilityToDelete(facility); setDeleteDialogOpen(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Import provozoven</DialogTitle></DialogHeader>
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
                  <TableHeader><TableRow><TableHead>Řádek</TableHead><TableHead>Název</TableHead><TableHead>Stav</TableHead><TableHead>Výsledek</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.is_active ? "Aktivní" : "Neaktivní"}</TableCell>
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
            <AlertDialogTitle>Opravdu chcete smazat tuto provozovnu?</AlertDialogTitle>
            <AlertDialogDescription>Tato akce je nevratná. Provozovna "{facilityToDelete?.name}" bude trvale odstraněna z databáze.</AlertDialogDescription>
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
