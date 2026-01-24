import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addDays } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

const formSchema = z.object({
  deadline_type_id: z.string().min(1, "Vyberte typ lhůty"),
  equipment_id: z.string().min(1, "Vyberte zařízení"),
  facility: z.string().min(1, "Vyberte provozovnu"),
  last_check_date: z.date({ required_error: "Vyberte datum poslední kontroly" }),
  period_days: z.number().min(1, "Zadejte periodu"),
  performer: z.string().optional(),
  company: z.string().optional(),
  note: z.string().optional(),
  remind_days_before: z.number().optional(),
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

  const activeEquipment = equipment.filter(e => e.status === "active");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      remind_days_before: 30,
      repeat_days_after: 30,
    },
  });

  const selectedTypeId = form.watch("deadline_type_id");
  const selectedType = deadlineTypes.find(t => t.id === selectedTypeId);
  const lastCheckDate = form.watch("last_check_date");
  const periodDays = form.watch("period_days");

  // Auto-fill period and facility from type
  useEffect(() => {
    if (selectedType) {
      form.setValue("period_days", selectedType.period_days);
      form.setValue("facility", selectedType.facility);
    }
  }, [selectedType, form]);

  const nextCheckDate = lastCheckDate && periodDays
    ? addDays(lastCheckDate, periodDays)
    : null;

  const onSubmit = async (data: FormValues) => {
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

      const { error } = await supabase.from("deadlines").insert({
        deadline_type_id: data.deadline_type_id,
        equipment_id: data.equipment_id,
        facility: data.facility,
        last_check_date: format(data.last_check_date, "yyyy-MM-dd"),
        next_check_date: format(next_check_date, "yyyy-MM-dd"),
        status,
        performer: data.performer || null,
        company: data.company || null,
        note: data.note || null,
        remind_days_before: data.remind_days_before || 30,
        repeat_days_after: data.repeat_days_after || 30,
        requester: profile ? `${profile.first_name} ${profile.last_name}` : null,
        created_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) throw error;

      toast({ title: "Technická lhůta byla vytvořena" });
      navigate("/deadlines");
    } catch (err) {
      toast({
        title: "Chyba při vytváření lhůty",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = equipmentLoading || typesLoading || facilitiesLoading;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nová technická lhůta</h1>
        <p className="text-muted-foreground">Vytvořte nový záznam o technické lhůtě</p>
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
                    <FormLabel>Typ lhůty *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vyberte typ lhůty" />
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

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/deadlines")}
                >
                  Zrušit
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoading}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Vytvořit lhůtu
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
