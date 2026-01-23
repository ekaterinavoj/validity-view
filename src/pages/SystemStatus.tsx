import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Mail, 
  Play,
  Send,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface ReminderRun {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  emails_sent: number;
  emails_failed: number;
  error_message: string | null;
  error_details: any;
  week_start: string;
  triggered_by: string;
}

export default function SystemStatus() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<ReminderRun[]>([]);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [runningReminders, setRunningReminders] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    loadRuns();
  }, [isAdmin, navigate]);

  const loadRuns = async () => {
    try {
      const { data, error } = await supabase
        .from("reminder_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      setRuns(data || []);
    } catch (error: any) {
      toast({
        title: "Chyba při načítání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({
        title: "Chyba",
        description: "Zadejte emailovou adresu",
        variant: "destructive",
      });
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { email: testEmail },
      });

      if (error) throw error;

      toast({
        title: "Testovací email odeslán",
        description: `Email byl úspěšně odeslán na ${testEmail}`,
      });
    } catch (error: any) {
      toast({
        title: "Chyba při odesílání",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleRunReminders = async () => {
    setRunningReminders(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-reminders", {
        body: { triggered_by: "manual" },
      });

      if (error) throw error;

      toast({
        title: "Připomínky spuštěny",
        description: `Odesláno ${data?.emailsSent || 0} emailů`,
      });
      
      // Reload runs after a short delay
      setTimeout(loadRuns, 2000);
    } catch (error: any) {
      toast({
        title: "Chyba při spouštění",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setRunningReminders(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-primary/20 text-primary">Úspěch</Badge>;
      case "failed":
        return <Badge variant="destructive">Chyba</Badge>;
      case "running":
        return <Badge variant="secondary">Probíhá</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTriggerLabel = (trigger: string) => {
    switch (trigger) {
      case "manual":
        return "Manuální";
      case "cron":
        return "Automaticky (cron)";
      case "pg_cron":
        return "Automaticky (pg_cron)";
      default:
        return trigger;
    }
  };

  const lastSuccessfulRun = runs.find(r => r.status === "success");
  const lastFailedRun = runs.find(r => r.status === "failed");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold text-foreground">Stav systému</h2>
          <p className="text-muted-foreground">Monitoring a diagnostika</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Poslední úspěšný běh
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastSuccessfulRun ? (
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {format(new Date(lastSuccessfulRun.started_at), "d. M. yyyy HH:mm", { locale: cs })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastSuccessfulRun.emails_sent} emailů odesláno
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Zatím žádný běh</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Celkem emailů tento týden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {runs
                .filter(r => r.status === "success")
                .reduce((sum, r) => sum + r.emails_sent, 0)}
            </p>
          </CardContent>
        </Card>

        <Card className={lastFailedRun ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Poslední chyba
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lastFailedRun ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">
                  {format(new Date(lastFailedRun.started_at), "d. M. yyyy HH:mm", { locale: cs })}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {lastFailedRun.error_message || "Neznámá chyba"}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="w-5 h-5" />
                <span>Žádné chyby</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Akce</CardTitle>
          <CardDescription>
            Testování a manuální spuštění
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <Label>Testovací email</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button onClick={handleSendTestEmail} disabled={sendingTest}>
                  {sendingTest ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Odešle testovací email pro ověření konfigurace
              </p>
            </div>

            <Separator orientation="vertical" className="hidden sm:block" />

            <div className="flex-1 space-y-2">
              <Label>Spustit připomínky</Label>
              <Button 
                onClick={handleRunReminders} 
                disabled={runningReminders}
                className="w-full"
              >
                {runningReminders ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Probíhá...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Spustit nyní
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Manuálně spustí kontrolu a odeslání připomínek
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Run History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Historie běhů</CardTitle>
            <CardDescription>
              Posledních 10 spuštění připomínkového systému
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadRuns}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Obnovit
          </Button>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Zatím žádné záznamy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => (
                <div 
                  key={run.id} 
                  className="flex items-start justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {run.status === "success" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      {run.status === "failed" && <XCircle className="w-4 h-4 text-destructive" />}
                      {run.status === "running" && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span className="font-medium">
                        {format(new Date(run.started_at), "d. M. yyyy HH:mm:ss", { locale: cs })}
                      </span>
                      {getStatusBadge(run.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {run.emails_sent} odesláno
                      </span>
                      {run.emails_failed > 0 && (
                        <span className="flex items-center gap-1 text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          {run.emails_failed} selhalo
                        </span>
                      )}
                      <span>{getTriggerLabel(run.triggered_by)}</span>
                    </div>
                    {run.error_message && (
                      <p className="text-sm text-destructive mt-2">
                        {run.error_message}
                      </p>
                    )}
                  </div>
                  {run.ended_at && (
                    <span className="text-xs text-muted-foreground">
                      Trvání: {Math.round((new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}