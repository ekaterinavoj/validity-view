import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Edit, Plus, Trash2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatPeriodicity } from "@/lib/utils";
import { useFacilities } from "@/hooks/useFacilities";

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
  id: string;
  facility: string;
  name: string;
  period_days: number;
  duration_hours: number;
  description?: string;
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodValue: "2",
      periodUnit: "years",
      durationHours: "2",
      description: "",
    },
  });

  // Načtení typů školení z databáze
  const loadTrainingTypes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("training_types")
        .select("*")
        .order("name");

      if (error) throw error;
      setTrainingTypes(data || []);
    } catch (error) {
      console.error("Chyba při načítání typů školení:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se načíst typy školení.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrainingTypes();
  }, []);

  // Helper to get facility name from code
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

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const periodDays = convertToDays(parseFloat(data.periodValue), data.periodUnit);
      const durationHours = parseFloat(data.durationHours);

      const trainingTypeData = {
        facility: data.facility,
        name: data.name,
        period_days: periodDays,
        duration_hours: durationHours,
        description: data.description || null,
      };

      if (editingType) {
        // Aktualizace existujícího typu
        const { error } = await supabase
          .from("training_types")
          .update(trainingTypeData)
          .eq("id", editingType.id);

        if (error) throw error;

        toast({
          title: "Typ školení aktualizován",
          description: "Typ školení byl úspěšně upraven.",
        });
      } else {
        // Vytvoření nového typu
        const { error } = await supabase
          .from("training_types")
          .insert([trainingTypeData]);

        if (error) throw error;

        toast({
          title: "Typ školení vytvořen",
          description: "Nový typ školení byl úspěšně přidán.",
        });
      }

      setDialogOpen(false);
      setEditingType(null);
      form.reset();
      loadTrainingTypes();
    } catch (error) {
      console.error("Chyba při ukládání typu školení:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit typ školení.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (type: TrainingType) => {
    setEditingType(type);
    
    // Nastavení hodnot formuláře
    const periodUnit: "days" | "months" | "years" = 
      type.period_days % 365 === 0 ? "years" : 
      type.period_days % 30 === 0 ? "months" : "days";
    
    const periodValue = convertFromDays(type.period_days, periodUnit);

    form.reset({
      facility: type.facility,
      name: type.name,
      periodValue: periodValue.toString(),
      periodUnit: periodUnit,
      durationHours: type.duration_hours.toString(),
      description: type.description || "",
    });

    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;

    try {
      // Check for dependent trainings
      const { count, error: countError } = await supabase
        .from("trainings")
        .select("id", { count: "exact", head: true })
        .eq("training_type_id", typeToDelete.id);

      if (countError) throw countError;

      if (count && count > 0) {
        toast({
          title: "Nelze smazat",
          description: `Typ školení "${typeToDelete.name}" má přiřazených ${count} školení. Nejprve odstraňte nebo přesuňte tato školení.`,
          variant: "destructive",
        });
        setDeleteDialogOpen(false);
        setTypeToDelete(null);
        return;
      }

      const { error } = await supabase
        .from("training_types")
        .delete()
        .eq("id", typeToDelete.id);

      if (error) throw error;

      toast({
        title: "Typ školení smazán",
        description: "Typ školení byl úspěšně odstraněn.",
      });

      loadTrainingTypes();
    } catch (error) {
      console.error("Chyba při mazání typu školení:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se smazat typ školení.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
    }
  };

  const openDeleteDialog = (type: TrainingType) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingType(null);
      form.reset();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-foreground">Typy školení</h2>
        
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Přidat nový typ
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingType ? "Upravit typ školení" : "Nový typ školení"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="facility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provozovna *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Vyberte provozovnu" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {facilitiesLoading ? (
                            <SelectItem value="" disabled>Načítání...</SelectItem>
                          ) : facilities.length === 0 ? (
                            <SelectItem value="" disabled>Žádné provozovny</SelectItem>
                          ) : (
                            facilities.map((facility) => (
                              <SelectItem key={facility.id} value={facility.code}>
                                {facility.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Název typu události *</FormLabel>
                      <FormControl>
                        <Input placeholder="např. ATEX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="durationHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Délka školení (hodiny) *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.5" placeholder="např. 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Periodicita *</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormField
                      control={form.control}
                      name="periodValue"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input type="number" step="0.1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="periodUnit"
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="days">Dní</SelectItem>
                              <SelectItem value="months">Měsíců</SelectItem>
                              <SelectItem value="years">Roků</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Popis školení</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Volitelný popis typu školení..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isSubmitting ? "Ukládá se..." : "Uložit"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => handleDialogClose(false)}
                    disabled={isSubmitting}
                  >
                    Zrušit
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        {isLoading ? (
          <div className="flex justify-center items-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provozovna</TableHead>
                <TableHead>Název</TableHead>
                <TableHead>Periodicita</TableHead>
                <TableHead>Délka (hodiny)</TableHead>
                <TableHead>Popis</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trainingTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Žádné typy školení nenalezeny. Přidejte nový typ školení.
                  </TableCell>
                </TableRow>
              ) : (
                trainingTypes.map((type) => {
                  const displayPeriod = formatPeriodicity(type.period_days);

                    return (
                    <TableRow key={type.id}>
                      <TableCell className="text-sm">{getFacilityName(type.facility)}</TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell>{displayPeriod}</TableCell>
                      <TableCell>{type.duration_hours}</TableCell>
                      <TableCell className="max-w-xs truncate" title={type.description || ""}>
                        {type.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleEdit(type)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openDeleteDialog(type)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu chcete smazat tento typ školení?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Typ školení "{typeToDelete?.name}" bude trvale odstraněn z databáze.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
