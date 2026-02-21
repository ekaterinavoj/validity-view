import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmployeeOrCustomInput } from "@/components/EmployeeOrCustomInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmployeeHierarchyTree } from "@/components/EmployeeHierarchyTree";
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
import { CalendarIcon, Edit, Plus, Trash2, Search, X, Download, Loader2, RefreshCw, List, GitBranch } from "lucide-react";
import { BulkEmployeeImport } from "@/components/BulkEmployeeImport";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { useEmployees, EmployeeWithDepartment } from "@/hooks/useEmployees";
import Papa from "papaparse";
import { useDepartments } from "@/hooks/useDepartments";
import { supabase } from "@/integrations/supabase/client";
import { TableSkeleton, PageHeaderSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { EmployeeStatusBadge, EmployeeStatus } from "@/components/EmployeeStatusBadge";
import { StatusLegend } from "@/components/StatusLegend";
import { WorkCategoryBadge } from "@/components/WorkCategoryBadge";

const formSchema = z.object({
  firstName: z.string().min(1, "Zadejte jméno"),
  lastName: z.string().min(1, "Zadejte příjmení"),
  email: z.string().email("Neplatná emailová adresa"),
  employeeNumber: z.string().optional().default(""),
  position: z.string().min(1, "Zadejte pracovní pozici"),
  departmentId: z.string().optional().default(""),
  workCategory: z.string().optional(),
  status: z.enum(["employed", "parental_leave", "sick_leave", "terminated"]),
  terminationDate: z.date().optional(),
  statusStartDate: z.date().optional(),
  notes: z.string().optional(),
  // Manager fields for hierarchy
  managerEmployeeId: z.string().optional(),
  managerFirstName: z.string().optional(),
  managerLastName: z.string().optional(),
  managerEmail: z.string().email("Neplatný email nadřízeného").optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

// Helper for CSV export
const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    employed: "Aktivní",
    parental_leave: "Mateřská/rodičovská",
    sick_leave: "Nemocenská",
    terminated: "Ukončený",
  };
  return labels[status] || status;
};

interface EmployeeDependencies {
  trainingsCount: number;
  examinationsCount: number;
}

export default function Employees() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeWithDepartment | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<EmployeeWithDepartment | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<EmployeeDependencies | null>(null);
  const [checkingDeps, setCheckingDeps] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"deactivate" | "delete">("deactivate");
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");
  const { toast } = useToast();

  const { employees, loading: employeesLoading, error: employeesError, refetch } = useEmployees();
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
      const matchesCategory = 
        categoryFilter === "all" || 
        (employee.workCategory !== null && employee.workCategory?.toString() === categoryFilter);

      return matchesSearch && matchesDepartment && matchesStatus && matchesCategory;
    });
  }, [searchQuery, departmentFilter, statusFilter, categoryFilter, employees]);

  const hasActiveFilters =
    searchQuery !== "" || departmentFilter !== "all" || statusFilter !== "all" || categoryFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
  };

  const exportToCSV = () => {
    try {
      const data = filteredEmployees.map((employee) => ({
        "Osobní číslo": employee.employeeNumber || "",
        "Jméno": employee.firstName || "",
        "Příjmení": employee.lastName || "",
        "Email": employee.email || "",
        "Pozice": employee.position || "",
        "Středisko": employee.department || "",
        "Stav": getStatusLabel(employee.status) || "",
        "Datum od": employee.statusStartDate || employee.terminationDate 
          ? format(parseISO(employee.statusStartDate || employee.terminationDate || ""), "dd.MM.yyyy", { locale: cs })
          : "",
      }));

      const csv = Papa.unparse(data, { delimiter: ";" });
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
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
      workCategory: employee.workCategory?.toString() || "",
      status: employee.status,
      terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
      statusStartDate: employee.statusStartDate ? new Date(employee.statusStartDate) : undefined,
      notes: employee.notes || "",
      managerEmployeeId: employee.managerEmployeeId || "",
      managerFirstName: employee.managerFirstName || "",
      managerLastName: employee.managerLastName || "",
      managerEmail: employee.managerEmail || "",
    });
    setDialogOpen(true);
  };

  const checkEmployeeDependencies = async (id: string): Promise<EmployeeDependencies> => {
    const [trainingsResult, examsResult] = await Promise.all([
      supabase.from("trainings").select("id", { count: "exact", head: true }).eq("employee_id", id),
      supabase.from("medical_examinations").select("id", { count: "exact", head: true }).eq("employee_id", id),
    ]);

    return {
      trainingsCount: trainingsResult.count || 0,
      examinationsCount: examsResult.count || 0,
    };
  };

  const openDeleteDialog = async (employee: EmployeeWithDepartment) => {
    setEmployeeToDelete(employee);
    setDeleteMode("deactivate");
    setCheckingDeps(true);
    setDeleteDialogOpen(true);
    
    try {
      const deps = await checkEmployeeDependencies(employee.id);
      setDeleteDependencies(deps);
    } catch (err) {
      console.error("Error checking dependencies:", err);
      setDeleteDependencies({ trainingsCount: 0, examinationsCount: 0 });
    } finally {
      setCheckingDeps(false);
    }
  };

  const handleDeactivate = async () => {
    if (!employeeToDelete) return;
    
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
    setDeleteDependencies(null);
  };

  const handlePermanentDelete = async () => {
    if (!employeeToDelete) return;
    
    try {
      const empId = employeeToDelete.id;

      // 1. Get related training IDs
      const { data: trainings } = await supabase.from("trainings").select("id").eq("employee_id", empId);
      if (trainings && trainings.length > 0) {
        const trainingIds = trainings.map(t => t.id);
        // Delete training documents and reminder logs
        await Promise.all([
          supabase.from("training_documents").delete().in("training_id", trainingIds),
          supabase.from("reminder_logs").delete().in("training_id", trainingIds),
        ]);
      }
      // Delete trainings
      await supabase.from("trainings").delete().eq("employee_id", empId);
      
      // 2. Get related examination IDs
      const { data: examinations } = await supabase.from("medical_examinations").select("id").eq("employee_id", empId);
      if (examinations && examinations.length > 0) {
        const examIds = examinations.map(e => e.id);
        // Delete examination documents and reminder logs
        await Promise.all([
          supabase.from("medical_examination_documents").delete().in("examination_id", examIds),
          supabase.from("medical_reminder_logs").delete().in("examination_id", examIds),
        ]);
      }
      // Delete medical examinations
      await supabase.from("medical_examinations").delete().eq("employee_id", empId);
      
      // 3. Unlink profiles and subordinate employees referencing this employee
      await Promise.all([
        supabase.from("profiles").update({ employee_id: null }).eq("employee_id", empId),
        supabase.from("employees").update({ manager_employee_id: null }).eq("manager_employee_id", empId),
      ]);

      // 4. Delete the employee
      const { error } = await supabase.from("employees").delete().eq("id", empId);
      if (error) throw error;

      toast({
        title: "Zaměstnanec smazán",
        description: `${employeeToDelete.firstName} ${employeeToDelete.lastName} byl trvale odstraněn.`,
      });
      
      refetch();
    } catch (error: any) {
      toast({
        title: "Chyba při mazání",
        description: error.message || "Nepodařilo se smazat zaměstnance.",
        variant: "destructive",
      });
    }
    
    setDeleteDialogOpen(false);
    setEmployeeToDelete(null);
    setDeleteDependencies(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingEmployee(null);
      form.reset({ 
        status: "employed",
        managerEmployeeId: "",
        managerFirstName: "",
        managerLastName: "",
        managerEmail: "",
      });
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

      // Determine status_start_date based on status change
      let statusStartDate: string | null = null;
      const isNonActiveStatus = ["parental_leave", "sick_leave", "terminated"].includes(data.status);
      
      if (isNonActiveStatus) {
        // If status changed or it's a new employee, set date
        const statusChanged = editingEmployee?.status !== data.status;
        if (statusChanged || !editingEmployee) {
          // Use provided date or current date
          statusStartDate = data.statusStartDate 
            ? format(data.statusStartDate, "yyyy-MM-dd")
            : format(new Date(), "yyyy-MM-dd");
        } else {
          // Keep existing date
          statusStartDate = data.statusStartDate 
            ? format(data.statusStartDate, "yyyy-MM-dd")
            : editingEmployee?.statusStartDate || null;
        }
      }
      
      const employeeData = {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        employee_number: data.employeeNumber || '',
        position: data.position,
        department_id: data.departmentId || null,
        work_category: data.workCategory ? parseInt(data.workCategory) : null,
        status: data.status,
        termination_date: data.terminationDate ? format(data.terminationDate, "yyyy-MM-dd") : null,
        status_start_date: statusStartDate,
        notes: notes || null,
        // Manager hierarchy fields
        manager_employee_id: data.managerEmployeeId || null,
        manager_first_name: data.managerFirstName || null,
        manager_last_name: data.managerLastName || null,
        manager_email: data.managerEmail || null,
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

  if (employeesError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-foreground">Zaměstnanci</h2>
        </div>
        <ErrorDisplay
          title="Nepodařilo se načíst zaměstnance"
          message={employeesError}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (employeesLoading) {
    return (
      <div className="space-y-6">
        <PageHeaderSkeleton />
        <TableSkeleton columns={8} rows={8} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Zaměstnanci</h2>

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
                  name="workCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategorie práce</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte kategorii" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">
                            <span className="font-medium">Kategorie 1</span>
                            <span className="text-xs text-muted-foreground ml-2">- nejnižší riziko</span>
                          </SelectItem>
                          <SelectItem value="2">
                            <span className="font-medium">Kategorie 2</span>
                            <span className="text-xs text-muted-foreground ml-2">- zvýšené riziko</span>
                          </SelectItem>
                          <SelectItem value="3">
                            <span className="font-medium">Kategorie 3</span>
                            <span className="text-xs text-muted-foreground ml-2">- riziková</span>
                          </SelectItem>
                          <SelectItem value="4">
                            <span className="font-medium">Kategorie 4</span>
                            <span className="text-xs text-muted-foreground ml-2">- vysoké riziko</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Kategorie dle rizikovosti práce (1-4)
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Manager/Supervisor Section */}
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">Nadřízený (pro hierarchii)</p>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Vybrat nadřízeného ze seznamu</Label>
                      <EmployeeOrCustomInput
                        employees={employees.filter(e => e.id !== editingEmployee?.id)}
                        value={
                          form.watch("managerFirstName") || form.watch("managerLastName")
                            ? `${form.watch("managerFirstName") || ""} ${form.watch("managerLastName") || ""}`.trim()
                            : ""
                        }
                        onChange={(val: string) => {
                          // Try to find the employee by name
                          const matched = employees.find(e => 
                            `${e.firstName} ${e.lastName}` === val || 
                            `${e.lastName} ${e.firstName}` === val
                          );
                          if (matched) {
                            form.setValue("managerEmployeeId", matched.id);
                            form.setValue("managerFirstName", matched.firstName);
                            form.setValue("managerLastName", matched.lastName);
                            form.setValue("managerEmail", matched.email);
                          } else if (val === "") {
                            form.setValue("managerEmployeeId", "");
                            form.setValue("managerFirstName", "");
                            form.setValue("managerLastName", "");
                            form.setValue("managerEmail", "");
                          } else {
                            // Manual input - clear the ID link
                            form.setValue("managerEmployeeId", "");
                            const parts = val.trim().split(/\s+/);
                            if (parts.length >= 2) {
                              form.setValue("managerFirstName", parts[0]);
                              form.setValue("managerLastName", parts.slice(1).join(" "));
                            } else {
                              form.setValue("managerFirstName", val);
                              form.setValue("managerLastName", "");
                            }
                          }
                        }}
                        placeholder="Vyberte nadřízeného (jméno, příjmení, email)"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Výběr ze seznamu vytvoří trvalé propojení – změny údajů nadřízeného se automaticky propsí.
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="managerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email nadřízeného (klíčové pole)</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} placeholder="nadrizeny@firma.cz" />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Tento email se použije pro automatické propojení s nadřízeným zaměstnancem.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

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

                {/* Date field for parental_leave and sick_leave */}
                {(selectedStatus === "parental_leave" || selectedStatus === "sick_leave") && (
                  <FormField
                    control={form.control}
                    name="statusStartDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          {selectedStatus === "parental_leave" ? "Datum od (mateřská/rodičovská)" : "Datum od (nemocenská)"}
                        </FormLabel>
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
                        <p className="text-xs text-muted-foreground">
                          Pokud nevyplníte, bude automaticky nastaveno aktuální datum.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Kategorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechny kategorie</SelectItem>
              <SelectItem value="1">Kategorie 1</SelectItem>
              <SelectItem value="2">Kategorie 2</SelectItem>
              <SelectItem value="3">Kategorie 3</SelectItem>
              <SelectItem value="4">Kategorie 4</SelectItem>
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

      {/* Status Legend + Count - above the table */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusLegend variant="employee" />
          <div className="flex items-center border border-border rounded-md ml-4">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="rounded-r-none"
            >
              <List className="w-4 h-4 mr-1" />
              Tabulka
            </Button>
            <Button
              variant={viewMode === "tree" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setViewMode("tree")}
              className="rounded-l-none"
            >
              <GitBranch className="w-4 h-4 mr-1" />
              Strom
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Celkem: {filteredEmployees.length} zaměstnanců
        </p>
      </div>

      {viewMode === "tree" ? (
        <Card className="p-4">
          <EmployeeHierarchyTree employees={filteredEmployees} />
        </Card>
      ) : (
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Os. číslo</TableHead>
              <TableHead>Jméno</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Pozice</TableHead>
              <TableHead>Středisko</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Nadřízený</TableHead>
              <TableHead>Stav</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                <TableCell className="text-center">
                  <WorkCategoryBadge category={employee.workCategory} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {employee.managerEmail ? (
                    <span title={employee.managerEmail}>
                      {employee.managerFirstName || employee.managerLastName 
                        ? `${employee.managerFirstName || ''} ${employee.managerLastName || ''}`.trim()
                        : employee.managerEmail}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell>
                  <EmployeeStatusBadge 
                    status={employee.status as EmployeeStatus} 
                    statusStartDate={employee.statusStartDate || employee.terminationDate}
                  />
                </TableCell>
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
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteMode === "delete" ? "Trvale smazat zaměstnance?" : "Jak chcete pokračovat?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {checkingDeps ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Kontrola závislostí...
                  </div>
                ) : deleteMode === "delete" ? (
                  <div className="space-y-2">
                    <p className="text-destructive font-medium">
                      Tato akce je nevratná!
                    </p>
                    <p>
                      Zaměstnanec <strong>{employeeToDelete?.firstName} {employeeToDelete?.lastName}</strong> bude trvale smazán.
                    </p>
                    {deleteDependencies && (deleteDependencies.trainingsCount > 0 || deleteDependencies.examinationsCount > 0) && (
                      <div className="bg-destructive/10 p-3 rounded-md text-sm">
                        <p className="font-medium text-destructive">Budou také smazány:</p>
                        <ul className="list-disc list-inside mt-1">
                          {deleteDependencies.trainingsCount > 0 && (
                            <li>{deleteDependencies.trainingsCount} školení</li>
                          )}
                          {deleteDependencies.examinationsCount > 0 && (
                            <li>{deleteDependencies.examinationsCount} lékařských prohlídek</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p>
                      Vyberte akci pro zaměstnance <strong>{employeeToDelete?.firstName} {employeeToDelete?.lastName}</strong>:
                    </p>
                    {deleteDependencies && (deleteDependencies.trainingsCount > 0 || deleteDependencies.examinationsCount > 0) && (
                      <div className="bg-muted p-3 rounded-md text-sm">
                        <p className="font-medium">Přiřazené záznamy:</p>
                        <ul className="list-disc list-inside mt-1 text-muted-foreground">
                          {deleteDependencies.trainingsCount > 0 && (
                            <li>{deleteDependencies.trainingsCount} školení</li>
                          )}
                          {deleteDependencies.examinationsCount > 0 && (
                            <li>{deleteDependencies.examinationsCount} lékařských prohlídek</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            {!checkingDeps && deleteMode === "deactivate" && (
              <>
                <Button 
                  variant="outline"
                  onClick={handleDeactivate}
                >
                  Deaktivovat (ukončit)
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => setDeleteMode("delete")}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Trvale smazat
                </Button>
              </>
            )}
            {!checkingDeps && deleteMode === "delete" && (
              <>
                <Button 
                  variant="outline"
                  onClick={() => setDeleteMode("deactivate")}
                >
                  Zpět
                </Button>
                <AlertDialogAction 
                  onClick={handlePermanentDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Potvrdit smazání
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
