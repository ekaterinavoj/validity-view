import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { formatDisplayDate } from "@/lib/dateFormat";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
import { PeriodicityInput, PeriodicityUnit, daysToPeriodicityUnit, periodicityToDays, formatPeriodicityDisplay } from "@/components/PeriodicityInput";
import { calculateNextDateFromPeriodDays } from "@/lib/effectivePeriod";
import { MedicalDocumentsList } from "@/components/MedicalDocumentsList";
import { HealthRisksSection } from "@/components/HealthRisksSection";
import { createEmptyHealthRisks, fromDbHealthRisks, toDbHealthRisks, type HealthRisks } from "@/lib/healthRisks";
import {
  medicalExaminationResultOptions,
  medicalExaminationResultRequiresLossDate,
  medicalExaminationResultRequiresNote,
  getMedicalExaminationStatusFromResult,
} from "@/lib/medicalExaminationResults";

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  employeeId: z.string().min(1, "Vyberte zaměstnance"),
  examinationTypeId: z.string().min(1, "Vyberte typ prohlídky"),
  lastExaminationDate: z.date({ required_error: "Zadejte datum prohlídky" }),
  periodValue: z.number().min(1, "Zadejte periodicitu").nullable(),
  periodUnit: z.enum(["days", "months", "years"]),
  doctor: z.string().optional(),
  medicalFacility: z.string().optional(),
  result: z.string().optional(),
  reminderTemplateId: z.string().min(1, "Vyberte šablonu připomenutí"),
  remindDaysBefore: z.string().min(1, "Zadejte počet dní"),
  repeatDaysAfter: z.string().min(1, "Zadejte počet dní"),
  note: z.string().optional(),
  longTermFitnessLossDate: z.date().optional(),
}).superRefine((values, ctx) => {
  if (medicalExaminationResultRequiresNote(values.result) && !values.note?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "U výsledku s podmínkou nebo omezením musíte doplnit poznámku.",
      path: ["note"],
    });
  }

  if (medicalExaminationResultRequiresLossDate(values.result) && !values.longTermFitnessLossDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vyberte datum pozbytí dlouhodobé zdravotní způsobilosti.",
      path: ["longTermFitnessLossDate"],
    });
  }
});

type FormValues = z.infer<typeof formSchema>;

export default function EditMedicalExamination() {
  const { id } = useParams();
  const { profile, user, isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periodUnit, setPeriodUnit] = useState<PeriodicityUnit>("years");
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);
  const [healthRisks, setHealthRisks] = useState<HealthRisks>(createEmptyHealthRisks());
  const { toast } = useToast();

  const { employees, loading: employeesLoading, error: employeesError, refetch: refetchEmployees } = useEmployees();
  const { examinationTypes, loading: typesLoading, error: typesError, refetch: refetchTypes } = useMedicalExaminationTypes();
  const { facilities, loading: facilitiesLoading, error: facilitiesError, refetch: refetchFacilities } = useFacilities();

  const selectableEmployees = useMemo(() => {
    return employees.filter((e) => e.status !== "terminated");
  }, [employees]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodValue: null,
      periodUnit: "years",
      remindDaysBefore: "30",
      repeatDaysAfter: "30",
      result: "passed",
    },
  });

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
          const { data: examType } = await supabase
            .from("medical_examination_types")
            .select("period_days")
            .eq("id", exam.examination_type_id)
            .single();

          const typePeriod = examType?.period_days ?? 365;
          const { unit: typeUnit } = daysToPeriodicityUnit(typePeriod);
          const overridePeriod = exam.period_days_override != null
            ? daysToPeriodicityUnit(exam.period_days_override)
            : null;

          form.reset({
            facility: exam.facility,
            employeeId: exam.employee_id,
            examinationTypeId: exam.examination_type_id,
            lastExaminationDate: new Date(exam.last_examination_date),
            periodValue: overridePeriod?.value ?? null,
            periodUnit: overridePeriod?.unit ?? typeUnit,
            doctor: exam.doctor || "",
            medicalFacility: exam.medical_facility || "",
            result: exam.result || "passed",
            reminderTemplateId: exam.reminder_template_id || "",
            remindDaysBefore: String(exam.remind_days_before || 30),
            repeatDaysAfter: String(exam.repeat_days_after || 30),
            note: exam.note || "",
            longTermFitnessLossDate: exam.long_term_fitness_loss_date ? new Date(exam.long_term_fitness_loss_date) : undefined,
          });
          setHealthRisks(fromDbHealthRisks(exam.zdravotni_rizika));
          setPeriodUnit(overridePeriod?.unit ?? typeUnit);
        }
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

  const selectedTypeId = form.watch("examinationTypeId");
  const selectedType = examinationTypes.find((type) => type.id === selectedTypeId);
  const lastExaminationDate = form.watch("lastExaminationDate");
  const periodValue = form.watch("periodValue");
  const watchedPeriodUnit = form.watch("periodUnit");
  const overridePeriodDays = periodValue != null ? periodicityToDays(periodValue, watchedPeriodUnit as PeriodicityUnit) : null;
  const typePeriodHint = selectedType
    ? `Prázdné = použije se primární perioda typu (${formatPeriodicityDisplay(
        daysToPeriodicityUnit(selectedType.periodDays).value,
        daysToPeriodicityUnit(selectedType.periodDays).unit
      )})`
    : "Prázdné = použije se primární perioda typu";

  useEffect(() => {
    if (selectedType && form.getValues("periodValue") == null) {
      const { unit } = daysToPeriodicityUnit(selectedType.periodDays);
      form.setValue("periodUnit", unit);
      setPeriodUnit(unit);
    }
  }, [selectedType, form]);

  const selectedResult = form.watch("result");
  const longTermFitnessLossDate = form.watch("longTermFitnessLossDate");

  const expirationDate = useMemo(() => {
    if (!lastExaminationDate || !selectedType) return null;
    return calculateNextDateFromPeriodDays(lastExaminationDate, overridePeriodDays, selectedType.periodDays);
  }, [lastExaminationDate, overridePeriodDays, selectedType]);

  const onSubmit = async (data: FormValues) => {
    if (!user || !id) {
      toast({ title: "Chyba", description: "Musíte být přihlášeni.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      if (!selectedType) {
        throw new Error("Vyberte typ prohlídky");
      }

      const overridePeriodDays = data.periodValue != null
        ? periodicityToDays(data.periodValue, data.periodUnit as PeriodicityUnit)
        : null;
      const nextExaminationDate = format(
        calculateNextDateFromPeriodDays(data.lastExaminationDate, overridePeriodDays, selectedType.periodDays),
        "yyyy-MM-dd"
      );

      let status = getMedicalExaminationStatusFromResult(data.result, "valid");
      if (nextExaminationDate && status !== "expired") {
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
          next_examination_date: nextExaminationDate ?? undefined,
          doctor: data.doctor || undefined,
          medical_facility: data.medicalFacility || undefined,
          result: data.result || undefined,
          reminder_template_id: data.reminderTemplateId || undefined,
          period_days_override: overridePeriodDays,
          remind_days_before: parseInt(data.remindDaysBefore) || 30,
          repeat_days_after: parseInt(data.repeatDaysAfter) || 30,
          note: data.note?.trim() || null,
          long_term_fitness_loss_date: data.longTermFitnessLossDate ? format(data.longTermFitnessLossDate, "yyyy-MM-dd") : null,
          zdravotni_rizika: toDbHealthRisks(healthRisks),
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (updateError) throw updateError;

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

      await queryClient.invalidateQueries({ queryKey: ["medical-examinations"] });
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
        <h1 className="text-2xl font-bold text-foreground">Úprava lékařské prohlídky</h1>
        <FormSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                    <FormControl>
                      <SelectTrigger disabled={!canEdit}>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                    <FormControl>
                      <SelectTrigger disabled={!canEdit}>
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                    <FormControl>
                      <SelectTrigger disabled={!canEdit}>
                        <SelectValue placeholder="Vyberte zaměstnance" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {selectableEmployees.map((emp) => (
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
                        <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={!canEdit}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? formatDisplayDate(field.value) : "Vyberte datum"}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={canEdit ? field.onChange : undefined} initialFocus disabled={!canEdit} />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PeriodicityInput
              value={form.watch("periodValue")}
              unit={form.watch("periodUnit") as PeriodicityUnit}
              onValueChange={(val) => {
                if (canEdit) {
                  form.setValue("periodValue", val);
                }
              }}
              onUnitChange={(unit) => {
                if (canEdit) {
                  form.setValue("periodUnit", unit);
                  setPeriodUnit(unit);
                }
              }}
              label="Periodicita override (nepovinné)"
              placeholder="Nepovinné"
              emptyHint={typePeriodHint}
              disabled={!canEdit}
            />

            {expirationDate && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium">
                  Platnost do: <span className="font-bold">{formatDisplayDate(expirationDate)}</span>
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
                      <Input {...field} placeholder="Jméno lékaře" disabled={!canEdit} />
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
                      <Input {...field} placeholder="Název zařízení" disabled={!canEdit} />
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
                  <Select value={field.value || "passed"} onValueChange={field.onChange} disabled={!canEdit}>
                    <FormControl>
                      <SelectTrigger disabled={!canEdit}>
                        <SelectValue placeholder="Vyberte výsledek" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {medicalExaminationResultOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {medicalExaminationResultRequiresLossDate(selectedResult) && (
              <FormField
                control={form.control}
                name="longTermFitnessLossDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Datum pozbytí dlouhodobé zdravotní způsobilosti</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={!canEdit}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? formatDisplayDate(field.value) : "Vyberte datum"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={canEdit ? field.onChange : undefined} initialFocus disabled={!canEdit} />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {medicalExaminationResultRequiresNote(selectedResult) && (
              <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-4 text-sm text-foreground">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-status-warning" />
                  <p>Prohlídka zůstává platná, ale musíte doplnit podmínku nebo omezení do poznámky.</p>
                </div>
              </div>
            )}

            <HealthRisksSection value={healthRisks} onChange={setHealthRisks} disabled={!canEdit} />

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
                  <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                    <FormControl>
                      <SelectTrigger disabled={!canEdit}>
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
                  <FormLabel>{medicalExaminationResultRequiresNote(selectedResult) ? "Podmínka / omezení *" : "Poznámka"}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} placeholder={medicalExaminationResultRequiresNote(selectedResult) ? "Popište podmínku nebo omezení" : undefined} />
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
