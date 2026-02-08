import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useEquipment } from "@/hooks/useEquipment";
import { useDeadlineTypes } from "@/hooks/useDeadlineTypes";
import { useFacilities } from "@/hooks/useFacilities";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TableSkeleton } from "@/components/LoadingSkeletons";
import { cn } from "@/lib/utils";
import { FileUploader, UploadedFile } from "@/components/FileUploader";
import { uploadDeadlineDocument } from "@/lib/deadlineDocuments";
import { ResponsiblesPicker, ResponsiblesSelection } from "@/components/ResponsiblesPicker";
import { useDeadlineResponsibles } from "@/hooks/useDeadlineResponsibles";
import { DeadlineDocumentsList } from "@/components/DeadlineDocumentsList";
import { 
  PeriodicityInput, 
  PeriodicityUnit, 
  daysToPeriodicityUnit, 
  periodicityToDays, 
  calculateNextDate 
} from "@/components/PeriodicityInput";

const formSchema = z.object({
  deadline_type_id: z.string().min(1, "Vyberte typ události"),
  equipment_id: z.string().min(1, "Vyberte zařízení"),
  facility: z.string().min(1, "Vyberte provozovnu"),
  last_check_date: z.date({ required_error: "Vyberte datum poslední kontroly" }),
  period_value: z.number().min(1, "Zadejte periodicitu"),
  period_unit: z.enum(["days", "months", "years"]),
  performer: z.string().optional(),
  company: z.string().optional(),
  note: z.string().optional(),
  reminder_template_id: z.string().min(1, "Vyberte šablonu připomenutí"),
  remind_days_before: z.number().min(1, "Zadejte počet dní"),
  repeat_days_after: z.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditDeadline() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, isAdmin, isManager } = useAuth();
  const canEdit = isAdmin || isManager;
  const { equipment } = useEquipment();
  const { deadlineTypes } = useDeadlineTypes();
  const { facilities } = useFacilities();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);
  const [requester, setRequester] = useState<string>("");
  
  // Document management state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [documentsKey, setDocumentsKey] = useState(0); // For refreshing documents list
  
  // Responsibles state
  const [responsibles, setResponsibles] = useState<ResponsiblesSelection>({ profileIds: [], groupIds: [] });
  const [responsiblesError, setResponsiblesError] = useState<string | null>(null);
  const { responsibles: existingResponsibles, setResponsibles: saveResponsibles, isLoading: responsiblesLoading } = useDeadlineResponsibles(id);

  const [periodValue, setPeriodValue] = useState<number>(1);
  const [periodUnit, setPeriodUnit] = useState<PeriodicityUnit>("years");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      period_value: 1,
      period_unit: "years",
      remind_days_before: 30,
      repeat_days_after: 30,
    },
  });

  const lastCheckDate = form.watch("last_check_date");

  const nextCheckDate = lastCheckDate && periodValue
    ? calculateNextDate(lastCheckDate, periodValue, periodUnit)
    : null;

  // Load reminder templates
  useEffect(() => {
    const loadTemplates = async () => {
      const { data, error } = await supabase
        .from("deadline_reminder_templates")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setReminderTemplates(data);
      }
    };
    loadTemplates();
  }, []);

  // Load deadline data
  useEffect(() => {
    async function loadDeadline() {
      if (!id) return;

      const { data, error } = await supabase
        .from("deadlines")
        .select("*, deadline_types:deadline_type_id(period_days)")
        .eq("id", id)
        .single();

      if (error) {
        toast({
          title: "Chyba při načítání",
          description: error.message,
          variant: "destructive",
        });
        navigate("/deadlines");
        return;
      }

      // Convert period_days to value+unit
      const periodFromDb = data.deadline_types?.period_days || 365;
      const { value: pValue, unit: pUnit } = daysToPeriodicityUnit(periodFromDb);
      setPeriodValue(pValue);
      setPeriodUnit(pUnit);

      form.reset({
        deadline_type_id: data.deadline_type_id,
        equipment_id: data.equipment_id,
        facility: data.facility,
        last_check_date: parseISO(data.last_check_date),
        period_value: pValue,
        period_unit: pUnit,
        performer: data.performer || "",
        company: data.company || "",
        note: data.note || "",
        reminder_template_id: data.reminder_template_id || "",
        remind_days_before: data.remind_days_before || 30,
        repeat_days_after: data.repeat_days_after || 30,
      });
      setRequester(data.requester || "");
      setIsLoading(false);
    }

    loadDeadline();
  }, [id, form, navigate, toast]);

  // Load responsibles from fetched data
  useEffect(() => {
    if (existingResponsibles && existingResponsibles.length > 0) {
      setResponsibles({
        profileIds: existingResponsibles.filter(r => r.profile_id).map(r => r.profile_id!),
        groupIds: existingResponsibles.filter(r => r.group_id).map(r => r.group_id!),
      });
    }
  }, [existingResponsibles]);


  const onSubmit = async (data: FormValues) => {
    if (!id) return;

    // Validate responsibles selection
    if (responsibles.profileIds.length === 0 && responsibles.groupIds.length === 0) {
      setResponsiblesError("Vyberte alespoň jednu odpovědnou osobu nebo skupinu");
      return;
    }
    setResponsiblesError(null);
    
    setIsSubmitting(true);
    try {
      // Calculate next check date using periodicity
      const periodDays = periodicityToDays(periodValue, periodUnit);
      const next_check_date = calculateNextDate(data.last_check_date, periodValue, periodUnit);
      const today = new Date();
      const thirtyDaysFromNow = new Date(today);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      let status: "valid" | "warning" | "expired" = "valid";
      if (next_check_date < today) {
        status = "expired";
      } else if (next_check_date <= thirtyDaysFromNow) {
        status = "warning";
      }

      const { error } = await supabase
        .from("deadlines")
        .update({
          deadline_type_id: data.deadline_type_id,
          equipment_id: data.equipment_id,
          facility: data.facility,
          last_check_date: format(data.last_check_date, "yyyy-MM-dd"),
          next_check_date: format(next_check_date, "yyyy-MM-dd"),
          status,
          performer: data.performer || null,
          company: data.company || null,
          note: data.note || null,
          reminder_template_id: data.reminder_template_id,
          remind_days_before: data.remind_days_before,
          repeat_days_after: data.repeat_days_after || 30,
        })
        .eq("id", id);

      if (error) throw error;

      // Update responsibles (only if admin - non-admins can see but not change)
      if (isAdmin) {
        await saveResponsibles({
          deadlineId: id,
          profileIds: responsibles.profileIds,
          groupIds: responsibles.groupIds,
        });
      }

      // Upload new documents if any
      if (uploadedFiles.length > 0) {
        let uploadErrors: string[] = [];
        
        for (const uploadedFile of uploadedFiles) {
          const { error: uploadError } = await uploadDeadlineDocument(
            id,
            uploadedFile.file,
            uploadedFile.documentType,
            uploadedFile.description
          );
          
          if (uploadError) {
            uploadErrors.push(`${uploadedFile.file.name}: ${uploadError.message}`);
          }
        }
        
        if (uploadErrors.length > 0) {
          toast({
            title: "Některé soubory se nepodařilo nahrát",
            description: uploadErrors.join(", "),
            variant: "destructive",
          });
        }
      }

      toast({ title: "Technická událost byla aktualizována" });
      navigate("/deadlines");
    } catch (err) {
      toast({
        title: "Chyba při aktualizaci",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <TableSkeleton columns={2} rows={8} />;
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
      
      <div>
        <h1 className="text-2xl font-bold text-foreground">Upravit technickou událost</h1>
        <p className="text-muted-foreground">Upravte záznam o technické události</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="deadline_type_id"
                render={({ field }) => (
                  <FormItem>
                   <FormLabel>Typ události *</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                       <FormControl>
                         <SelectTrigger disabled={!canEdit}>
                           <SelectValue placeholder="Vyberte typ události" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deadlineTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
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
                        {facilities.map(f => (
                          <SelectItem key={f.id} value={f.code}>
                            {f.name}
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
                name="equipment_id"
                render={({ field }) => (
                  <FormItem>
                     <FormLabel>Zařízení *</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} disabled={!canEdit}>
                       <FormControl>
                         <SelectTrigger disabled={!canEdit}>
                           <SelectValue placeholder="Vyberte zařízení" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {equipment.map(eq => (
                          <SelectItem key={eq.id} value={eq.id}>
                            {eq.inventory_number} - {eq.name}
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
                name="last_check_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Datum poslední kontroly *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                           <Button
                             variant="outline"
                             className={cn(
                               "w-full pl-3 text-left font-normal",
                               !field.value && "text-muted-foreground"
                             )}
                             disabled={!canEdit}
                           >
                            {field.value ? (
                              format(field.value, "dd.MM.yyyy", { locale: cs })
                            ) : (
                              "Vyberte datum"
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                         <Calendar
                           mode="single"
                           selected={field.value}
                           onSelect={canEdit ? field.onChange : undefined}
                           locale={cs}
                           disabled={!canEdit}
                         />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Periodicity Input */}
              <div className="space-y-2">
                 <PeriodicityInput
                   value={periodValue}
                   unit={periodUnit}
                   onValueChange={canEdit ? (val) => {
                     setPeriodValue(val);
                     form.setValue("period_value", val);
                   } : undefined}
                   onUnitChange={canEdit ? (unit) => {
                     setPeriodUnit(unit);
                     form.setValue("period_unit", unit);
                   } : undefined}
                   label="Periodicita"
                   required
                   disabled={!canEdit}
                 />
              </div>

              {nextCheckDate && (
                <Alert className="bg-primary/10 border-primary/30">
                  <AlertDescription className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4" />
                    <span>Příští kontrola: <strong>{format(nextCheckDate, "dd.MM.yyyy", { locale: cs })}</strong></span>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="performer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provádějící</FormLabel>
                       <FormControl>
                         <Input {...field} placeholder="Jméno technika" disabled={!canEdit} />
                       </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Firma</FormLabel>
                       <FormControl>
                         <Input {...field} placeholder="Servisní firma" disabled={!canEdit} />
                       </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Existing Documents */}
              {id && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Nahrané dokumenty</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dokumenty již nahrané k této události. Můžete je stáhnout nebo zobrazit{canEdit ? ", případně smazat" : ""}.
                    </p>
                  </div>
                  <DeadlineDocumentsList
                    key={documentsKey}
                    deadlineId={id}
                    canDelete={canEdit}
                    onDocumentDeleted={() => setDocumentsKey(k => k + 1)}
                  />
                </div>
              )}

              {/* Responsibles Section - REQUIRED */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Odpovědné osoby / skupiny *
                  {!isAdmin && <span className="text-xs text-muted-foreground ml-2">(pouze admin může měnit)</span>}
                </Label>
                <ResponsiblesPicker
                  value={responsibles}
                  onChange={(val) => {
                    setResponsibles(val);
                    if (val.profileIds.length > 0 || val.groupIds.length > 0) {
                      setResponsiblesError(null);
                    }
                  }}
                  disabled={!isAdmin}
                />
                {responsiblesError && (
                  <p className="text-sm font-medium text-destructive">{responsiblesError}</p>
                )}
              </div>

              {/* New Document Upload - only for admin/manager */}
              {canEdit && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Přidat nové dokumenty</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Nahrajte protokoly, certifikáty nebo jiné dokumenty k této události
                    </p>
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
                 name="reminder_template_id"
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
                  name="remind_days_before"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Připomenout dopředu (dní) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="repeat_days_after"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opakovat po (dní)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                        />
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
                      <Textarea {...field} placeholder="Doplňující informace" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Zadavatel (requester) - read-only */}
              <div className="space-y-2">
                <Label>Zadavatel</Label>
                <Input 
                  value={requester || 'Neuvedeno'} 
                  disabled 
                  className="bg-muted" 
                />
              </div>

              <div className="flex gap-4">
                {canEdit && (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Uložit změny
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/deadlines")}
                  disabled={isSubmitting}
                >
                  {canEdit ? "Zrušit" : "Zpět"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
