import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Clock, AlertCircle, CheckCircle2, Pause } from "lucide-react";
import { format, addDays, setHours, setMinutes, isWeekend } from "date-fns";
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

const TIMEZONE_LABELS: Record<string, string> = {
  "Europe/Prague": "Praha",
  "Europe/London": "Londýn",
  "Europe/Berlin": "Berlín",
  "UTC": "UTC",
};

export function NextSendPreview({ schedule, frequency, hasRecipients }: NextSendPreviewProps) {
  const nextSendInfo = useMemo(() => {
    // Check if enabled - matches edge function isDueNow logic
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

    // Get current time in configured timezone (matches edge function)
    const timezone = frequency.timezone || "Europe/Prague";
    const now = new Date();
    
    // Format current time in target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
    });
    const parts = formatter.formatToParts(now);
    const currentHour = parseInt(parts.find(p => p.type === "hour")?.value || "0");
    const currentMinute = parseInt(parts.find(p => p.type === "minute")?.value || "0");
    const currentWeekdayEn = parts.find(p => p.type === "weekday")?.value || "";
    
    // Map English weekday to number
    const weekdayToNum: Record<string, number> = {
      "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
      "Thursday": 4, "Friday": 5, "Saturday": 6
    };
    const currentDayNum = weekdayToNum[currentWeekdayEn] ?? now.getDay();
    
    const [targetHour, targetMinute] = (frequency.start_time || "08:00").split(":").map(Number);
    
    let nextDate = new Date(now);
    nextDate = setHours(nextDate, targetHour);
    nextDate = setMinutes(nextDate, targetMinute);
    nextDate.setSeconds(0);
    nextDate.setMilliseconds(0);

    // Check if we're past today's send window
    const currentMinutes = currentHour * 60 + currentMinute;
    const targetMinutes = targetHour * 60 + targetMinute;
    const pastTodayWindow = currentMinutes >= targetMinutes + 60;

    // Handle different frequency types (matches edge function logic)
    switch (frequency.type) {
      case "daily":
        // If past today's window, move to tomorrow
        if (pastTodayWindow) {
          nextDate = addDays(nextDate, 1);
        }
        break;
      
      case "weekly":
      case "biweekly": {
        const targetDay = schedule.day_of_week ?? 1;
        
        if (currentDayNum === targetDay && !pastTodayWindow) {
          // Today is the day and we haven't missed the window
        } else {
          // Find next occurrence of target day
          let daysUntil = (targetDay - currentDayNum + 7) % 7;
          if (daysUntil === 0) daysUntil = 7; // If same day but past window, go to next week
          nextDate = addDays(nextDate, daysUntil);
        }
        break;
      }
      
      case "monthly":
        // Approximate: next month's first occurrence
        if (pastTodayWindow || now.getDate() > 7) {
          const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          nextDate = setHours(nextMonth, targetHour);
          nextDate = setMinutes(nextDate, targetMinute);
        }
        break;
      
      case "custom":
        // For custom, just show next occurrence based on interval
        if (pastTodayWindow) {
          nextDate = addDays(nextDate, 1);
        }
        break;
    }

    // Skip weekends if enabled (matches edge function logic)
    if (schedule.skip_weekends) {
      while (isWeekend(nextDate)) {
        nextDate = addDays(nextDate, 1);
      }
    }

    return {
      status: "scheduled",
      message: null,
      date: nextDate,
      timezone,
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
                  <Badge variant="outline">
                    {TIMEZONE_LABELS[frequency.timezone] || frequency.timezone}
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
