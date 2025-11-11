import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

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
  const [useCustomTrainer, setUseCustomTrainer] = useState(false);
  const [useCustomCompany, setUseCustomCompany] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      periodDays: "365",
      remindDaysBefore: "30",
      repeatDaysAfter: "30",
    },
  });

  const onSubmit = (data: FormValues) => {
    console.log(data);
    toast({
      title: "Školení vytvořeno",
      description: "Nové školení bylo úspěšně přidáno do systému.",
    });
    form.reset();
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
                  <FormLabel>Poslední školení *</FormLabel>
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
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Periodicita *</FormLabel>
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

            <FormField
              control={form.control}
              name="protocol"
              render={({ field: { value, onChange, ...field } }) => (
                <FormItem>
                  <FormLabel>Protokol</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      {...field}
                      onChange={(e) => onChange(e.target.files?.[0])}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reminderTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Šablona připomenutí *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <div className="flex gap-4">
              <Button type="submit">Vytvořit školení</Button>
              <Button type="button" variant="outline" onClick={() => form.reset()}>
                Zrušit
              </Button>
            </div>
          </form>
        </Form>
      </Card>
    </div>
  );
}
