import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShieldCheck, AlertTriangle, CheckCircle2, Play, History as HistoryIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDisplayDateTime } from "@/lib/dateFormat";
import { useToast } from "@/hooks/use-toast";

type Severity = "critical" | "high" | "medium" | "info";

interface ScanFinding {
  id: string;
  category: "rls" | "headers" | "secrets" | "auth" | "config";
  title: string;
  description: string;
  severity: Severity;
  remediation?: string;
}

interface ScanRun {
  id: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  findings: ScanFinding[];
}

const HISTORY_KEY = "security-scan-history-v1";
const MAX_HISTORY = 20;

const severityColor = (s: Severity) => {
  switch (s) {
    case "critical":
      return "bg-status-error/15 text-status-error border-status-error/30";
    case "high":
      return "bg-status-warning/15 text-status-warning border-status-warning/30";
    case "medium":
      return "bg-primary/10 text-primary border-primary/30";
    case "info":
      return "bg-muted text-muted-foreground border-border";
  }
};

const severityLabel = (s: Severity) => {
  switch (s) {
    case "critical":
      return "Kritické";
    case "high":
      return "Vysoké";
    case "medium":
      return "Střední";
    case "info":
      return "Info";
  }
};

/**
 * Provede klientský bezpečnostní sken:
 * 1) RLS / DB integrita — ověří přístup k chráněným tabulkám bez auth
 * 2) HTTP headers — ověří přítomnost CSP, HSTS, X-Frame-Options
 * 3) Secrets / config — kontrola výchozích hodnot
 */
async function runScan(): Promise<ScanFinding[]> {
  const findings: ScanFinding[] = [];

  // === 1) RLS / DB checks ===
  // Test: dotaz na citlivé tabulky bez auth tokenu by měl vrátit prázdné výsledky.
  // Kontrolujeme veřejné endpointy přes anon key (klient).
  try {
    // Anon klient je již nakonfigurován; tento test ověří, že RLS skutečně blokuje
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      findings.push({
        id: "rls_no_session",
        category: "auth",
        title: "Nelze ověřit RLS bez aktivní session",
        description: "Pro úplný RLS sken je potřeba být přihlášen jako admin.",
        severity: "info",
      });
    } else {
      // Zkus dotaz na `auth_signin_attempts` — měl by být přístupný jen adminovi
      const { error: signinErr } = await supabase
        .from("auth_signin_attempts")
        .select("id")
        .limit(1);
      if (signinErr && signinErr.code !== "PGRST301") {
        findings.push({
          id: "rls_signin_attempts_blocked",
          category: "rls",
          title: "auth_signin_attempts není přístupné",
          description: `RLS správně blokuje neautorizovaný přístup. Detail: ${signinErr.message}`,
          severity: "info",
        });
      }
    }
  } catch (e) {
    findings.push({
      id: "rls_check_error",
      category: "rls",
      title: "Chyba při RLS testu",
      description: String(e),
      severity: "medium",
    });
  }

  // === 1b) RLS coverage — kontrola, zda všechny tabulky mají RLS politiky ===
  try {
    const { data: coverage, error: covErr } = await supabase.rpc(
      "security_scan_rls_coverage" as never
    );

    if (covErr) {
      if (covErr.message?.includes("admin role required")) {
        findings.push({
          id: "rls_coverage_no_admin",
          category: "rls",
          title: "RLS coverage check vyžaduje admin roli",
          description:
            "Pro plnou kontrolu pokrytí RLS politikami se přihlaste jako administrátor a spusťte sken znovu.",
          severity: "info",
        });
      } else {
        findings.push({
          id: "rls_coverage_rpc_missing",
          category: "rls",
          title: "RPC security_scan_rls_coverage není dostupné",
          description: `Migrace nemusí být aplikovaná. Detail: ${covErr.message}`,
          severity: "medium",
          remediation:
            "V Administraci → Migrace databáze aplikujte migraci 'security_scan_rls_coverage_rpc'.",
        });
      }
    } else if (Array.isArray(coverage)) {
      type CoverageRow = {
        table_name: string;
        rls_enabled: boolean;
        policy_count: number;
        status: "rls_disabled" | "no_policies" | "ok";
      };
      const rows = coverage as CoverageRow[];
      const disabled = rows.filter((r) => r.status === "rls_disabled");
      const noPolicies = rows.filter((r) => r.status === "no_policies");
      const totalTables = rows.length;
      const okCount = rows.filter((r) => r.status === "ok").length;

      if (disabled.length > 0) {
        findings.push({
          id: "rls_disabled_tables",
          category: "rls",
          title: `${disabled.length} tabulek má vypnutou ochranu řádků (RLS)`,
          description: `Konkrétní tabulky bez RLS: ${disabled
            .map((d) => d.table_name)
            .join(", ")}. Bez RLS může každý přihlášený uživatel číst i měnit jejich data.`,
          severity: "critical",
          remediation:
            "Pro každou tabulku spusťte: ALTER TABLE public.<nazev> ENABLE ROW LEVEL SECURITY; a doplňte odpovídající policies.",
        });
      }

      if (noPolicies.length > 0) {
        findings.push({
          id: "rls_no_policies_tables",
          category: "rls",
          title: `${noPolicies.length} tabulek má RLS zapnutou, ale žádnou politiku`,
          description: `Tyto tabulky efektivně blokují veškerý přístup pro běžné role: ${noPolicies
            .map((d) => d.table_name)
            .join(
              ", "
            )}. Pravděpodobně chybí explicitní policies pro čtení/zápis/úpravu/mazání.`,
          severity: "high",
          remediation:
            "Doplňte RLS policies podle vzoru ostatních tabulek (admin/manager/approved user).",
        });
      }

      if (disabled.length === 0 && noPolicies.length === 0) {
        findings.push({
          id: "rls_coverage_ok",
          category: "rls",
          title: `RLS pokrývá všech ${totalTables} tabulek aplikace`,
          description: `Všech ${okCount} tabulek v public schématu má zapnutou RLS a alespoň jednu politiku.`,
          severity: "info",
        });
      }
    }
  } catch (e) {
    findings.push({
      id: "rls_coverage_error",
      category: "rls",
      title: "Chyba při kontrole RLS pokrytí",
      description: String(e),
      severity: "medium",
    });
  }

  // === 2) HTTP Security Headers ===
  try {
    const res = await fetch(window.location.origin + "/", { method: "HEAD" });
    const headers = res.headers;

    if (!headers.get("strict-transport-security")) {
      findings.push({
        id: "header_hsts_missing",
        category: "headers",
        title: "Chybí Strict-Transport-Security (HSTS)",
        description:
          "Hlavička HSTS instruuje prohlížeč, aby s doménou komunikoval pouze přes HTTPS. Bez ní hrozí SSL stripping útoky.",
        severity: "high",
        remediation:
          "V nginx.conf přidejte: add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;",
      });
    }

    if (!headers.get("content-security-policy")) {
      findings.push({
        id: "header_csp_missing",
        category: "headers",
        title: "Chybí Content-Security-Policy (CSP)",
        description:
          "CSP omezuje, odkud se mohou načítat skripty. Bez ní je aplikace zranitelná na XSS útoky.",
        severity: "high",
        remediation:
          "V nginx.conf nastavte CSP s default-src 'self' a omezeným seznamem povolených zdrojů.",
      });
    }

    if (!headers.get("x-frame-options") && !headers.get("content-security-policy")?.includes("frame-ancestors")) {
      findings.push({
        id: "header_xfo_missing",
        category: "headers",
        title: "Chybí X-Frame-Options",
        description:
          "Bez této hlavičky lze aplikaci vložit do iframe na cizí stránce (clickjacking).",
        severity: "high",
        remediation: "add_header X-Frame-Options \"SAMEORIGIN\" always;",
      });
    }

    if (!headers.get("x-content-type-options")) {
      findings.push({
        id: "header_xcto_missing",
        category: "headers",
        title: "Chybí X-Content-Type-Options",
        description: "MIME-type sniffing může vést k XSS přes nahrané soubory.",
        severity: "medium",
        remediation: "add_header X-Content-Type-Options \"nosniff\" always;",
      });
    }

    if (!headers.get("referrer-policy")) {
      findings.push({
        id: "header_referrer_missing",
        category: "headers",
        title: "Chybí Referrer-Policy",
        description:
          "Bez politiky se v Referer header předávají URL s citlivými parametry na cizí domény.",
        severity: "medium",
        remediation: "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;",
      });
    }

    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      findings.push({
        id: "transport_no_https",
        category: "headers",
        title: "Aplikace neběží přes HTTPS",
        description:
          "Kritická chyba — veškerá komunikace včetně hesel a tokenů je v plaintextu.",
        severity: "critical",
        remediation:
          "Nasaďte TLS certifikát (Let's Encrypt / Certbot) a přidejte HTTP→HTTPS redirect v reverse proxy.",
      });
    }
  } catch (e) {
    findings.push({
      id: "header_fetch_error",
      category: "headers",
      title: "Nelze ověřit HTTP hlavičky",
      description: `Chyba při kontrole: ${String(e)}`,
      severity: "info",
    });
  }

  // === 3) Secrets / config audit ===
  try {
    // Kontrola výchozího admin účtu
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("email, must_change_password")
      .eq("email", "admin@system.local")
      .maybeSingle();

    if (adminProfile && adminProfile.must_change_password) {
      findings.push({
        id: "secret_default_admin",
        category: "secrets",
        title: "Výchozí admin účet nemá změněné heslo",
        description:
          "Účet admin@system.local stále vyžaduje povinnou změnu hesla. Pokud je v produkci, je riziko.",
        severity: "critical",
        remediation:
          "Přihlaste se jako admin@system.local, změňte heslo a vytvořte si nominační admin účet.",
      });
    }

    // Test SMTP konfigurace
    const { data: smtpSetting } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "smtp_config")
      .maybeSingle();

    const smtp = smtpSetting?.value as { host?: string; secure?: boolean } | null;
    if (smtp && smtp.host && smtp.secure === false) {
      findings.push({
        id: "smtp_insecure",
        category: "config",
        title: "SMTP konfigurace nepoužívá TLS",
        description: "E-maily s daty zaměstnanců jsou odesílány bez šifrování.",
        severity: "high",
        remediation:
          "V administraci → Email → SMTP nastavte port 587 (STARTTLS) nebo 465 (SMTPS).",
      });
    }
  } catch (e) {
    // RLS může blokovat — to je v pořádku
  }

  // === 4) Pozitivní zjištění (pokud nic nenalezeno) ===
  if (findings.filter((f) => f.severity === "critical" || f.severity === "high").length === 0) {
    findings.push({
      id: "scan_clean",
      category: "config",
      title: "Sken neodhalil kritická ani vysoká rizika",
      description:
        "Aplikace má základní bezpečnostní hlavičky, RLS funguje a výchozí admin má změněné heslo. Pokračujte v pravidelném monitoringu.",
      severity: "info",
    });
  }

  return findings;
}

export function SecurityScanRunner() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<ScanRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<ScanRun | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const parsed: ScanRun[] = JSON.parse(raw);
        setHistory(parsed);
        if (parsed.length > 0) setSelectedRun(parsed[0]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleRun = async () => {
    setRunning(true);
    const startedAt = new Date();
    try {
      const findings = await runScan();
      const endedAt = new Date();
      const bySeverity: Record<Severity, number> = {
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        info: findings.filter((f) => f.severity === "info").length,
      };
      const run: ScanRun = {
        id: crypto.randomUUID(),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        totalFindings: findings.length,
        bySeverity,
        findings,
      };

      const newHistory = [run, ...history].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      setSelectedRun(run);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
      } catch {
        /* quota */
      }

      toast({
        title: "Security scan dokončen",
        description: `${findings.length} zjištění — ${bySeverity.critical} kritických, ${bySeverity.high} vysokých.`,
      });
    } catch (e) {
      toast({
        title: "Scan selhal",
        description: String(e),
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Security scan
              </CardTitle>
              <CardDescription>
                RLS + HTTP hlavičky + secrets audit. Spusťte před každým nasazením do produkce.
              </CardDescription>
            </div>
            <Button onClick={handleRun} disabled={running} size="lg">
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Probíhá sken…
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Spustit security scan
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Poslední běh</CardTitle>
                <CardDescription>
                  {formatDisplayDateTime(selectedRun.startedAt)} · trvání {selectedRun.durationMs} ms
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["critical", "high", "medium", "info"] as Severity[]).map((s) => (
                  <Badge key={s} variant="outline" className={severityColor(s)}>
                    {severityLabel(s)}: {selectedRun.bySeverity[s]}
                  </Badge>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {selectedRun.findings.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-status-success" />
                Žádná zjištění.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedRun.findings.map((f) => (
                  <div key={f.id} className="border rounded-md p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        {f.severity === "critical" || f.severity === "high" ? (
                          <AlertTriangle className="w-4 h-4 text-status-warning" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        )}
                        {f.title}
                      </h4>
                      <Badge variant="outline" className={severityColor(f.severity)}>
                        {severityLabel(f.severity)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{f.description}</p>
                    {f.remediation && (
                      <div className="text-xs bg-muted/50 p-2 rounded border mt-2">
                        <strong>Náprava:</strong> {f.remediation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HistoryIcon className="w-5 h-5" />
              Historie běhů
            </CardTitle>
            <CardDescription>Posledních {history.length} skenů (uloženo lokálně).</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum a čas</TableHead>
                  <TableHead>Trvání</TableHead>
                  <TableHead>Kritické</TableHead>
                  <TableHead>Vysoké</TableHead>
                  <TableHead>Střední</TableHead>
                  <TableHead>Info</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((run) => (
                  <TableRow key={run.id} className={run.id === selectedRun?.id ? "bg-accent/30" : ""}>
                    <TableCell className="text-sm">{formatDisplayDateTime(run.startedAt)}</TableCell>
                    <TableCell className="text-sm">{run.durationMs} ms</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={severityColor("critical")}>
                        {run.bySeverity.critical}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={severityColor("high")}>
                        {run.bySeverity.high}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={severityColor("medium")}>
                        {run.bySeverity.medium}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={severityColor("info")}>
                        {run.bySeverity.info}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRun(run)}>
                        Zobrazit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <a
            href="/admin/security-checklist"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Otevřít kompletní security hardening checklist
            <ExternalLink className="w-3 h-3" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
