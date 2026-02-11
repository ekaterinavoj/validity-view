import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Clock, AlertCircle, CheckCircle2, Pause, AlertTriangle } from "lucide-react";
import { format, addDays, setHours, setMinutes, isWeekend } from "date-fns";
import { cs } from "date-fns/locale";

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
  // Dual mode settings
  dual_mode?: boolean;
  expired_frequency?: string;
  expired_start_time?: string;
  warning_frequency?: string;
  warning_start_time?: string;
  warning_day_of_week?: number;
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
  twice_daily: "2x denně",
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

// Shared function to calculate next send date
function calculateNextSendDate(
  frequencyType: string,
  startTime: string,
  dayOfWeek: number,
  skipWeekends: boolean,
  timezone: string
): Date {
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
  
  const [targetHour, targetMinute] = (startTime || "08:00").split(":").map(Number);
  
  let nextDate = new Date(now);
  nextDate = setHours(nextDate, targetHour);
  nextDate = setMinutes(nextDate, targetMinute);
  nextDate.setSeconds(0);
  nextDate.setMilliseconds(0);

  // Check if we're past today's send window
  const currentMinutes = currentHour * 60 + currentMinute;
  const targetMinutes = targetHour * 60 + targetMinute;
  const pastTodayWindow = currentMinutes >= targetMinutes + 60;

  // Handle different frequency types
  switch (frequencyType) {
    case "daily":
    case "twice_daily":
      // If past today's window, move to tomorrow
      if (pastTodayWindow) {
        nextDate = addDays(nextDate, 1);
      }
      break;
    
    case "weekly":
    case "biweekly": {
      const targetDay = dayOfWeek ?? 1;
      
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

  // Skip weekends if enabled
  if (skipWeekends) {
    while (isWeekend(nextDate)) {
      nextDate = addDays(nextDate, 1);
    }
  }

  return nextDate;
}

export function NextSendPreview({ schedule, frequency, hasRecipients }: NextSendPreviewProps) {
  const nextSendInfo = useMemo(() => {
    // Check if enabled
    if (!frequency.enabled) {
      return { 
        status: "paused", 
        message: "Odesílání je pozastaveno",
        expiredDate: null,
        warningDate: null,
        singleDate: null,
        dualMode: false,
      };
    }

    if (!hasRecipients) {
      return { 
        status: "no_recipients", 
        message: "Nejsou vybráni příjemci",
        expiredDate: null,
        warningDate: null,
        singleDate: null,
        dualMode: false,
      };
    }

    const timezone = frequency.timezone || "Europe/Prague";

    // Dual mode - calculate separate dates for expired and warning
    if (frequency.dual_mode) {
      const expiredDate = calculateNextSendDate(
        frequency.expired_frequency || "daily",
        frequency.expired_start_time || "08:00",
        0, // Not used for daily
        schedule.skip_weekends,
        timezone
      );

      const warningDate = calculateNextSendDate(
        frequency.warning_frequency || "weekly",
        frequency.warning_start_time || "08:00",
        frequency.warning_day_of_week ?? 1,
        schedule.skip_weekends,
        timezone
      );

      return {
        status: "scheduled",
        message: null,
        expiredDate,
        warningDate,
        singleDate: null,
        dualMode: true,
        timezone,
        expiredFrequency: frequency.expired_frequency || "daily",
        warningFrequency: frequency.warning_frequency || "weekly",
      };
    }

    // Single mode - original behavior
    const singleDate = calculateNextSendDate(
      frequency.type,
      frequency.start_time,
      schedule.day_of_week,
      schedule.skip_weekends,
      timezone
    );

    return {
      status: "scheduled",
      message: null,
      expiredDate: null,
      warningDate: null,
      singleDate,
      dualMode: false,
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
            {nextSendInfo.status === "scheduled" ? (
              nextSendInfo.dualMode ? (
                // Dual mode display - two separate sections
                <div className="space-y-4">
                  {/* Expired emails section */}
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                      <span className="font-medium text-destructive">Prošlá školení</span>
                    </div>
                    {nextSendInfo.expiredDate && (
                      <>
                        <p className="text-lg font-bold">
                          {format(nextSendInfo.expiredDate, "d. MMMM yyyy", { locale: cs })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(nextSendInfo.expiredDate, "EEEE", { locale: cs })} v {format(nextSendInfo.expiredDate, "HH:mm")}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {FREQUENCY_LABELS[nextSendInfo.expiredFrequency as string] || nextSendInfo.expiredFrequency}
                        </Badge>
                      </>
                    )}
                  </div>

                   {/* Warning emails section */}
                   <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/20">
                     <div className="flex items-center gap-2 mb-2">
                       <AlertTriangle className="w-4 h-4 text-status-warning" />
                       <span className="font-medium text-status-warning">Blížící se expirace</span>
                     </div>
                    {nextSendInfo.warningDate && (
                      <>
                        <p className="text-lg font-bold">
                          {format(nextSendInfo.warningDate, "d. MMMM yyyy", { locale: cs })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(nextSendInfo.warningDate, "EEEE", { locale: cs })} v {format(nextSendInfo.warningDate, "HH:mm")}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {FREQUENCY_LABELS[nextSendInfo.warningFrequency as string] || nextSendInfo.warningFrequency}
                        </Badge>
                      </>
                    )}
                  </div>

                  {/* Common badges */}
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {TIMEZONE_LABELS[frequency.timezone] || frequency.timezone}
                    </Badge>
                    {schedule.skip_weekends && (
                      <Badge variant="secondary">
                        přeskakuje víkendy
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                // Single mode display - original behavior
                nextSendInfo.singleDate && (
                  <>
                    <p className="text-2xl font-bold">
                      {format(nextSendInfo.singleDate, "d. MMMM yyyy", { locale: cs })}
                    </p>
                    <p className="text-lg text-muted-foreground">
                      {format(nextSendInfo.singleDate, "EEEE", { locale: cs })} v {format(nextSendInfo.singleDate, "HH:mm")}
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
                )
              )
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
