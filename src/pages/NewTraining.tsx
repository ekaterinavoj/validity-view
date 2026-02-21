import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { FileUploader, UploadedFile } from "@/components/FileUploader";
import { uploadTrainingDocument } from "@/lib/trainingDocuments";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useTrainingTypes } from "@/hooks/useTrainingTypes";
import { useFacilities } from "@/hooks/useFacilities";
import { FormSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { EmployeeMultiSelect } from "@/components/EmployeeMultiSelect";
import { Progress } from "@/components/ui/progress";
import { 
  PeriodicityInput, 
  PeriodicityUnit, 
  daysToPeriodicityUnit, 
  periodicityToDays, 
  calculateNextDate 
} from "@/components/PeriodicityInput";

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  employeeIds: z.array(z.string()).min(1, "Vyberte alespoň jednoho zaměstnance"),
  trainingTypeId: z.string().min(1, "Vyberte typ školení"),
  lastTrainingDate: z.date({ required_error: "Zadejte datum posledního školení" }),
  periodValue: z.number().min(1, "Zadejte periodicitu"),
  periodUnit: z.enum(["days", "months", "years"]),
  trainer: z.string().optional(),
  company: z.string().optional(),
  reminderTemplateId: z.string().min(1, "Vyberte šablonu připomenutí"),
  remindDaysBefore: z.string().min(1, "Zadejte počet dní"),
  repeatDaysAfter: z.string().min(1, "Zadejte počet dní"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTraining() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [periodUnit, setPeriodUnit] = useState<PeriodicityUnit>("years");
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);
  const { toast } = useToast();

  const { employees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useEmployees();
  const { trainingTypes, loading: typesLoading, error: typesError, refetch: refetchTypes } = useTrainingTypes();
  const { facilities, loading: facilitiesLoading, error: facilitiesError, refetch: refetchFacilities } = useFacilities();

  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === "employed");
  }, [employees]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeIds: [],
      periodValue: 1,
      periodUnit: "years",
      remindDaysBefore: "30",
      repeatDaysAfter: "30",
    },
  });

  useEffect(() => {
    const loadTemplates = async () => {
      const { data, error } = await supabase
        .from("reminder_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (!error && data) {
        setReminderTemplates(data);
      }
    };
    loadTemplates();
  }, []);

  const selectedTrainingTypeId = form.watch("trainingTypeId");
  useEffect(() => {
    if (selectedTrainingTypeId) {
      const selectedType = trainingTypes.find(t => t.id === selectedTrainingTypeId);
      if (selectedType) {
        const { value, unit } = daysToPeriodicityUnit(selectedType.periodDays);
        form.setValue("periodValue", value);
        form.setValue("periodUnit", unit);
        setPeriodUnit(unit);
        form.setValue("facility", selectedType.facility);
      }
    }
  }, [selectedTrainingTypeId, trainingTypes, form]);

  const lastTrainingDate = form.watch("lastTrainingDate");
  const periodValue = form.watch("periodValue");
  const watchedPeriodUnit = form.watch("periodUnit");
  
  const expirationDate = useMemo(() => {
    if (!lastTrainingDate || !periodValue) return null;
    if (periodValue <= 0) return null;
    return calculateNextDate(lastTrainingDate, periodValue, watchedPeriodUnit as PeriodicityUnit);
  }, [lastTrainingDate, periodValue, watchedPeriodUnit]);

  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({ title: "Chyba", description: "Musíte být přihlášeni.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(0);
    
    try {
      const nextTrainingDate = expirationDate ? format(expirationDate, "yyyy-MM-dd") : format(data.lastTrainingDate, "yyyy-MM-dd");
      
      let status = "valid";
      const nextDate = new Date(nextTrainingDate);
      const today = new Date();
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) {
        status = "expired";
      } else if (daysUntil <= 30) {
        status = "warning";
      }

      const totalEmployees = data.employeeIds.length;
      let created = 0;
      let failed = 0;

      for (const employeeId of data.employeeIds) {
        try {
          const { data: newTraining, error: insertError } = await supabase
            .from("trainings")
            .insert([{
              facility: data.facility,
              employee_id: employeeId,
              training_type_id: data.trainingTypeId,
              last_training_date: format(data.lastTrainingDate, "yyyy-MM-dd"),
              next_training_date: nextTrainingDate,
              trainer: data.trainer || undefined,
              company: data.company || undefined,
              reminder_template_id: data.reminderTemplateId || undefined,
              remind_days_before: parseInt(data.remindDaysBefore) || 30,
              repeat_days_after: parseInt(data.repeatDaysAfter) || 30,
              note: data.note || undefined,
              status,
              is_active: true,
              created_by: user.id,
              requester: profile ? `${profile.first_name} ${profile.last_name}` : undefined,
            }])
            .select()
            .single();

          if (insertError) throw insertError;

          // Upload documents for first employee only (shared docs)
          if (uploadedFiles.length > 0 && newTraining && created === 0) {
            const uploadPromises = uploadedFiles.map((uploadedFile) =>
              uploadTrainingDocument(newTraining.id, uploadedFile.file, uploadedFile.documentType, uploadedFile.description)
            );
            await Promise.all(uploadPromises);
          }

          created++;
        } catch (err) {
          console.error(`Chyba při vytváření školení pro zaměstnance ${employeeId}:`, err);
          failed++;
        }
        setSubmitProgress(Math.round(((created + failed) / totalEmployees) * 100));
      }

      if (created > 0) {
        toast({
          title: "Školení vytvořena",
          description: `Úspěšně vytvořeno ${created} školení${failed > 0 ? `, ${failed} se nepodařilo` : ""}.`,
        });
        navigate("/");
      } else {
        toast({ title: "Chyba", description: "Nepodařilo se vytvořit žádné školení.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Chyba při vytváření školení:", error);
      toast({ title: "Chyba", description: error.message || "Nepodařilo se vytvořit školení.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
      setSubmitProgress(0);
    }
  };

  const refetch = () => {
    refetchEmployees();
    refetchTypes();
    refetchFacilities();
  };

  if (employeesError || typesError || facilitiesError) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Vytvoření nového školení</h2>
        <ErrorDisplay title="Nepodařilo se načíst data" message={employeesError || typesError || facilitiesError || "Zkuste to prosím znovu."} onRetry={refetch} />
      </div>
    );
  }

  if (employeesLoading || typesLoading || facilitiesLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Vytvoření nového školení</h2>
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Vytvoření nového školení</h2>
      
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="trainingTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ školení *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte typ školení" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {trainingTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} ({type.periodDays} dní)
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
                      {facilities.map((facility) => (
                        <SelectItem key={facility.id} value={facility.code}>
                          {facility.name}
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
              name="employeeIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Školené osoby *</FormLabel>
                  <FormControl>
                    <EmployeeMultiSelect
                      employees={activeEmployees}
                      selectedIds={field.value}
                      onChange={field.onChange}
                      placeholder="Vyberte zaměstnance (lze více)"
                      error={form.formState.errors.employeeIds?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastTrainingDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Datum školení *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "dd.MM.yyyy", { locale: cs }) : "Vyberte datum"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PeriodicityInput
              value={form.watch("periodValue")}
              unit={form.watch("periodUnit") as PeriodicityUnit}
              onValueChange={(val) => form.setValue("periodValue", val)}
              onUnitChange={(unit) => {
                form.setValue("periodUnit", unit);
                setPeriodUnit(unit);
              }}
              label="Periodicita"
              required
            />

            {expirationDate && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium">
                  Platnost školení do: <span className="font-bold">{format(expirationDate, "d. MMMM yyyy", { locale: cs })}</span>
                </p>
              </div>
            )}

            <FormField control={form.control} name="trainer" render={({ field }) => (
              <FormItem><FormLabel>Školitel</FormLabel><FormControl><Input {...field} placeholder="Jméno školitele" /></FormControl><FormMessage /></FormItem>
            )} />

            <FormField control={form.control} name="company" render={({ field }) => (
              <FormItem><FormLabel>Školící firma</FormLabel><FormControl><Input {...field} placeholder="Název firmy" /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Dokumenty (protokol, certifikát)</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Nahrajte protokoly, certifikáty nebo jiné dokumenty k tomuto školení
                </p>
              </div>
              <FileUploader files={uploadedFiles} onFilesChange={setUploadedFiles} maxFiles={10} maxSize={20} acceptedTypes={[".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]} />
            </div>

            <FormField control={form.control} name="reminderTemplateId" render={({ field }) => (
              <FormItem>
                <FormLabel>Šablona připomenutí *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Vyberte šablonu" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {reminderTemplates.map((t) => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="remindDaysBefore" render={({ field }) => (
                <FormItem><FormLabel>Připomenout dopředu (dní) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="repeatDaysAfter" render={({ field }) => (
                <FormItem><FormLabel>Opakovat po (dní)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <FormField control={form.control} name="note" render={({ field }) => (
              <FormItem><FormLabel>Poznámka</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="space-y-2">
              <Label>Zadavatel</Label>
              <Input value={profile ? `${profile.first_name} ${profile.last_name}` : 'Načítání...'} disabled className="bg-muted" />
            </div>

            {isSubmitting && submitProgress > 0 && (
              <div className="space-y-2">
                <Progress value={submitProgress} />
                <p className="text-xs text-muted-foreground text-center">Vytvářím školení... {submitProgress}%</p>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? "Vytváří se..." : `Vytvořit školení${form.watch("employeeIds").length > 1 ? ` (${form.watch("employeeIds").length} osob)` : ""}`}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/")} disabled={isSubmitting}>
                Zrušit
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
