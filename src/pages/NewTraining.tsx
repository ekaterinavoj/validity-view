import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, addDays } from "date-fns";
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
import { FormSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  employeeId: z.string().min(1, "Vyberte školenu osobu"),
  trainingTypeId: z.string().min(1, "Vyberte typ školení"),
  lastTrainingDate: z.date({ required_error: "Zadejte datum posledního školení" }),
  periodDays: z.string().min(1, "Zadejte periodicitu"),
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
  const [periodUnit, setPeriodUnit] = useState<"years" | "months" | "days">("years");
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);
  const { toast } = useToast();

  const { employees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useEmployees();
  const { trainingTypes, loading: typesLoading, error: typesError, refetch: refetchTypes } = useTrainingTypes();

  // Filter only active employees
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === "employed");
  }, [employees]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodDays: "365",
      remindDaysBefore: "30",
      repeatDaysAfter: "30",
    },
  });

  // Load reminder templates
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

  // Auto-set periodicity when training type is selected
  const selectedTrainingTypeId = form.watch("trainingTypeId");
  useEffect(() => {
    if (selectedTrainingTypeId) {
      const selectedType = trainingTypes.find(t => t.id === selectedTrainingTypeId);
      if (selectedType) {
        form.setValue("periodDays", selectedType.periodDays.toString());
        form.setValue("facility", selectedType.facility);
      }
    }
  }, [selectedTrainingTypeId, trainingTypes, form]);

  const lastTrainingDate = form.watch("lastTrainingDate");
  const periodDays = form.watch("periodDays");
  
  const expirationDate = useMemo(() => {
    if (!lastTrainingDate || !periodDays) return null;
    const days = parseInt(periodDays) || 0;
    if (days <= 0) return null;
    return addDays(lastTrainingDate, days);
  }, [lastTrainingDate, periodDays]);

  const onSubmit = async (data: FormValues) => {
    if (!user) {
      toast({
        title: "Chyba",
        description: "Musíte být přihlášeni.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const nextTrainingDate = expirationDate ? format(expirationDate, "yyyy-MM-dd") : null;
      
      // Calculate status based on next_training_date
      let status = "valid";
      if (nextTrainingDate) {
        const nextDate = new Date(nextTrainingDate);
        const today = new Date();
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) {
          status = "expired";
        } else if (daysUntil <= 30) {
          status = "warning";
        }
      }

      // Insert training into database
      const { data: newTraining, error: insertError } = await supabase
        .from("trainings")
        .insert({
          facility: data.facility,
          employee_id: data.employeeId,
          training_type_id: data.trainingTypeId,
          last_training_date: format(data.lastTrainingDate, "yyyy-MM-dd"),
          next_training_date: nextTrainingDate,
          trainer: data.trainer || null,
          company: data.company || null,
          reminder_template_id: data.reminderTemplateId,
          remind_days_before: parseInt(data.remindDaysBefore) || 30,
          repeat_days_after: parseInt(data.repeatDaysAfter) || 30,
          note: data.note || null,
          status,
          is_active: true,
          created_by: user.id,
          requester: profile ? `${profile.first_name} ${profile.last_name}` : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Upload documents
      if (uploadedFiles.length > 0 && newTraining) {
        const uploadPromises = uploadedFiles.map((uploadedFile) =>
          uploadTrainingDocument(
            newTraining.id,
            uploadedFile.file,
            uploadedFile.documentType,
            uploadedFile.description
          )
        );
        
        await Promise.all(uploadPromises);
      }

      toast({
        title: "Školení vytvořeno",
        description: `Nové školení bylo úspěšně přidáno${uploadedFiles.length > 0 ? ` se ${uploadedFiles.length} dokumenty` : ""}.`,
      });
      
      navigate("/");
    } catch (error: any) {
      console.error("Chyba při vytváření školení:", error);
      toast({
        title: "Chyba",
        description: error.message || "Nepodařilo se vytvořit školení.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const refetch = () => {
    refetchEmployees();
    refetchTypes();
  };

  if (employeesError || typesError) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Vytvoření nového školení</h2>
        <ErrorDisplay
          title="Nepodařilo se načíst data"
          message={employeesError || typesError || "Zkuste to prosím znovu."}
          onRetry={refetch}
        />
      </div>
    );
  }

  if (employeesLoading || typesLoading) {
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
                  <FormControl>
                    <Input {...field} placeholder="Provozovna" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Školená osoba *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte školenu osobu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.lastName} {emp.firstName} ({emp.employeeNumber})
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

            <FormField
              control={form.control}
              name="periodDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Periodicita (dní) *</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
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

            <div className="space-y-2">
              <Label>Dokumenty ke školení</Label>
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

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? "Vytváří se..." : "Vytvořit školení"}
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
