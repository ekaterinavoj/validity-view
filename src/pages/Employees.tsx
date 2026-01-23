import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit, Plus, Trash2, Search, X, Download, Loader2 } from "lucide-react";
import { BulkEmployeeImport } from "@/components/BulkEmployeeImport";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import * as XLSX from 'xlsx';
import { useEmployees, EmployeeWithDepartment } from "@/hooks/useEmployees";
import { useDepartments } from "@/hooks/useDepartments";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  firstName: z.string().min(1, "Zadejte jméno"),
  lastName: z.string().min(1, "Zadejte příjmení"),
  email: z.string().email("Neplatná emailová adresa"),
  employeeNumber: z.string().min(1, "Zadejte osobní číslo"),
  position: z.string().min(1, "Zadejte pracovní pozici"),
  departmentId: z.string().min(1, "Vyberte středisko"),
  status: z.enum(["employed", "parental_leave", "sick_leave", "terminated"]),
  terminationDate: z.date().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const statusLabels = {
  employed: "Aktivní",
  parental_leave: "Mateřská/rodičovská",
  sick_leave: "Nemocenská",
  terminated: "Ukončený",
};

export default function Employees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithDepartment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeWithDepartment | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const { employees, loading: employeesLoading, refetch } = useEmployees();
  const { departments, loading: departmentsLoading } = useDepartments();

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        employee.firstName.toLowerCase().includes(searchLower) ||
        employee.lastName.toLowerCase().includes(searchLower) ||
        employee.employeeNumber.includes(searchLower) ||
        employee.email.toLowerCase().includes(searchLower) ||
        employee.position.toLowerCase().includes(searchLower);

      const matchesDepartment =
        departmentFilter === "all" || employee.department === departmentFilter;
      const matchesStatus = statusFilter === "all" || employee.status === statusFilter;

      return matchesSearch && matchesDepartment && matchesStatus;
    });
  }, [searchQuery, departmentFilter, statusFilter, employees]);

  const hasActiveFilters =
    searchQuery !== "" || departmentFilter !== "all" || statusFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("all");
    setStatusFilter("all");
  };

  const exportToCSV = () => {
    try {
      const headers = [
        "Osobní číslo",
        "Jméno",
        "Příjmení",
        "Email",
        "Pozice",
        "Středisko",
        "Stav",
      ];

      const rows = filteredEmployees.map((employee) => [
        employee.employeeNumber,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.position,
        employee.department,
        statusLabels[employee.status],
      ]);

      const escapeCSV = (value: string) => {
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      const csvContent = [
        headers.map(escapeCSV).join(","),
        ...rows.map((row) => row.map(escapeCSV).join(",")),
      ].join("\n");

      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().split("T")[0];
      link.setAttribute("href", url);
      link.setAttribute("download", `zamestnanci_export_${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export úspěšný",
        description: `Exportováno ${filteredEmployees.length} zaměstnanců.`,
      });
    } catch (error) {
      toast({
        title: "Chyba při exportu",
        description: "Nepodařilo se exportovat data.",
        variant: "destructive",
      });
    }
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      status: "employed",
    },
  });

  const selectedStatus = form.watch("status");

  const handleEdit = (employee: EmployeeWithDepartment) => {
    setEditingEmployee(employee);
    form.reset({
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      employeeNumber: employee.employeeNumber,
      position: employee.position,
      departmentId: employee.departmentId || "",
      status: employee.status,
      notes: employee.notes || "",
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (employee: EmployeeWithDepartment) => {
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;
    
    // Note: DELETE is forbidden by RLS policy, so we just update status to terminated
    try {
      const { error } = await supabase
        .from("employees")
        .update({ 
          status: "terminated",
          termination_date: new Date().toISOString().split("T")[0],
          notes: `Ukončen ke dni ${format(new Date(), "dd.MM.yyyy", { locale: cs })}`
        })
        .eq("id", employeeToDelete.id);

      if (error) throw error;

      toast({
        title: "Zaměstnanec deaktivován",
        description: `${employeeToDelete.firstName} ${employeeToDelete.lastName} byl označen jako ukončený.`,
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se deaktivovat zaměstnance.",
        variant: "destructive",
      });
    }
    
    setDeleteDialogOpen(false);
    setEmployeeToDelete(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingEmployee(null);
      form.reset({ status: "employed" });
    }
  };

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    
    try {
      // Automaticky nastavit poznámku pro ukončené zaměstnance
      let notes = data.notes;
      if (data.status === "terminated" && data.terminationDate) {
        notes = `Ukončen ke dni ${format(data.terminationDate, "dd.MM.yyyy", { locale: cs })}`;
      }
      
      const employeeData = {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        employee_number: data.employeeNumber,
        position: data.position,
        department_id: data.departmentId,
        status: data.status,
        termination_date: data.terminationDate ? format(data.terminationDate, "yyyy-MM-dd") : null,
        notes: notes || null,
      };

      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(employeeData)
          .eq("id", editingEmployee.id);

        if (error) throw error;

        toast({
          title: "Zaměstnanec aktualizován",
          description: "Údaje zaměstnance byly úspěšně upraveny.",
        });
      } else {
        const { error } = await supabase
          .from("employees")
          .insert(employeeData);

        if (error) throw error;

        toast({
          title: "Zaměstnanec přidán",
          description: "Nový zaměstnanec byl úspěšně přidán do systému.",
        });
      }
      
      refetch();
      handleDialogClose(false);
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se uložit zaměstnance.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (employeesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Načítání zaměstnanců...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Školené osoby</h2>

        <div className="flex gap-2">
          <BulkEmployeeImport />
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Přidat nového zaměstnance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Upravit zaměstnance" : "Nový zaměstnanec"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Jméno *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Příjmení *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="employeeNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Osobní číslo *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pracovní pozice *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Středisko *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte středisko" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.code} {dept.name && `- ${dept.name}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stav *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="employed">Aktivní</SelectItem>
                          <SelectItem value="parental_leave">Mateřská/rodičovská</SelectItem>
                          <SelectItem value="sick_leave">Nemocenská</SelectItem>
                          <SelectItem value="terminated">Ukončený</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedStatus === "terminated" && (
                  <FormField
                    control={form.control}
                    name="terminationDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Datum ukončení *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-full justify-start text-left font-normal"
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "dd.MM.yyyy", { locale: cs }) : "Vyberte datum"}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
      </div>

      {/* Filtry */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Hledat podle jména, emailu, osobního čísla..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Středisko" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechna střediska</SelectItem>
              {uniqueDepartments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Stav" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny stavy</SelectItem>
              <SelectItem value="employed">Aktivní</SelectItem>
              <SelectItem value="parental_leave">Mateřská/rodičovská</SelectItem>
              <SelectItem value="sick_leave">Nemocenská</SelectItem>
              <SelectItem value="terminated">Ukončený</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Zobrazeno {filteredEmployees.length} z {employees.length} zaměstnanců
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              Vymazat filtry
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Os. číslo</TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Pozice</TableHead>
              <TableHead>Středisko</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead>Poznámky</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Žádní zaměstnanci nenalezeni
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.employeeNumber}</TableCell>
                <TableCell>{employee.firstName} {employee.lastName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{employee.email}</TableCell>
                <TableCell className="text-sm">{employee.position}</TableCell>
                <TableCell className="text-sm">{employee.department}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{statusLabels[employee.status]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{employee.notes || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(employee)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openDeleteDialog(employee)}>
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
            <AlertDialogTitle>Opravdu chcete deaktivovat zaměstnance?</AlertDialogTitle>
            <AlertDialogDescription>
              Zaměstnanec "{employeeToDelete?.firstName} {employeeToDelete?.lastName}" bude označen jako ukončený.
              Všechna jeho školení budou automaticky pozastavena.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deaktivovat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
