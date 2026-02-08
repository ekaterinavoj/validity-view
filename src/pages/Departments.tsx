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
import { Edit, Plus, Trash2, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDepartments, Department, DepartmentDependencies } from "@/hooks/useDepartments";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";

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

  const { departments, loading, error, createDepartment, updateDepartment, deleteDepartment, checkDependencies, refetch } = useDepartments();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      name: "",
    },
  });

  const handleEdit = (dept: Department) => {
    setEditingDepartment(dept);
    form.reset({
      code: dept.code,
      name: dept.name || "",
    });
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
      console.error("Error checking dependencies:", err);
      setDeleteDependencies({ employeesCount: 0, equipmentCount: 0 });
    } finally {
      setCheckingDeps(false);
    }
  };

  const handleDelete = async () => {
    if (!departmentToDelete) return;
    
    try {
      await deleteDepartment(departmentToDelete.id);
      toast({
        title: "Středisko smazáno",
        description: `Středisko ${departmentToDelete.code} bylo úspěšně odstraněno.`,
      });
    } catch (error: any) {
      toast({
        title: "Chyba při mazání",
        description: error.message || "Nepodařilo se smazat středisko.",
        variant: "destructive",
      });
    }
    
    setDeleteDialogOpen(false);
    setDepartmentToDelete(null);
    setDeleteDependencies(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingDepartment(null);
      form.reset({ code: "", name: "" });
    }
  };

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    
    try {
      if (editingDepartment) {
        await updateDepartment(editingDepartment.id, data.code, data.name || "");
        toast({
          title: "Středisko aktualizováno",
          description: "Středisko bylo úspěšně upraveno.",
        });
      } else {
        await createDepartment(data.code, data.name || "");
        toast({
          title: "Středisko vytvořeno",
          description: "Nové středisko bylo úspěšně přidáno.",
        });
      }
      handleDialogClose(false);
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se uložit středisko.",
        variant: "destructive",
      });
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
        <ErrorDisplay
          title="Nepodařilo se načíst střediska"
          message={error}
          onRetry={refetch}
        />
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Editovat střediska</h2>
        
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
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Číslo střediska *</FormLabel>
                      <FormControl>
                        <Input placeholder="např. 2002000001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Název (volitelné)</FormLabel>
                      <FormControl>
                        <Input placeholder="např. Výroba" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {saving ? "Ukládání..." : "Uložit"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Zrušit
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  Žádná střediska nenalezena
                </TableCell>
              </TableRow>
            ) : (
              departments.map((dept) => (
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
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {deleteDependencies && (deleteDependencies.employeesCount > 0 || deleteDependencies.equipmentCount > 0) ? (
                <>
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Nelze smazat středisko
                </>
              ) : (
                "Opravdu chcete smazat středisko?"
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {checkingDeps ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Kontrola závislostí...
                </div>
              ) : deleteDependencies && (deleteDependencies.employeesCount > 0 || deleteDependencies.equipmentCount > 0) ? (
                <div className="space-y-2">
                  <p>
                    Středisko <strong>{departmentToDelete?.code}</strong> nelze smazat, protože je přiřazeno k:
                  </p>
                  <ul className="list-disc list-inside text-sm">
                    {deleteDependencies.employeesCount > 0 && (
                      <li>{deleteDependencies.employeesCount} zaměstnancům</li>
                    )}
                    {deleteDependencies.equipmentCount > 0 && (
                      <li>{deleteDependencies.equipmentCount} zařízením</li>
                    )}
                  </ul>
                  <p className="text-sm">
                    Nejprve přesuňte nebo odeberte tyto záznamy.
                  </p>
                </div>
              ) : (
                <p>
                  Středisko <strong>{departmentToDelete?.code}</strong> bude trvale odstraněno z databáze.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            {(!deleteDependencies || (deleteDependencies.employeesCount === 0 && deleteDependencies.equipmentCount === 0)) && !checkingDeps && (
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                <Trash2 className="w-4 h-4 mr-2" />
                Smazat
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
