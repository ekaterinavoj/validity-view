import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { FileUploader, UploadedFile } from "@/components/FileUploader";
import { uploadDeadlineDocument } from "@/lib/deadlineDocuments";
import { 
  PeriodicityInput, 
  PeriodicityUnit, 
  daysToPeriodicityUnit, 
  periodicityToDays, 
  calculateNextDate, 
  formatPeriodicityDisplay 
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

export default function NewDeadline() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { equipment, isLoading: equipmentLoading } = useEquipment();
  const { deadlineTypes, isLoading: typesLoading } = useDeadlineTypes();
  const { facilities, loading: facilitiesLoading } = useFacilities();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);

  const activeEquipment = equipment.filter(e => e.status === "active");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      remind_days_before: 30,
      repeat_days_after: 30,
      period_value: 1,
      period_unit: "years",
    },
  });

  // Load reminder templates for deadlines
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

  const selectedTypeId = form.watch("deadline_type_id");
  const selectedType = deadlineTypes.find(t => t.id === selectedTypeId);
  const lastCheckDate = form.watch("last_check_date");
  const periodValue = form.watch("period_value");
  const periodUnit = form.watch("period_unit");

  // Auto-fill period and facility from type
  useEffect(() => {
    if (selectedType) {
      const { value, unit } = daysToPeriodicityUnit(selectedType.period_days);
      form.setValue("period_value", value);
      form.setValue("period_unit", unit);
      form.setValue("facility", selectedType.facility);
    }
  }, [selectedType, form]);

  const nextCheckDate = lastCheckDate && periodValue
    ? calculateNextDate(lastCheckDate, periodValue, periodUnit as PeriodicityUnit)
    : null;

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    try {
      const next_check_date = calculateNextDate(data.last_check_date, data.period_value, data.period_unit as PeriodicityUnit);
      const today = new Date();
      
      let status: "valid" | "warning" | "expired" = "valid";
      if (next_check_date < today) {
        status = "expired";
      } else if (next_check_date <= new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)) {
        status = "warning";
      }

      const { data: deadlineData, error } = await supabase.from("deadlines").insert({
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
        requester: profile ? `${profile.first_name} ${profile.last_name}` : null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      }).select().single();

      if (error) throw error;

      // Upload documents if any
      if (uploadedFiles.length > 0 && deadlineData) {
        let uploadErrors: string[] = [];
        
        for (const uploadedFile of uploadedFiles) {
          const { error: uploadError } = await uploadDeadlineDocument(
            deadlineData.id,
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

      toast({ title: "Technická událost byla vytvořena" });
      navigate("/deadlines");
    } catch (err) {
      toast({
        title: "Chyba při vytváření události",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = equipmentLoading || typesLoading || facilitiesLoading;

  // Prevent render issues by showing loading state until data is ready
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nová technická událost</h1>
          <p className="text-muted-foreground">Načítání dat...</p>
        </div>
        <Card>
          <CardContent className="pt-6 flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nová technická událost</h1>
        <p className="text-muted-foreground">Vytvořte nový záznam o technické události</p>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte typ události" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deadlineTypes.map(type => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name} ({type.period_days} dní)
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte zařízení" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeEquipment.map(eq => (
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
                          onSelect={field.onChange}
                          locale={cs}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <PeriodicityInput
                value={form.watch("period_value")}
                unit={form.watch("period_unit") as PeriodicityUnit}
                onValueChange={(val) => form.setValue("period_value", val)}
                onUnitChange={(unit) => form.setValue("period_unit", unit)}
                label="Periodicita"
                required
              />

              {nextCheckDate && (
                <Alert>
                  <AlertDescription>
                    Příští kontrola: <strong>{format(nextCheckDate, "dd.MM.yyyy")}</strong>
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
                        <Input {...field} placeholder="Jméno technika" />
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
                        <Input {...field} placeholder="Servisní firma" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* File Upload Section */}
              <div className="space-y-2">
                <Label>Dokumenty k události</Label>
                <FileUploader
                  files={uploadedFiles}
                  onFilesChange={setUploadedFiles}
                  maxFiles={10}
                  maxSize={20}
                  acceptedTypes={[".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]}
                />
              </div>

              <FormField
                control={form.control}
                name="reminder_template_id"
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

              {/* Zadavatel (requester) - auto-filled with logged-in user */}
              <div className="space-y-2">
                <Label>Zadavatel</Label>
                <Input 
                  value={profile ? `${profile.first_name} ${profile.last_name}` : 'Načítání...'} 
                  disabled 
                  className="bg-muted" 
                />
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Vytvořit událost
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/deadlines")}
                  disabled={isSubmitting}
                >
                  Zrušit
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
