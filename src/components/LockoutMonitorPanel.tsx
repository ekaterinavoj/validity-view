import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Lock, RefreshCw, ShieldAlert, Clock, Unlock } from "lucide-react";
import { formatDisplayDateTime } from "@/lib/dateFormat";
import { useToast } from "@/hooks/use-toast";

interface LockedAccount {
  email: string;
  failed_attempts: number;
  last_attempt: string;
  unlock_at: string;
}

interface HighRiskAttempt {
  email: string;
  failed_attempts: number;
  last_attempt: string;
  first_attempt: string;
  distinct_user_agents: number;
}

const THRESHOLD = 3;
const HOURS = 24;
// Účty, které se za N minut odemknou — varovat předem
const EXPIRY_WARNING_MINUTES = 5;

function formatDuration(targetIso: string | null | undefined): string {
  if (!targetIso) return "—";
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return "právě teď";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

export function LockoutMonitorPanel() {
  const { toast } = useToast();
  const [locked, setLocked] = useState<LockedAccount[]>([]);
  const [highRisk, setHighRisk] = useState<HighRiskAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlockingEmail, setUnlockingEmail] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lockedRes, riskRes] = await Promise.all([
        supabase.rpc("get_locked_accounts"),
        supabase.rpc("get_high_risk_signin_attempts", { _threshold: THRESHOLD, _hours: HOURS }),
      ]);

      if (lockedRes.error) throw lockedRes.error;
      if (riskRes.error) throw riskRes.error;

      setLocked((lockedRes.data ?? []) as LockedAccount[]);
      setHighRisk((riskRes.data ?? []) as HighRiskAttempt[]);
    } catch (e: any) {
      toast({
        title: "Chyba načítání",
        description: e?.message ?? "Nepodařilo se načíst stav uzamčených účtů.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const handleUnlock = useCallback(
    async (email: string) => {
      setUnlockingEmail(email);
      try {
        const { data, error } = await supabase.rpc("admin_unlock_account", { _email: email });
        if (error) throw error;
        const deleted = (data as any)?.deleted_attempts ?? 0;
        toast({
          title: "Účet odemčen",
          description: `${email} – smazáno ${deleted} neúspěšných pokusů.`,
        });
        await load();
      } catch (e: any) {
        toast({
          title: "Chyba odemčení",
          description: e?.message ?? "Nepodařilo se odemknout účet.",
          variant: "destructive",
        });
      } finally {
        setUnlockingEmail(null);
      }
    },
    [toast, load],
  );

  useEffect(() => {
    load();
    // auto-refresh každých 30s
    const intv = setInterval(load, 30_000);
    // tick pro odpočet každou sekundu
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(intv);
      clearInterval(tick);
    };
  }, [load]);

  // Účty, jejichž zamčení brzy vyprší
  const expiringSoon = useMemo(() => {
    return locked.filter((acc) => {
      const ms = new Date(acc.unlock_at).getTime() - now;
      return ms > 0 && ms <= EXPIRY_WARNING_MINUTES * 60_000;
    });
  }, [locked, now]);

  // Pouze ty, které ještě nejsou aktuálně uzamčené (jinak by byly v 'locked')
  const lockedEmails = useMemo(() => new Set(locked.map((l) => l.email.toLowerCase())), [locked]);
  const repeatedFailures = useMemo(
    () => highRisk.filter((r) => !lockedEmails.has(r.email.toLowerCase())),
    [highRisk, lockedEmails]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-primary" />
              Monitorování přihlašování
            </CardTitle>
            <CardDescription>
              Aktuálně uzamčené účty a opakované neúspěšné pokusy za posledních {HOURS} hodin.
              Auto-obnova každých 30 s.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Obnovit
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Upozornění – brzy vyprší zámek */}
        {expiringSoon.length > 0 && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Brzy vyprší zámek účtu</AlertTitle>
            <AlertDescription>
              {expiringSoon.length === 1
                ? "1 účet bude odemčen do několika minut."
                : `${expiringSoon.length} účtů bude odemčeno do několika minut.`}{" "}
              Po odemčení může uživatel opět zkusit přihlášení.
            </AlertDescription>
          </Alert>
        )}

        {/* Upozornění – opakované neúspěšné pokusy bez uzamčení */}
        {repeatedFailures.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Opakované neúspěšné přihlášení</AlertTitle>
            <AlertDescription>
              U {repeatedFailures.length}{" "}
              {repeatedFailures.length === 1 ? "e-mailu byl zaznamenán" : "e-mailů byly zaznamenány"}{" "}
              alespoň {THRESHOLD} neúspěšné pokusy o přihlášení za posledních {HOURS} h. Mohou
              znamenat snahu o uhodnutí hesla.
            </AlertDescription>
          </Alert>
        )}

        {/* Tabulka aktuálně uzamčených účtů */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Aktuálně uzamčené účty{" "}
              <Badge variant="secondary" className="ml-1">
                {locked.length}
              </Badge>
            </h3>
          </div>
          {locked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádné účty nejsou aktuálně uzamčené.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="text-right">Neúspěšné pokusy</TableHead>
                    <TableHead>Poslední pokus</TableHead>
                    <TableHead>Odemknutí</TableHead>
                    <TableHead>Zbývá</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locked.map((row) => {
                    const remainingMs = new Date(row.unlock_at).getTime() - now;
                    const isExpiringSoon =
                      remainingMs > 0 && remainingMs <= EXPIRY_WARNING_MINUTES * 60_000;
                    return (
                      <TableRow key={row.email}>
                        <TableCell className="font-mono text-xs">{row.email}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="destructive">{row.failed_attempts}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDisplayDateTime(row.last_attempt)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDisplayDateTime(row.unlock_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isExpiringSoon ? "outline" : "secondary"}>
                            {formatDuration(row.unlock_at)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Tabulka opakovaných selhání (bez uzamčení) */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              Opakovaná selhání bez uzamčení (≥ {THRESHOLD} za {HOURS} h){" "}
              <Badge variant="secondary" className="ml-1">
                {repeatedFailures.length}
              </Badge>
            </h3>
          </div>
          {repeatedFailures.length === 0 ? (
            <p className="text-sm text-muted-foreground">Žádné podezřelé pokusy.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="text-right">Pokusy</TableHead>
                    <TableHead>První pokus</TableHead>
                    <TableHead>Poslední pokus</TableHead>
                    <TableHead className="text-right">Různé prohlížeče</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repeatedFailures.map((row) => (
                    <TableRow key={row.email}>
                      <TableCell className="font-mono text-xs">{row.email}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{row.failed_attempts}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDisplayDateTime(row.first_attempt)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDisplayDateTime(row.last_attempt)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.distinct_user_agents}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
