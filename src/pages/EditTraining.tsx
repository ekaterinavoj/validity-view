import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, ArrowLeft } from "lucide-react";
import { format, addDays } from "date-fns";
import { cs } from "date-fns/locale";
import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useParams } from "react-router-dom";
import { FileUploader, UploadedFile } from "@/components/FileUploader";
import { uploadTrainingDocument } from "@/lib/trainingDocuments";
import { TrainingDocumentsList } from "@/components/TrainingDocumentsList";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  facility: z.string().min(1, "Vyberte provozovnu"),
  employeeId: z.string().min(1, "Vyberte školenu osobu"),
  trainingTypeId: z.string().min(1, "Vyberte typ školení"),
  lastTrainingDate: z.date({ required_error: "Zadejte datum školení" }),
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

// Mock data pro načtení existujícího školení
const mockTrainingData = {
  id: "1",
  facility: "qlar-jenec-dc3",
  employeeId: "employee1",
  trainingTypeId: "type1",
  lastTrainingDate: new Date("2024-12-15"),
  periodDays: "365",
  trainerId: "trainer1",
  companyId: "company1",
  reminderTemplateId: "template1",
  remindDaysBefore: "30",
  repeatDaysAfter: "30",
  note: "Pravidelné školení",
};

export default function EditTraining() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [useCustomTrainer, setUseCustomTrainer] = useState(false);
  const [useCustomCompany, setUseCustomCompany] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [periodUnit, setPeriodUnit] = useState<"years" | "days">("years");
  const [loading, setLoading] = useState(true);
  const [replaceMode, setReplaceMode] = useState(true);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodDays: "365",
      remindDaysBefore: "30",
      repeatDaysAfter: "30",
    },
  });

  // Načtení dat školení
  useEffect(() => {
    const loadTraining = async () => {
      setLoading(true);
      try {
        // TODO: Načíst data z databáze podle ID
        // Pro teď použijeme mock data
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        form.reset({
          facility: mockTrainingData.facility,
          employeeId: mockTrainingData.employeeId,
          trainingTypeId: mockTrainingData.trainingTypeId,
          lastTrainingDate: mockTrainingData.lastTrainingDate,
          periodDays: mockTrainingData.periodDays,
          trainerId: mockTrainingData.trainerId,
          companyId: mockTrainingData.companyId,
          reminderTemplateId: mockTrainingData.reminderTemplateId,
          remindDaysBefore: mockTrainingData.remindDaysBefore,
          repeatDaysAfter: mockTrainingData.repeatDaysAfter,
          note: mockTrainingData.note,
        });
      } catch (error) {
        toast({
          title: "Chyba při načítání",
          description: "Nepodařilo se načíst data školení.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTraining();
  }, [id, form, toast]);

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
      // TODO: Aktualizovat školení v databázi
      console.log("Aktualizuji školení:", data);
      
      // Pokud je režim nahrazení a jsou nové soubory, nejprve smazat staré
      if (replaceMode && uploadedFiles.length > 0) {
        // TODO: Smazat všechny staré dokumenty z databáze
        console.log("Mažu staré dokumenty pro nahrazení novými");
      }
      
      // Nahrání nových souborů
      if (uploadedFiles.length > 0) {
        const uploadPromises = uploadedFiles.map((uploadedFile) =>
          uploadTrainingDocument(
            id || "",
            uploadedFile.file,
            uploadedFile.documentType,
            uploadedFile.description
          )
        );
        
        await Promise.all(uploadPromises);
      }
      
      toast({
        title: "Školení aktualizováno",
        description: replaceMode && uploadedFiles.length > 0
          ? "Změny byly uloženy a dokumenty nahrazeny."
          : "Změny byly úspěšně uloženy.",
      });
      
      navigate("/");
    } catch (error) {
      console.error("Chyba při aktualizaci školení:", error);
      toast({
        title: "Chyba",
        description: "Nepodařilo se aktualizovat školení.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-foreground">Úprava školení</h2>
          <p className="text-muted-foreground mt-1">ID: {id}</p>
        </div>
      </div>
      
      <Card className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  <Select onValueChange={field.onChange} value={field.value}>
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
                  : totalDays.toString();
                
                const handleValueChange = (value: string) => {
                  const numValue = parseFloat(value) || 0;
                  const daysValue = periodUnit === "years" 
                    ? Math.round(numValue * 365)
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
                            step={periodUnit === "years" ? "0.1" : "1"}
                            value={displayValue}
                            onChange={(e) => handleValueChange(e.target.value)}
                            className="w-32"
                          />
                        </FormControl>
                        <span className="text-sm text-muted-foreground">
                          {periodUnit === "years" ? "roky" : "dní"}
                        </span>
                      </div>
                      
                      {totalDays > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {periodUnit === "years" 
                            ? `= ${totalDays} dní`
                            : `= ${(totalDays / 365).toFixed(2)} ${(totalDays / 365) === 1 ? "rok" : (totalDays / 365) < 5 ? "roky" : "let"}`
                          }
                        </p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Automaticky vypočítané datum platnosti */}
            {expirationDate && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Školení platné do
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automaticky přepočítáno: Datum školení + periodicita
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
                  value={form.watch("trainerId") || ""}
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
                  value={form.watch("companyId") || ""}
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

            {/* Stávající dokumenty */}
            <div className="space-y-4">
              <Separator />
              <div>
                <Label className="text-base font-semibold">Nahrané dokumenty</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Dokumenty již nahrané ke školení. Můžete je stáhnout nebo smazat.
                </p>
              </div>
              <TrainingDocumentsList trainingId={id || ""} canDelete={true} />
            </div>

            {/* Nahrávání nových dokumentů */}
            <div className="space-y-2">
              <Separator />
              <Label>Přidat nové dokumenty</Label>
              <p className="text-sm text-muted-foreground">
                Nahrajte další certifikáty, prezenční listiny nebo jiné dokumenty
              </p>
              <FileUploader
                files={uploadedFiles}
                onFilesChange={setUploadedFiles}
                maxFiles={10}
                maxSize={20}
                acceptedTypes={[".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"]}
                showReplaceOption={true}
                replaceMode={replaceMode}
                onReplaceModeChange={setReplaceMode}
              />
            </div>

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
                      <SelectItem value="template1">Schenck Process</SelectItem>
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

            <div className="flex gap-4 pt-4 border-t">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Uložit změny
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate("/scheduled-trainings")}
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
