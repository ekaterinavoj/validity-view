import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays, parseISO } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
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
import { 
  uploadDeadlineDocument, 
  getDeadlineDocuments, 
  deleteDeadlineDocument,
  getDeadlineDocumentDownloadUrl,
  formatFileSize,
  DeadlineDocument,
  DEADLINE_DOCUMENT_TYPE_LABELS
} from "@/lib/deadlineDocuments";
import { ResponsiblesPicker, ResponsiblesSelection } from "@/components/ResponsiblesPicker";
import { useDeadlineResponsibles } from "@/hooks/useDeadlineResponsibles";

const formSchema = z.object({
  deadline_type_id: z.string().min(1, "Vyberte typ události"),
  equipment_id: z.string().min(1, "Vyberte zařízení"),
  facility: z.string().min(1, "Vyberte provozovnu"),
  last_check_date: z.date({ required_error: "Vyberte datum poslední kontroly" }),
  period_days: z.number().min(1, "Zadejte periodu"),
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
  const { profile } = useAuth();
  const { equipment } = useEquipment();
  const { deadlineTypes } = useDeadlineTypes();
  const { facilities } = useFacilities();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);
  const [requester, setRequester] = useState<string>("");
  
  // Document management state
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<DeadlineDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  
  // Responsibles state
  const [responsibles, setResponsibles] = useState<ResponsiblesSelection>({ profileIds: [], groupIds: [] });
  const [responsiblesError, setResponsiblesError] = useState<string | null>(null);
  const { responsibles: existingResponsibles, setResponsibles: saveResponsibles, isLoading: responsiblesLoading } = useDeadlineResponsibles(id);
  const [isAdmin, setIsAdmin] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      remind_days_before: 30,
      repeat_days_after: 30,
    },
  });

  const lastCheckDate = form.watch("last_check_date");
  const periodDays = form.watch("period_days");

  const nextCheckDate = lastCheckDate && periodDays
    ? addDays(lastCheckDate, periodDays)
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

      form.reset({
        deadline_type_id: data.deadline_type_id,
        equipment_id: data.equipment_id,
        facility: data.facility,
        last_check_date: parseISO(data.last_check_date),
        period_days: data.deadline_types?.period_days || 365,
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

  // Load existing documents
  useEffect(() => {
    async function loadDocuments() {
      if (!id) return;
      
      setDocumentsLoading(true);
      const { data, error } = await getDeadlineDocuments(id);
      
      if (!error && data) {
        setExistingDocuments(data);
      }
      setDocumentsLoading(false);
    }

    loadDocuments();
  }, [id]);

  // Load responsibles from fetched data
  useEffect(() => {
    if (existingResponsibles && existingResponsibles.length > 0) {
      setResponsibles({
        profileIds: existingResponsibles.filter(r => r.profile_id).map(r => r.profile_id!),
        groupIds: existingResponsibles.filter(r => r.group_id).map(r => r.group_id!),
      });
    }
  }, [existingResponsibles]);

  // Check if current user is admin
  useEffect(() => {
    async function checkAdmin() {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.user.id)
          .eq("role", "admin")
          .limit(1);
        setIsAdmin(!!(roles && roles.length > 0));
      }
    }
    checkAdmin();
  }, []);
  const handleDeleteDocument = async (doc: DeadlineDocument) => {
    setDeletingDocId(doc.id);
    
    const { error } = await deleteDeadlineDocument(doc.id, doc.file_path);
    
    if (error) {
      toast({
        title: "Chyba při mazání dokumentu",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setExistingDocuments(prev => prev.filter(d => d.id !== doc.id));
      toast({ title: "Dokument byl smazán" });
    }
    
    setDeletingDocId(null);
  };

  const handleDownloadDocument = async (doc: DeadlineDocument) => {
    const { url, error } = await getDeadlineDocumentDownloadUrl(doc.file_path);
    
    if (error || !url) {
      toast({
        title: "Chyba při stahování",
        description: error?.message || "Nepodařilo se získat odkaz ke stažení",
        variant: "destructive",
      });
      return;
    }
    
    window.open(url, "_blank");
  };

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
      const next_check_date = addDays(data.last_check_date, data.period_days);
      const today = new Date();
      
      let status: "valid" | "warning" | "expired" = "valid";
      if (next_check_date < today) {
        status = "expired";
      } else if (next_check_date <= addDays(today, 30)) {
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
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

              <FormField
                control={form.control}
                name="period_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perioda (dní) *</FormLabel>
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

              {/* Existing Documents */}
              {existingDocuments.length > 0 && (
                <div className="space-y-2">
                  <Label>Existující dokumenty</Label>
                  <div className="border rounded-lg divide-y">
                    {existingDocuments.map(doc => (
                      <div key={doc.id} className="p-3 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleDownloadDocument(doc)}
                            className="text-sm font-medium text-primary hover:underline truncate block"
                          >
                            {doc.file_name}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {DEADLINE_DOCUMENT_TYPE_LABELS[doc.document_type as keyof typeof DEADLINE_DOCUMENT_TYPE_LABELS] || doc.document_type} • {formatFileSize(doc.file_size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDocument(doc)}
                          disabled={deletingDocId === doc.id}
                        >
                          {deletingDocId === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
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

              {/* New Document Upload */}
              <div className="space-y-2">
                <Label>Přidat nové dokumenty</Label>
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
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Uložit změny
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
