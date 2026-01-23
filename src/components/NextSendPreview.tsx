import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Clock, AlertCircle, CheckCircle2, Pause } from "lucide-react";
import { format, addDays, setHours, setMinutes, nextMonday, nextDay, isWeekend } from "date-fns";
import { cs } from "date-fns/locale";

interface ReminderSchedule {
  enabled: boolean;
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

interface NextSendPreviewProps {
  schedule: ReminderSchedule;
  frequency: ReminderFrequency;
  hasRecipients: boolean;
}

const DAY_NAMES: Record<number, string> = {
  0: "Neděle",
  1: "Pondělí",
  2: "Úterý",
  3: "Středa",
  4: "Čtvrtek",
  5: "Pátek",
  6: "Sobota",
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Denně",
  weekly: "Týdně",
  biweekly: "Každé 2 týdny",
  monthly: "Měsíčně",
  custom: "Vlastní interval",
};

export function NextSendPreview({ schedule, frequency, hasRecipients }: NextSendPreviewProps) {
  const nextSendInfo = useMemo(() => {
    // Check if enabled
    if (!frequency.enabled) {
      return { 
        status: "paused", 
        message: "Odesílání je pozastaveno",
        date: null 
      };
    }

    if (!hasRecipients) {
      return { 
        status: "no_recipients", 
        message: "Nejsou vybráni příjemci",
        date: null 
      };
    }

    const now = new Date();
    const [targetHour, targetMinute] = (frequency.start_time || "08:00").split(":").map(Number);
    
    let nextDate = new Date(now);
    nextDate = setHours(nextDate, targetHour);
    nextDate = setMinutes(nextDate, targetMinute);
    nextDate.setSeconds(0);
    nextDate.setMilliseconds(0);

    // If today's time has passed, start from tomorrow
    if (nextDate <= now) {
      nextDate = addDays(nextDate, 1);
    }

    // Handle different frequency types
    switch (frequency.type) {
      case "daily":
        // Already set to next occurrence
        break;
      
      case "weekly":
      case "biweekly": {
        const targetDay = schedule.day_of_week ?? 1;
        const currentDay = nextDate.getDay();
        
        if (currentDay !== targetDay) {
          // Find next occurrence of target day
          const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
          nextDate = addDays(nextDate, daysUntil);
        }
        break;
      }
      
      case "monthly":
        // Approximate: 30 days from last send or next occurrence
        // For simplicity, use next Monday of next month
        nextDate = addDays(nextDate, 30 - nextDate.getDate() + 1);
        break;
      
      case "custom":
        // Custom interval - next occurrence based on interval_days
        // This is approximate since we don't know last send
        break;
    }

    // Skip weekends if enabled
    if (schedule.skip_weekends) {
      while (isWeekend(nextDate)) {
        nextDate = addDays(nextDate, 1);
      }
    }

    return {
      status: "scheduled",
      message: null,
      date: nextDate,
    };
  }, [schedule, frequency, hasRecipients]);

  const getStatusIcon = () => {
    switch (nextSendInfo.status) {
      case "paused":
        return <Pause className="w-5 h-5 text-muted-foreground" />;
      case "no_recipients":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case "scheduled":
        return <CheckCircle2 className="w-5 h-5 text-primary" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (nextSendInfo.status) {
      case "paused":
        return "border-muted";
      case "no_recipients":
        return "border-destructive bg-destructive/5";
      case "scheduled":
        return "border-primary/30 bg-primary/5";
      default:
        return "";
    }
  };

  return (
    <Card className={getStatusColor()}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="w-4 h-4" />
          Další plánované odeslání
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-3">
          {getStatusIcon()}
          <div className="flex-1">
            {nextSendInfo.status === "scheduled" && nextSendInfo.date ? (
              <>
                <p className="text-2xl font-bold">
                  {format(nextSendInfo.date, "d. MMMM yyyy", { locale: cs })}
                </p>
                <p className="text-lg text-muted-foreground">
                  {format(nextSendInfo.date, "EEEE", { locale: cs })} v {format(nextSendInfo.date, "HH:mm")}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">
                    {FREQUENCY_LABELS[frequency.type] || frequency.type}
                  </Badge>
                  {frequency.type === "custom" && (
                    <Badge variant="secondary">
                      každých {frequency.interval_days} dní
                    </Badge>
                  )}
                  {schedule.skip_weekends && (
                    <Badge variant="secondary">
                      přeskakuje víkendy
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <div>
                <p className="font-medium text-lg">
                  {nextSendInfo.message}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {nextSendInfo.status === "paused" 
                    ? "Zapněte odesílání v nastavení frekvence výše."
                    : "Vyberte alespoň jednoho příjemce v sekci Příjemci."}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
