import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { FileUploader, UploadedFile } from "@/components/FileUploader";
import { uploadMedicalDocument } from "@/lib/medicalDocuments";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useParams } from "react-router-dom";
import { useEmployees } from "@/hooks/useEmployees";
import { useMedicalExaminationTypes } from "@/hooks/useMedicalExaminationTypes";
import { useFacilities } from "@/hooks/useFacilities";
import { FormSkeleton } from "@/components/LoadingSkeletons";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { PeriodicityInput, PeriodicityUnit, daysToPeriodicityUnit, calculateNextDate, periodicityToDays } from "@/components/PeriodicityInput";
import { MedicalDocumentsList } from "@/components/MedicalDocumentsList";

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  employeeId: z.string().min(1, "Vyberte zaměstnance"),
  examinationTypeId: z.string().min(1, "Vyberte typ prohlídky"),
  lastExaminationDate: z.date({ required_error: "Zadejte datum prohlídky" }),
  periodValue: z.number().min(1, "Zadejte periodicitu"),
  periodUnit: z.enum(["days", "months", "years"]),
  doctor: z.string().optional(),
  medicalFacility: z.string().optional(),
  result: z.string().optional(),
  reminderTemplateId: z.string().min(1, "Vyberte šablonu připomenutí"),
  remindDaysBefore: z.string().min(1, "Zadejte počet dní"),
  repeatDaysAfter: z.string().min(1, "Zadejte počet dní"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditMedicalExamination() {
  const { id } = useParams();
  const { profile, user, isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periodUnit, setPeriodUnit] = useState<PeriodicityUnit>("years");
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);
  const { toast } = useToast();

  const { employees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useEmployees();
  const { examinationTypes, loading: typesLoading, error: typesError, refetch: refetchTypes } = useMedicalExaminationTypes();
  const { facilities, loading: facilitiesLoading, error: facilitiesError, refetch: refetchFacilities } = useFacilities();

  const activeEmployees = useMemo(() => {
    return employees.filter((e) => e.status === "employed");
  }, [employees]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodValue: 1,
      periodUnit: "years",
      remindDaysBefore: "30",
      repeatDaysAfter: "30",
    },
  });

  // Load examination data
  useEffect(() => {
    const loadExamination = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        const { data: exam, error } = await supabase
          .from("medical_examinations")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;

        if (exam) {
          const { value: periodVal, unit: periodU } = daysToPeriodicityUnit(
            periodicityToDays(1, "years") // We'll calculate from type
          );
          
          // Get period from examination type
          const { data: examType } = await supabase
            .from("medical_examination_types")
            .select("period_days")
            .eq("id", exam.examination_type_id)
            .single();
          
          const { value, unit } = examType 
            ? daysToPeriodicityUnit(examType.period_days)
            : { value: 1, unit: "years" as PeriodicityUnit };

          form.reset({
            facility: exam.facility,
            employeeId: exam.employee_id,
            examinationTypeId: exam.examination_type_id,
            lastExaminationDate: new Date(exam.last_examination_date),
            periodValue: value,
            periodUnit: unit,
            doctor: exam.doctor || "",
            medicalFacility: exam.medical_facility || "",
            result: exam.result || "",
            reminderTemplateId: exam.reminder_template_id || "",
            remindDaysBefore: String(exam.remind_days_before || 30),
            repeatDaysAfter: String(exam.repeat_days_after || 30),
            note: exam.note || "",
          });
          setPeriodUnit(unit);
        }

        // Documents are now loaded by MedicalDocumentsList component
      } catch (error: any) {
        toast({
          title: "Chyba při načítání",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadExamination();
  }, [id, form, toast]);

  useEffect(() => {
    const loadTemplates = async () => {
      const { data, error } = await supabase.from("medical_reminder_templates").select("*").eq("is_active", true).order("name");
      if (!error && data) {
        setReminderTemplates(data);
      }
    };
    loadTemplates();
  }, []);

  const lastExaminationDate = form.watch("lastExaminationDate");
  const periodValue = form.watch("periodValue");
  const watchedPeriodUnit = form.watch("periodUnit");

  const expirationDate = useMemo(() => {
    if (!lastExaminationDate || !periodValue) return null;
    if (periodValue <= 0) return null;
    return calculateNextDate(lastExaminationDate, periodValue, watchedPeriodUnit as PeriodicityUnit);
  }, [lastExaminationDate, periodValue, watchedPeriodUnit]);

  const onSubmit = async (data: FormValues) => {
    if (!user || !id) {
      toast({ title: "Chyba", description: "Musíte být přihlášeni.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const nextExaminationDate = expirationDate ? format(expirationDate, "yyyy-MM-dd") : null;

      let status = "valid";
      if (nextExaminationDate) {
        const nextDate = new Date(nextExaminationDate);
        const today = new Date();
        const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntil < 0) {
          status = "expired";
        } else if (daysUntil <= 30) {
          status = "warning";
        }
      }

      const { error: updateError } = await supabase
        .from("medical_examinations")
        .update({
          facility: data.facility,
          employee_id: data.employeeId,
          examination_type_id: data.examinationTypeId,
          last_examination_date: format(data.lastExaminationDate, "yyyy-MM-dd"),
          next_examination_date: nextExaminationDate,
          doctor: data.doctor || null,
          medical_facility: data.medicalFacility || null,
          result: data.result || null,
          reminder_template_id: data.reminderTemplateId,
          remind_days_before: parseInt(data.remindDaysBefore) || 30,
          repeat_days_after: parseInt(data.repeatDaysAfter) || 30,
          note: data.note || null,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // New files are always added to existing documents (no replacement)

      // Upload new files
      if (uploadedFiles.length > 0) {
        const uploadPromises = uploadedFiles.map((uploadedFile) =>
          uploadMedicalDocument(id, uploadedFile.file, uploadedFile.documentType, uploadedFile.description)
        );
        await Promise.all(uploadPromises);
      }

      toast({
        title: "Prohlídka aktualizována",
        description: "Změny byly úspěšně uloženy.",
      });

      navigate("/plp");
    } catch (error: any) {
      console.error("Chyba při aktualizaci prohlídky:", error);
      toast({ title: "Chyba", description: error.message || "Nepodařilo se aktualizovat prohlídku.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
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
        <h2 className="text-3xl font-bold text-foreground">Úprava lékařské prohlídky</h2>
        <ErrorDisplay title="Nepodařilo se načíst data" message={employeesError || typesError || facilitiesError || "Zkuste to prosím znovu."} onRetry={refetch} />
      </div>
    );
  }

  if (loading || employeesLoading || typesLoading || facilitiesLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold text-foreground">Úprava lékařské prohlídky</h2>
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!canEdit && (
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Režim pouze pro čtení</p>
            <p className="text-xs text-muted-foreground">Můžete prohlížet dokumenty, ale nemáte oprávnění provádět změny.</p>
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/plp")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-foreground">Úprava lékařské prohlídky</h2>
          <p className="text-muted-foreground mt-1">ID: {id}</p>
        </div>
      </div>

      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="examinationTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ prohlídky *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte typ prohlídky" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {examinationTypes.map((type) => (
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
              name="employeeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zaměstnanec *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte zaměstnance" />
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
              name="lastExaminationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Datum prohlídky *</FormLabel>
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
                  Platnost do: <span className="font-bold">{format(expirationDate, "d. MMMM yyyy", { locale: cs })}</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="doctor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lékař</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Jméno lékaře" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="medicalFacility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Zdravotnické zařízení</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Název zařízení" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="result"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Výsledek prohlídky</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="např. Způsobilý bez omezení" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Existing Documents */}
            {id && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Nahrané dokumenty</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Dokumenty již nahrané k této prohlídce. Můžete je stáhnout nebo zobrazit{canEdit ? ", případně smazat" : ""}.
                  </p>
                </div>
                <MedicalDocumentsList examinationId={id} canDelete={canEdit} />
              </div>
            )}

            {/* New Document Upload - only for admin/manager */}
            {canEdit && (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Přidat nové dokumenty</Label>
                  <p className="text-xs text-muted-foreground mt-1">Nahrajte lékařské zprávy nebo jiné dokumenty</p>
                </div>
                <FileUploader 
                  files={uploadedFiles} 
                  onFilesChange={setUploadedFiles} 
                  maxFiles={10} 
                  maxSize={20} 
                  acceptedTypes={[".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]} 
                />
              </div>
            )}

            <FormField
              control={form.control}
              name="reminderTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Šablona připomenutí *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte šablonu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reminderTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="remindDaysBefore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Připomenout dopředu (dní) *</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="repeatDaysAfter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opakovat po (dní)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poznámka</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button type="button" variant="outline" onClick={() => navigate("/plp")}>
                {canEdit ? "Zrušit" : "Zpět"}
              </Button>
              {canEdit && (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Uložit změny
                </Button>
              )}
            </div>
          </form>
        </Form>
      </Card>

    </div>
  );
}
