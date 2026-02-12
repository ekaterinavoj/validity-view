import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Eye, 
  Mail, 
  User, 
  GraduationCap, 
  Calendar,
  AlertCircle,
  RefreshCw,
  CalendarOff,
  Check,
  ChevronLeft,
  ChevronRight,
  Users,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface TrainingItem {
  id: string;
  employeeName: string;
  employeeEmail: string;
  trainingType: string;
  expiresOn: string;
  daysUntil: number;
}

interface Recipient {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

interface ReminderSchedule {
  day_of_week: number;
  skip_weekends: boolean;
}

interface ReminderFrequency {
  type: string;
  interval_days: number;
  start_time: string;
  timezone: string;
  enabled: boolean;
}

interface ReminderRecipients {
  user_ids: string[];
  delivery_mode: string;
}

const ITEMS_PER_PAGE = 10;

const DELIVERY_MODE_LABELS: Record<string, string> = {
  bcc: "BCC (skrytá kopie)",
  to: "To (příjemci viditelní)",
  cc: "CC (kopie)",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Denně",
  weekly: "Týdně",
  biweekly: "Každé 2 týdny",
  monthly: "Měsíčně",
  custom: "Vlastní interval",
};

export function ReminderDryRunPreview() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [trainings, setTrainings] = useState<TrainingItem[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [reminderSchedule, setReminderSchedule] = useState<ReminderSchedule>({ day_of_week: 1, skip_weekends: true });
  const [reminderFrequency, setReminderFrequency] = useState<ReminderFrequency>({ type: "weekly", interval_days: 7, start_time: "08:00", timezone: "Europe/Prague", enabled: true });
  const [reminderRecipients, setReminderRecipients] = useState<ReminderRecipients>({ user_ids: [], delivery_mode: "bcc" });
  const [emailTemplate, setEmailTemplate] = useState({ subject: "", body: "" });
  const [currentPage, setCurrentPage] = useState(1);

  const loadPreview = async () => {
    setLoading(true);
    setCurrentPage(1);
    try {
      // Load all settings
      const { data: settingsData } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["reminder_days", "reminder_schedule", "reminder_frequency", "reminder_recipients", "email_template"]);

      const settingsMap: Record<string, any> = {};
      settingsData?.forEach(s => {
        settingsMap[s.key] = s.value;
      });

      const schedule: ReminderSchedule = settingsMap.reminder_schedule || { day_of_week: 1, skip_weekends: true };
      const frequency: ReminderFrequency = settingsMap.reminder_frequency || { type: "weekly", interval_days: 7, start_time: "08:00", timezone: "Europe/Prague", enabled: true };
      const recipientSettings: ReminderRecipients = settingsMap.reminder_recipients || { user_ids: [], delivery_mode: "bcc" };
      const template = settingsMap.email_template || { subject: "Souhrn školení k obnovení - {reportDate}", body: "" };
      const reminderDays = settingsMap.reminder_days || { days_before: [30, 14, 7] };

      setReminderSchedule(schedule);
      setReminderFrequency(frequency);
      setReminderRecipients(recipientSettings);
      setEmailTemplate(template);

      // Check if frequency is enabled (can be paused without changing cron)
      if (frequency.enabled === false) {
        setTrainings([]);
        setRecipients([]);
        toast({
          title: "Odesílání je pozastaveno",
          description: "Odesílání připomínek je dočasně pozastaveno v nastavení frekvence.",
        });
        setLoading(false);
        return;
      }

      // Check if today is weekend and skip_weekends is enabled
      const today = new Date().getDay();
      const isWeekend = today === 0 || today === 6;

      if (schedule.skip_weekends && isWeekend) {
        setTrainings([]);
        setRecipients([]);
        toast({
          title: "Víkend - odesílání přeskočeno",
          description: "Nastavení 'Přeskočit víkendy' je aktivní.",
        });
        setLoading(false);
        return;
      }

      // Load recipients
      if (recipientSettings.user_ids && recipientSettings.user_ids.length > 0) {
        const { data: recipientProfiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", recipientSettings.user_ids);

        setRecipients(recipientProfiles || []);
      } else {
        setRecipients([]);
      }

      // Load trainings that would be included
      const daysBeforeList: number[] = reminderDays.days_before || [30, 14, 7];
      const maxDays = Math.max(...daysBeforeList);
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + maxDays);
      const targetDateStr = targetDate.toISOString().split("T")[0];

      const { data: trainingsRaw, error } = await supabase
        .from("trainings")
        .select(`
          id,
          next_training_date,
          employee_id,
          employees (id, first_name, last_name, email, status),
          training_types (name)
        `)
        .eq("is_active", true)
        .is("deleted_at", null)
        .lte("next_training_date", targetDateStr);

      if (error) {
        console.error("Error fetching trainings:", error);
        toast({
          title: "Chyba při načítání",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const items: TrainingItem[] = [];

      for (const training of trainingsRaw || []) {
        if (!training.employees || !training.training_types) continue;

        const employee = training.employees as unknown as { id: string; first_name: string; last_name: string; email: string; status: string };
        const trainingType = training.training_types as unknown as { name: string };

        // Only include active employees
        if (employee.status !== "employed") continue;

        const expiresDate = new Date(training.next_training_date);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        expiresDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Include if expired or within any threshold
        const shouldInclude = daysUntil < 0 || daysBeforeList.some(d => daysUntil <= d);
        if (!shouldInclude) continue;

        items.push({
          id: training.id,
          employeeName: `${employee.first_name} ${employee.last_name}`,
          employeeEmail: employee.email,
          trainingType: trainingType.name,
          expiresOn: training.next_training_date,
          daysUntil,
        });
      }

      // Sort by soonest expiration first, then by employee name
      items.sort((a, b) => {
        if (a.daysUntil !== b.daysUntil) {
          return a.daysUntil - b.daysUntil;
        }
        return a.employeeName.localeCompare(b.employeeName, "cs");
      });

      setTrainings(items);

    } catch (error: any) {
      toast({
        title: "Chyba při načítání náhledu",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen]);

  const expiredCount = useMemo(() => trainings.filter(t => t.daysUntil < 0).length, [trainings]);
  const expiringCount = useMemo(() => trainings.filter(t => t.daysUntil >= 0).length, [trainings]);

  // Pagination
  const totalPages = Math.ceil(trainings.length / ITEMS_PER_PAGE);
  const paginatedTrainings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return trainings.slice(start, start + ITEMS_PER_PAGE);
  }, [trainings, currentPage]);

  // Generate email preview
  const emailPreview = useMemo(() => {
    const today = format(new Date(), "d. M. yyyy", { locale: cs });
    let subject = emailTemplate.subject
      .replace(/{totalCount}/g, String(trainings.length))
      .replace(/{expiringCount}/g, String(expiringCount))
      .replace(/{expiredCount}/g, String(expiredCount))
      .replace(/{reportDate}/g, today);

    let body = emailTemplate.body
      .replace(/{totalCount}/g, String(trainings.length))
      .replace(/{expiringCount}/g, String(expiringCount))
      .replace(/{expiredCount}/g, String(expiredCount))
      .replace(/{reportDate}/g, today);

    return { subject, body };
  }, [emailTemplate, trainings.length, expiringCount, expiredCount]);

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-sm text-muted-foreground">
          Celkem {trainings.length} záznamů
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => p - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => p + 1)}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Eye className="w-4 h-4 mr-2" />
          Náhled připomínek
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Náhled souhrnného emailu
          </DialogTitle>
          <DialogDescription>
            Přehled školení a příjemců, kteří by obdrželi souhrnný email při spuštění
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <>
              {/* Settings Status */}
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
                <Badge 
                  variant={reminderFrequency.enabled ? "default" : "destructive"}
                  className="flex items-center gap-1"
                >
                  {reminderFrequency.enabled ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <AlertCircle className="w-3 h-3" />
                  )}
                  Odesílání: {reminderFrequency.enabled ? "aktivní" : "pozastaveno"}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {FREQUENCY_LABELS[reminderFrequency.type] || reminderFrequency.type}
                  {reminderFrequency.type === "custom" && ` (${reminderFrequency.interval_days} dní)`}
                </Badge>
                <Badge 
                  variant={reminderSchedule.skip_weekends ? "outline" : "secondary"}
                  className="flex items-center gap-1"
                >
                  <CalendarOff className="w-3 h-3" />
                  Víkendy: {reminderSchedule.skip_weekends ? "přeskakovat" : "odesílat"}
                </Badge>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">{trainings.length}</p>
                        <p className="text-sm text-muted-foreground">Školení celkem</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-destructive" />
                      <div>
                        <p className="text-2xl font-bold">{expiredCount}</p>
                        <p className="text-sm text-muted-foreground">Prošlé</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">{recipients.length}</p>
                        <p className="text-sm text-muted-foreground">Příjemců</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recipients */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Příjemci emailu
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recipients.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {recipients.map((recipient) => (
                          <Badge key={recipient.id} variant="secondary">
                            {recipient.first_name} {recipient.last_name} ({recipient.email})
                          </Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Způsob doručení: {DELIVERY_MODE_LABELS[reminderRecipients.delivery_mode] || reminderRecipients.delivery_mode}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-destructive mt-0.5" />
                        <div>
                          <p className="font-medium text-destructive text-sm">Nejsou vybráni příjemci</p>
                          <p className="text-muted-foreground text-xs">
                            Email nebude odeslán. Nastavte příjemce v Administraci → Připomínky.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Náhled emailu
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Předmět:</p>
                    <p className="font-medium">{emailPreview.subject}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Tělo emailu:</p>
                    <div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                      {emailPreview.body || "(prázdné)"}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trainings List */}
              {trainings.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Školení v souhrnném emailu</CardTitle>
                    <Button variant="outline" size="icon" onClick={loadPreview}>
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zaměstnanec</TableHead>
                          <TableHead>Školení</TableHead>
                          <TableHead>Vyprší</TableHead>
                          <TableHead>Stav</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTrainings.map((training, idx) => (
                          <TableRow key={`${training.id}-${idx}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{training.employeeName}</p>
                                  <p className="text-xs text-muted-foreground">{training.employeeEmail}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                                <span>{training.trainingType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>{format(new Date(training.expiresOn), "d. M. yyyy", { locale: cs })}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={training.daysUntil < 0 ? "destructive" : training.daysUntil <= 7 ? "secondary" : "outline"}
                              >
                                {training.daysUntil < 0 
                                  ? `Prošlé (${Math.abs(training.daysUntil)} dní)` 
                                  : `${training.daysUntil} dní`}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <PaginationControls />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Žádná školení k odeslání</p>
                    <p className="text-sm">Všechna aktivní školení jsou v pořádku</p>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
