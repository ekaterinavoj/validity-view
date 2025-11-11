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

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  employeeId: z.string().min(1, "Vyberte školenu osobu"),
  trainingTypeId: z.string().min(1, "Vyberte typ školení"),
  lastTrainingDate: z.date({ required_error: "Zadejte datum posledního školení" }),
  periodDays: z.string().min(1, "Zadejte periodicitu"),
  trainerId: z.string().optional(),
  customTrainerName: z.string().optional(),
  companyId: z.string().optional(),
  customCompanyName: z.string().optional(),
  protocol: z.any().optional(),
  reminderTemplateId: z.string().min(1, "Vyberte šablonu připomenutí"),
  remindDaysBefore: z.string().min(1, "Zadejte počet dní"),
  repeatDaysAfter: z.string().min(1, "Zadejte počet dní"),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewTraining() {
  const { profile } = useAuth();
  const [useCustomTrainer, setUseCustomTrainer] = useState(false);
  const [useCustomCompany, setUseCustomCompany] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [periodUnit, setPeriodUnit] = useState<"years" | "months" | "days">("years");
  const [reminderTemplates, setReminderTemplates] = useState<any[]>([]);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodDays: "365",
      remindDaysBefore: "30",
      repeatDaysAfter: "30",
    },
  });

  // Automatické nastavení zadavatele z přihlášeného uživatele
  useEffect(() => {
    if (profile) {
      // Zadavatel bude automaticky nastaven jako přihlášený uživatel
      console.log("Zadavatel automaticky nastaven:", `${profile.first_name} ${profile.last_name}`);
    }
  }, [profile]);

  // Načtení šablon připomínek
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

  // Automatický výpočet data expirace
  const lastTrainingDate = form.watch("lastTrainingDate");
  const periodDays = form.watch("periodDays");
  
  const expirationDate = useMemo(() => {
    if (!lastTrainingDate || !periodDays) return null;
    const days = parseInt(periodDays) || 0;
    if (days <= 0) return null;
    return addDays(lastTrainingDate, days);
  }, [lastTrainingDate, periodDays]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    
    try {
      // TODO: Zde by se mělo vytvořit školení v databázi a získat jeho ID
      // Pro teď použijeme mock ID
      const trainingId = `training-${Date.now()}`;
      
      console.log("Vytvářím školení:", data);
      
      // Nahrání všech souborů
      if (uploadedFiles.length > 0) {
        const uploadPromises = uploadedFiles.map((uploadedFile) =>
          uploadTrainingDocument(
            trainingId,
            uploadedFile.file,
            uploadedFile.documentType,
            uploadedFile.description
          )
        );
        
        const results = await Promise.all(uploadPromises);
        const errors = results.filter((r) => r.error);
        
        if (errors.length > 0) {
          toast({
            title: "Některé soubory se nepodařilo nahrát",
            description: `${errors.length} z ${uploadedFiles.length} souborů selhalo.`,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Školení vytvořeno",
            description: `Nové školení bylo úspěšně přidáno se ${uploadedFiles.length} dokumenty.`,
          });
        }
      } else {
        toast({
          title: "Školení vytvořeno",
          description: "Nové školení bylo úspěšně přidáno do systému.",
        });
      }
      
      form.reset();
      setUploadedFiles([]);
    } catch (error) {
      console.error("Chyba při vytváření školení:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se vytvořit školení.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-foreground">Vytvoření nového školení</h2>
      
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="facility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provozovna *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte provozovnu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="qlar-jenec-dc3">
                        Qlar Czech s.r.o. - Schenck Process s.r.o., závod Jeneč Hala DC3
                      </SelectItem>
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
                  <FormLabel>Školená osoba *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte školenu osobu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="employee1">Ongerová Petra (102756)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trainingTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ školení *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte typ školení" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="type1">HSE - REA/RR</SelectItem>
                      <SelectItem value="type2">ATEX</SelectItem>
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

            <FormField
              control={form.control}
              name="periodDays"
              render={({ field }) => {
                const totalDays = parseInt(field.value) || 0;
                const displayValue = periodUnit === "years" 
                  ? (totalDays / 365).toFixed(1)
                  : periodUnit === "months"
                  ? (totalDays / 30).toFixed(1)
                  : totalDays.toString();
                
                const handleValueChange = (value: string) => {
                  const numValue = parseFloat(value) || 0;
                  const daysValue = periodUnit === "years" 
                    ? Math.round(numValue * 365)
                    : periodUnit === "months"
                    ? Math.round(numValue * 30)
                    : Math.round(numValue);
                  field.onChange(daysValue.toString());
                };
                
                return (
                  <FormItem>
                    <FormLabel>Periodicita *</FormLabel>
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={periodUnit === "years"}
                            onChange={() => setPeriodUnit("years")}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="text-sm">Roky</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={periodUnit === "months"}
                            onChange={() => setPeriodUnit("months")}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="text-sm">Měsíce</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            checked={periodUnit === "days"}
                            onChange={() => setPeriodUnit("days")}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="text-sm">Dny</span>
                        </label>
                      </div>
                      
                      <div className="flex gap-2 items-center">
                        <FormControl>
                          <Input 
                            type="number"
                            step={periodUnit === "days" ? "1" : "0.1"}
                            value={displayValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            className="w-32"
                          />
                        </FormControl>
                        <span className="text-sm text-muted-foreground">
                          {periodUnit === "years" ? "roky" : periodUnit === "months" ? "měsíce" : "dní"}
                        </span>
                      </div>
                      
                      {totalDays > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {periodUnit === "years" 
                            ? `= ${totalDays} dní (${(totalDays / 30).toFixed(1)} měsíců)`
                            : periodUnit === "months"
                            ? `= ${totalDays} dní (${(totalDays / 365).toFixed(2)} roky)`
                            : `= ${(totalDays / 30).toFixed(1)} měsíců (${(totalDays / 365).toFixed(2)} roky)`
                          }
                        </p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Automaticky vypočítané datum expirace */}
            {expirationDate && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Vypočítané datum expirace
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Datum školení + periodicita
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      {format(expirationDate, "dd.MM.yyyy", { locale: cs })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(expirationDate, "EEEE", { locale: cs })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Školitel</Label>
              <div className="space-y-2">
                <Select 
                  onValueChange={(value) => {
                    setUseCustomTrainer(value === "custom");
                    form.setValue("trainerId", value !== "custom" ? value : undefined);
                  }}
                  disabled={useCustomTrainer}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte školitele" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trainer1">Hodková Blanka</SelectItem>
                    <SelectItem value="custom">(jiný)</SelectItem>
                  </SelectContent>
                </Select>
                
                {useCustomTrainer && (
                  <FormField
                    control={form.control}
                    name="customTrainerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Příjmení Jméno" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Školící firma</Label>
              <div className="space-y-2">
                <Select 
                  onValueChange={(value) => {
                    setUseCustomCompany(value === "custom");
                    form.setValue("companyId", value !== "custom" ? value : undefined);
                  }}
                  disabled={useCustomCompany}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte firmu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company1">Schenck Process</SelectItem>
                    <SelectItem value="custom">(jiná)</SelectItem>
                  </SelectContent>
                </Select>
                
                {useCustomCompany && (
                  <FormField
                    control={form.control}
                    name="customCompanyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder="Název firmy" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* Nahrávání dokumentů */}
            <div className="space-y-2">
              <Label>Dokumenty ke školení</Label>
              <p className="text-sm text-muted-foreground">
                Nahrajte certifikáty, prezenční listiny nebo jiné dokumenty související se školením
              </p>
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
              name="reminderTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Šablona připomenutí *</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Automaticky vyplnit hodnoty podle šablony
                      const template = reminderTemplates.find(t => t.id === value);
                      if (template) {
                        form.setValue("remindDaysBefore", template.remind_days_before.toString());
                        if (template.repeat_interval_days) {
                          form.setValue("repeatDaysAfter", template.repeat_interval_days.toString());
                        }
                      }
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Vyberte šablonu" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {reminderTemplates.length === 0 ? (
                        <SelectItem value="none" disabled>
                          Žádné šablony k dispozici
                        </SelectItem>
                      ) : (
                        reminderTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.remind_days_before} dní)
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
              name="remindDaysBefore"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Připomenout dopředu *</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormControl>
                      <Input type="number" {...field} className="w-32" />
                    </FormControl>
                    <span className="text-sm text-muted-foreground">Dní</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="repeatDaysAfter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opakovat (každých)</FormLabel>
                  <div className="flex gap-2 items-center">
                    <FormControl>
                      <Input type="number" {...field} className="w-32" />
                    </FormControl>
                    <span className="text-sm text-muted-foreground">Dní po vypršení lhůty</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Poznámka</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Zadavatel - automaticky vyplněno */}
            <div className="space-y-2">
              <Label>Zadavatel</Label>
              <Input 
                value={profile ? `${profile.first_name} ${profile.last_name}${profile.position ? ` (${profile.position})` : ''}` : 'Načítání...'}
                disabled
                className="bg-muted"
              />
              <p className="text-sm text-muted-foreground">
                Zadavatel je automaticky nastaven podle přihlášeného uživatele
              </p>
            </div>

            {expirationDate && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium">
                  Platnost školení do:{" "}
                  <span className="font-bold">
                    {format(expirationDate, "d. MMMM yyyy", { locale: cs })}
                  </span>
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isSubmitting ? "Vytváří se..." : "Vytvořit školení"}
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  form.reset();
                  setUploadedFiles([]);
                }}
                disabled={isSubmitting}
              >
                Zrušit
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
