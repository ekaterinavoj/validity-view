import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Loader2,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface PendingReminder {
  trainingId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  trainingType: string;
  expiresOn: string;
  daysUntil: number;
  daysBefore: number;
  alreadySentThisWeek: boolean;
}

export function ReminderDryRunPreview() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pendingReminders, setPendingReminders] = useState<PendingReminder[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const loadPreview = async () => {
    setLoading(true);
    try {
      // Load settings for days_before and reminder_schedule (matches real sender)
      const { data: settingsData } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["reminder_days", "reminder_schedule"]);

      const reminderDaysSetting = settingsData?.find(s => s.key === "reminder_days");
      const reminderScheduleSetting = settingsData?.find(s => s.key === "reminder_schedule");
      
      // Match real sender: settingsMap.reminder_schedule || { enabled: true, skip_weekends: true }
      const reminderSchedule = (reminderScheduleSetting?.value as { enabled?: boolean; skip_weekends?: boolean }) || 
        { enabled: true, skip_weekends: true };
      
      // Match real sender: settingsMap.reminder_days || { days_before: [30, 14, 7] }
      const reminderDays = (reminderDaysSetting?.value as { days_before?: number[] }) || 
        { days_before: [30, 14, 7] };
      const daysBeforeList: number[] = reminderDays.days_before || [30, 14, 7];
      
      // Check if reminders are enabled (matches real sender)
      if (!reminderSchedule.enabled) {
        setPendingReminders([]);
        setLoading(false);
        toast({
          title: "Připomínky jsou vypnuté",
          description: "V nastavení jsou připomínky deaktivovány.",
        });
        return;
      }

      // Check if today is weekend and skip_weekends is enabled (matches real sender exactly)
      const today = new Date().getDay();
      const isWeekend = today === 0 || today === 6;

      if (reminderSchedule.skip_weekends && isWeekend) {
        setPendingReminders([]);
        setLoading(false);
        toast({
          title: "Víkend - odesílání přeskočeno",
          description: "Nastavení 'Přeskočit víkendy' je aktivní. Připomínky se o víkendech neodesílají.",
        });
        return;
      }

      // Get current week start (Monday) - matches real sender
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now);
      monday.setDate(diff);
      monday.setHours(0, 0, 0, 0);
      const weekStart = monday.toISOString().split("T")[0];

      const reminders: PendingReminder[] = [];

      for (const daysBefore of daysBeforeList) {
        // Calculate target date
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysBefore);
        const targetDateStr = targetDate.toISOString().split("T")[0];

        // Get trainings expiring on target date (matches real sender: only is_active=true filter)
        const { data: trainings, error } = await supabase
          .from("trainings")
          .select(`
            id,
            next_training_date,
            employee_id,
            employees (id, first_name, last_name, email),
            training_types (name)
          `)
          .eq("next_training_date", targetDateStr)
          .eq("is_active", true);

        if (error) {
          console.error("Error fetching trainings:", error);
          continue;
        }
        
        // Real sender does NOT filter by employees.status - it sends to all employees
        // with is_active=true trainings. Matching that behavior here.

        for (const training of trainings || []) {
          if (!training.employees || !training.training_types) continue;

          // Check if already sent this week
          const { data: existingLog } = await supabase
            .from("reminder_logs")
            .select("id")
            .eq("training_id", training.id)
            .eq("employee_id", training.employee_id)
            .eq("days_before", daysBefore)
            .eq("week_start", weekStart)
            .eq("is_test", false)
            .maybeSingle();

          const employee = training.employees as unknown as { id: string; first_name: string; last_name: string; email: string };
          const trainingType = training.training_types as unknown as { name: string };

          reminders.push({
            trainingId: training.id,
            employeeId: employee.id,
            employeeName: `${employee.first_name} ${employee.last_name}`,
            employeeEmail: employee.email,
            trainingType: trainingType.name,
            expiresOn: training.next_training_date,
            daysUntil: daysBefore,
            daysBefore,
            alreadySentThisWeek: !!existingLog,
          });
        }
      }

      // Sort by days until expiration
      reminders.sort((a, b) => a.daysUntil - b.daysUntil);
      setPendingReminders(reminders);

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

  const pendingToSend = pendingReminders.filter(r => !r.alreadySentThisWeek);
  const alreadySent = pendingReminders.filter(r => r.alreadySentThisWeek);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Eye className="w-4 h-4 mr-2" />
          Náhled připomínek
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Náhled připomínek k odeslání
          </DialogTitle>
          <DialogDescription>
            Přehled školení, která by obdržela připomínku při spuštění
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
              {/* Summary */}
              <div className="flex gap-4">
                <Card className="flex-1">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-2xl font-bold">{pendingToSend.length}</p>
                        <p className="text-sm text-muted-foreground">K odeslání</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="flex-1">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="text-2xl font-bold">{alreadySent.length}</p>
                        <p className="text-sm text-muted-foreground">Již odesláno tento týden</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Button variant="outline" size="icon" onClick={loadPreview}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {/* Pending reminders */}
              {pendingToSend.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Připomínky k odeslání</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zaměstnanec</TableHead>
                          <TableHead>Školení</TableHead>
                          <TableHead>Vyprší</TableHead>
                          <TableHead>Dnů předem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingToSend.map((reminder, idx) => (
                          <TableRow key={`${reminder.trainingId}-${reminder.daysBefore}-${idx}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{reminder.employeeName}</p>
                                  <p className="text-xs text-muted-foreground">{reminder.employeeEmail}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                                <span>{reminder.trainingType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>{format(new Date(reminder.expiresOn), "d. M. yyyy", { locale: cs })}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={reminder.daysUntil <= 7 ? "destructive" : reminder.daysUntil <= 14 ? "secondary" : "outline"}>
                                {reminder.daysBefore} dní
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Žádné připomínky k odeslání</p>
                    <p className="text-sm">Všechny připomínky pro tento týden již byly odeslány</p>
                  </CardContent>
                </Card>
              )}

              {/* Already sent this week */}
              {alreadySent.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-muted-foreground">Již odesláno tento týden</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zaměstnanec</TableHead>
                          <TableHead>Školení</TableHead>
                          <TableHead>Vyprší</TableHead>
                          <TableHead>Dnů předem</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alreadySent.map((reminder, idx) => (
                          <TableRow key={`${reminder.trainingId}-${reminder.daysBefore}-${idx}`} className="opacity-50">
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{reminder.employeeName}</p>
                                  <p className="text-xs text-muted-foreground">{reminder.employeeEmail}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <GraduationCap className="w-4 h-4 text-muted-foreground" />
                                <span>{reminder.trainingType}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span>{format(new Date(reminder.expiresOn), "d. M. yyyy", { locale: cs })}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{reminder.daysBefore} dní</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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