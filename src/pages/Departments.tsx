import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Edit, Plus, Trash2, Loader2, RefreshCw, AlertTriangle, Download, Upload, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments, Department, DepartmentDependencies } from "@/hooks/useDepartments";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/TablePagination";
import { exportToCSV } from "@/lib/csvExport";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  code: z.string().min(1, "Zadejte číslo střediska"),
  name: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Departments() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<DepartmentDependencies | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; skipped: number; failed: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [duplicateAction, setDuplicateAction] = useState<'overwrite' | 'skip'>('overwrite');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { departments, loading, error, createDepartment, updateDepartment, deleteDepartment, checkDependencies, refetch } = useDepartments();
  const [searchQuery, setSearchQuery] = useState("");
  const { preferences } = useUserPreferences();

  const filteredDepartments = useMemo(() => {
    if (!searchQuery) return departments;
    const query = searchQuery.toLowerCase();
    return departments.filter(d => d.code.toLowerCase().includes(query) || (d.name || "").toLowerCase().includes(query));
  }, [departments, searchQuery]);

  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedDepartments, totalItems } = usePagination(filteredDepartments, preferences.itemsPerPage);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: "", name: "" },
  });

  // ---- Export ----
  const handleExport = () => {
    try {
      const data = departments.map(d => ({
        "Číslo střediska": d.code,
        "Název": d.name || "",
      }));
      const timestamp = new Date().toISOString().split('T')[0];
      exportToCSV({ filename: `strediska_${timestamp}.csv`, data });
      toast({ title: "Export dokončen", description: `Exportováno ${data.length} středisek.` });
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
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData);
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
        const code = String(row['Číslo střediska'] || row['code'] || row['Kód'] || '').trim();
        const name = String(row['Název'] || row['name'] || '').trim();
        const errors: string[] = [];
        if (!code) errors.push("Chybí číslo střediska");
        const isDuplicate = departments.some(d => d.code.toLowerCase() === code.toLowerCase());
        return { code, name, errors, rowNumber: i + 2, isDuplicate, isValid: errors.length === 0 };
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
        // overwrite
        const existing = departments.find(d => d.code.toLowerCase() === row.code.toLowerCase());
        if (existing) {
          try {
            const { error } = await supabase.from("departments").update({ name: row.name }).eq("id", existing.id);
            if (error) throw error;
            result.updated++;
          } catch (err: any) {
            result.failed++;
            errors.push(`Řádek ${row.rowNumber} (${row.code}): ${err.message}`);
          }
        }
      } else {
        try {
          const { error } = await supabase.from("departments").insert({ code: row.code, name: row.name });
          if (error) throw error;
          result.inserted++;
        } catch (err: any) {
          result.failed++;
          errors.push(`Řádek ${row.rowNumber} (${row.code}): ${err.message}`);
        }
      }
    }

    setImportResult(result);
    setImportErrors(errors);
    setIsImporting(false);
    if (result.inserted > 0 || result.updated > 0) refetch();
  };

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept);
    form.reset({ code: dept.code, name: dept.name || "" });
    setDialogOpen(true);
  };

  const openDeleteDialog = async (dept: Department) => {
    setDepartmentToDelete(dept);
    setCheckingDeps(true);
    setDeleteDialogOpen(true);
    try {
      const deps = await checkDependencies(dept.id);
      setDeleteDependencies(deps);
    } catch (err) {
      setDeleteDependencies({ employeesCount: 0, equipmentCount: 0 });
    } finally {
      setCheckingDeps(false);
    }
  };

  const handleDelete = async () => {
    if (!departmentToDelete) return;
    try {
      await deleteDepartment(departmentToDelete.id);
      toast({ title: "Středisko smazáno", description: `Středisko ${departmentToDelete.code} bylo úspěšně odstraněno.` });
    } catch (error: any) {
      toast({ title: "Chyba při mazání", description: error.message || "Nepodařilo se smazat středisko.", variant: "destructive" });
    }
    setDeleteDialogOpen(false);
    setDepartmentToDelete(null);
    setDeleteDependencies(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { setEditingDepartment(null); form.reset({ code: "", name: "" }); }
  };

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment.id, data.code, data.name || "");
        toast({ title: "Středisko aktualizováno", description: "Středisko bylo úspěšně upraveno." });
      } else {
        await createDepartment(data.code, data.name || "");
        toast({ title: "Středisko vytvořeno", description: "Nové středisko bylo úspěšně přidáno." });
      }
      handleDialogClose(false);
    } catch (error: any) {
      toast({ title: "Chyba", description: error.message || "Nepodařilo se uložit středisko.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Editovat střediska</h2>
        </div>
        <ErrorDisplay title="Nepodařilo se načíst střediska" message={error} onRetry={refetch} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <TableSkeleton columns={3} rows={6} />
      </div>
    );
  }

  const validRows = importPreview?.filter(r => r.isValid && !r.isDuplicate) || [];
  const duplicateRows = importPreview?.filter(r => r.isValid && r.isDuplicate) || [];
  const invalidRows = importPreview?.filter(r => !r.isValid) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Editovat střediska</h2>
          <p className="text-muted-foreground">Celkem {filteredDepartments.length} středisek</p>
        </div>
        
        <div className="flex gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} title="Formát: CSV (středník, UTF-8)">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Přidat nové
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingDepartment ? "Upravit středisko" : "Nové středisko"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="code" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Číslo střediska *</FormLabel>
                      <FormControl><Input placeholder="např. 2002000001" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Název (volitelné)</FormLabel>
                      <FormControl><Input placeholder="např. Výroba" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="flex gap-4 pt-4">
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {saving ? "Ukládání..." : "Uložit"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Hledat střediska..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
      </div>
      
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Číslo střediska</TableHead>
              <TableHead>Název</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDepartments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Žádná střediska nenalezena
                </TableCell>
              </TableRow>
            ) : (
              paginatedDepartments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell className="font-medium">{dept.code}</TableCell>
                  <TableCell className="text-sm">{dept.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(dept)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(dept)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} itemsPerPage={preferences.itemsPerPage} onPageChange={setCurrentPage} />
      </Card>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import středisek</DialogTitle>
          </DialogHeader>

          {importPreview && !importResult && (
            <>
              <div className="flex flex-wrap items-center gap-4 p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="font-medium">{validRows.length} nových</span>
                </div>
                {duplicateRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    <span className="font-medium">{duplicateRows.length} duplicitních</span>
                  </div>
                )}
                {invalidRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                    <span className="font-medium">{invalidRows.length} chybných</span>
                  </div>
                )}
                {duplicateRows.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <Button size="sm" variant={duplicateAction === 'overwrite' ? 'default' : 'outline'} onClick={() => setDuplicateAction('overwrite')}>Přepsat</Button>
                    <Button size="sm" variant={duplicateAction === 'skip' ? 'default' : 'outline'} onClick={() => setDuplicateAction('skip')}>Přeskočit</Button>
                  </div>
                )}
              </div>

              <div className="max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Řádek</TableHead>
                      <TableHead>Číslo střediska</TableHead>
                      <TableHead>Název</TableHead>
                      <TableHead>Stav</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell className="font-medium">{row.code}</TableCell>
                        <TableCell>{row.name || "-"}</TableCell>
                        <TableCell>
                          {!row.isValid ? (
                            <Badge variant="destructive">{row.errors.join(", ")}</Badge>
                          ) : row.isDuplicate ? (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">Duplicitní</Badge>
                          ) : (
                            <Badge variant="default">Nový</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleImport} disabled={isImporting || (validRows.length === 0 && (duplicateAction === 'skip' || duplicateRows.length === 0))}>
                  {isImporting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importovat
                </Button>
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteDependencies && (deleteDependencies.employeesCount > 0 || deleteDependencies.equipmentCount > 0) ? (
                <><AlertTriangle className="w-5 h-5 text-destructive" />Nelze smazat středisko</>
              ) : ("Opravdu chcete smazat středisko?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {checkingDeps ? (
                <div className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Kontrola závislostí...</div>
              ) : deleteDependencies && (deleteDependencies.employeesCount > 0 || deleteDependencies.equipmentCount > 0) ? (
                <div className="space-y-2">
                  <p>Středisko <strong>{departmentToDelete?.code}</strong> nelze smazat, protože je přiřazeno k:</p>
                  <ul className="list-disc list-inside text-sm">
                    {deleteDependencies.employeesCount > 0 && <li>{deleteDependencies.employeesCount} zaměstnancům</li>}
                    {deleteDependencies.equipmentCount > 0 && <li>{deleteDependencies.equipmentCount} zařízením</li>}
                  </ul>
                  <p className="text-sm">Nejprve přesuňte nebo odeberte tyto záznamy.</p>
                </div>
              ) : (
                <p>Středisko <strong>{departmentToDelete?.code}</strong> bude trvale odstraněno z databáze.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            {(!deleteDependencies || (deleteDependencies.employeesCount === 0 && deleteDependencies.equipmentCount === 0)) && !checkingDeps && (
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Trash2 className="w-4 h-4 mr-2" />Smazat
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
