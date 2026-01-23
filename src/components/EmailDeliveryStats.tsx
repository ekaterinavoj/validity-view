import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Mail, CheckCircle2, XCircle, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { cs } from "date-fns/locale";

interface EmailStats {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  avgAttempts: number;
  dailyStats: DailyStats[];
  failureReasons: FailureReason[];
  providerStats: ProviderStats[];
}

interface DailyStats {
  date: string;
  sent: number;
  failed: number;
  resent: number;
}

interface FailureReason {
  reason: string;
  count: number;
  percentage: number;
}

interface ProviderStats {
  provider: string;
  sent: number;
  failed: number;
  successRate: number;
}

// Categorize error messages into readable failure reasons
function categorizeError(errorMessage: string | null): string {
  if (!errorMessage) return "Neznámá chyba";
  
  const lowerError = errorMessage.toLowerCase();
  
  if (lowerError.includes("timeout") || lowerError.includes("etimedout")) {
    return "Časový limit";
  }
  if (lowerError.includes("rate") || lowerError.includes("too many")) {
    return "Překročen limit";
  }
  if (lowerError.includes("invalid") && (lowerError.includes("email") || lowerError.includes("recipient"))) {
    return "Neplatný příjemce";
  }
  if (lowerError.includes("unverified") || lowerError.includes("domain")) {
    return "Neověřená doména";
  }
  if (lowerError.includes("auth") || lowerError.includes("unauthorized") || lowerError.includes("api key")) {
    return "Chyba autorizace";
  }
  if (lowerError.includes("network") || lowerError.includes("connection") || lowerError.includes("econnreset")) {
    return "Síťová chyba";
  }
  if (lowerError.includes("5") && /5\d{2}/.test(lowerError)) {
    return "Chyba serveru";
  }
  if (lowerError.includes("not configured")) {
    return "Chybí konfigurace";
  }
  
  return "Ostatní";
}

const CHART_COLORS = {
  sent: "hsl(var(--status-valid))",
  failed: "hsl(var(--status-expired))",
  resent: "hsl(var(--primary))",
};

const PIE_COLORS = [
  "hsl(var(--status-expired))",
  "hsl(var(--status-warning))",
  "hsl(var(--primary))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--accent-foreground))",
];

export function EmailDeliveryStats() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [days, setDays] = useState(30);

  const loadStats = async () => {
    setLoading(true);
    try {
      const startDate = startOfDay(subDays(new Date(), days));
      
      const { data: logs, error } = await supabase
        .from("reminder_logs")
        .select("id, sent_at, status, error_message, provider_used, attempt_number, max_attempts, is_test")
        .gte("sent_at", startDate.toISOString())
        .eq("is_test", false)
        .order("sent_at", { ascending: true });

      if (error) throw error;

      // Calculate stats
      const totalSent = logs?.filter(l => l.status === "sent" || l.status === "resent").length || 0;
      const totalFailed = logs?.filter(l => l.status === "failed").length || 0;
      const total = totalSent + totalFailed;
      const successRate = total > 0 ? (totalSent / total) * 100 : 0;

      // Calculate average attempts for successful deliveries
      const successfulWithAttempts = logs?.filter(l => 
        (l.status === "sent" || l.status === "resent") && l.attempt_number
      ) || [];
      const avgAttempts = successfulWithAttempts.length > 0
        ? successfulWithAttempts.reduce((sum, l) => sum + (l.attempt_number || 1), 0) / successfulWithAttempts.length
        : 1;

      // Daily stats
      const dailyMap = new Map<string, DailyStats>();
      logs?.forEach(log => {
        const date = format(new Date(log.sent_at), "yyyy-MM-dd");
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, sent: 0, failed: 0, resent: 0 });
        }
        const day = dailyMap.get(date)!;
        if (log.status === "sent") day.sent++;
        else if (log.status === "failed") day.failed++;
        else if (log.status === "resent") day.resent++;
      });
      
      const dailyStats = Array.from(dailyMap.values()).map(d => ({
        ...d,
        date: format(new Date(d.date), "d. M.", { locale: cs }),
      }));

      // Failure reasons
      const failedLogs = logs?.filter(l => l.status === "failed") || [];
      const reasonCounts = new Map<string, number>();
      failedLogs.forEach(log => {
        const reason = categorizeError(log.error_message);
        reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      });
      
      const failureReasons: FailureReason[] = Array.from(reasonCounts.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          percentage: failedLogs.length > 0 ? (count / failedLogs.length) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Provider stats
      const providerMap = new Map<string, { sent: number; failed: number }>();
      logs?.forEach(log => {
        const provider = log.provider_used || "unknown";
        if (!providerMap.has(provider)) {
          providerMap.set(provider, { sent: 0, failed: 0 });
        }
        const p = providerMap.get(provider)!;
        if (log.status === "sent" || log.status === "resent") p.sent++;
        else if (log.status === "failed") p.failed++;
      });
      
      const providerStats: ProviderStats[] = Array.from(providerMap.entries()).map(([provider, data]) => ({
        provider,
        ...data,
        successRate: (data.sent + data.failed) > 0 ? (data.sent / (data.sent + data.failed)) * 100 : 0,
      }));

      setStats({
        totalSent,
        totalFailed,
        successRate,
        avgAttempts,
        dailyStats,
        failureReasons,
        providerStats,
      });
    } catch (error) {
      console.error("Failed to load email stats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [days]);

  if (loading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const chartConfig = {
    sent: { label: "Odesláno", color: CHART_COLORS.sent },
    failed: { label: "Selhalo", color: CHART_COLORS.failed },
    resent: { label: "Přeposláno", color: CHART_COLORS.resent },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Statistiky doručování emailů
          </h3>
          <p className="text-sm text-muted-foreground">
            Posledních {days} dní (bez testovacích emailů)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={days === 7 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(7)}
          >
            7 dní
          </Button>
          <Button
            variant={days === 30 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(30)}
          >
            30 dní
          </Button>
          <Button
            variant={days === 90 ? "default" : "outline"}
            size="sm"
            onClick={() => setDays(90)}
          >
            90 dní
          </Button>
          <Button variant="ghost" size="sm" onClick={loadStats}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-status-valid/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-status-valid" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Úspěšně odesláno</p>
              <p className="text-2xl font-bold">{stats.totalSent}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-status-expired/10 rounded-lg">
              <XCircle className="w-5 h-5 text-status-expired" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Neúspěšné</p>
              <p className="text-2xl font-bold">{stats.totalFailed}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Úspěšnost</p>
              <p className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Průměr pokusů</p>
              <p className="text-2xl font-bold">{stats.avgAttempts.toFixed(1)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Daily trend chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Denní trend doručování</CardTitle>
            <CardDescription>Počet odeslaných a neúspěšných emailů</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.dailyStats.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dailyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11 }} 
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="sent" name="Odesláno" fill={CHART_COLORS.sent} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="resent" name="Přeposláno" fill={CHART_COLORS.resent} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="failed" name="Selhalo" fill={CHART_COLORS.failed} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p>Žádná data za vybrané období</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Failure reasons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-warning" />
              Nejčastější důvody selhání
            </CardTitle>
            <CardDescription>Top 5 kategorií chyb</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.failureReasons.length > 0 ? (
              <div className="space-y-3">
                {stats.failureReasons.map((reason, idx) => (
                  <div key={reason.reason} className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">{reason.reason}</span>
                        <Badge variant="secondary" className="text-xs">
                          {reason.count}x ({reason.percentage.toFixed(0)}%)
                        </Badge>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all" 
                          style={{ 
                            width: `${reason.percentage}%`,
                            backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-status-valid opacity-50" />
                  <p>Žádné chyby za vybrané období</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Provider stats */}
      {stats.providerStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistiky podle poskytovatele</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {stats.providerStats.map(provider => (
                <div key={provider.provider} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{provider.provider}</span>
                    <Badge 
                      variant={provider.successRate >= 95 ? "default" : provider.successRate >= 80 ? "secondary" : "destructive"}
                    >
                      {provider.successRate.toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-status-valid" />
                      {provider.sent} úspěšných
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-status-expired" />
                      {provider.failed} neúspěšných
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}