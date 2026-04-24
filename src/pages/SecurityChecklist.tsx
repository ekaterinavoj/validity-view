import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, AlertTriangle, CheckCircle2, ExternalLink, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

type Severity = "critical" | "high" | "medium" | "info";

interface ChecklistItem {
  id: string;
  category: "transport" | "headers" | "auth" | "rls" | "rate" | "secrets" | "monitoring";
  title: string;
  description: string;
  severity: Severity;
  selfHostedAction: string;
  cloudAction?: string;
  docsLink?: string;
}

const CHECKLIST: ChecklistItem[] = [
  {
    id: "https-redirect",
    category: "transport",
    title: "HTTP → HTTPS přesměrování",
    description:
      "Veškerý provoz musí běžet po HTTPS. HTTP požadavky musí být přesměrovány (301) na HTTPS, jinak hrozí únik session cookies a hesel přes nezabezpečený kanál.",
    severity: "critical",
    selfHostedAction:
      "Reverzní proxy (selfhosted-resources/nginx-reverseproxy/frontend) obsahuje server { listen 80; return 301 https://$host$request_uri; }. Ověřte, že porty 80/443 jsou otevřené a Certbot vystavuje platný TLS certifikát.",
    cloudAction:
      "Lovable Cloud automaticky vynucuje HTTPS pro všechny domény (preview i custom).",
  },
  {
    id: "hsts",
    category: "headers",
    title: "Strict-Transport-Security (HSTS)",
    description:
      "Hlavička HSTS instruuje prohlížeč, aby s doménou komunikoval pouze přes HTTPS po dobu 1 roku. Brání útokům typu SSL stripping.",
    severity: "high",
    selfHostedAction:
      "V nginx.conf a reverse-proxy je nastaveno: add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains; preload\" always;",
    cloudAction: "Cloud nasazení má HSTS nastavené automaticky.",
  },
  {
    id: "csp",
    category: "headers",
    title: "Content-Security-Policy (CSP)",
    description:
      "CSP omezuje, odkud se mohou načítat skripty, styly a další zdroje. Zabraňuje XSS útokům i exfiltraci dat na cizí domény.",
    severity: "high",
    selfHostedAction:
      "V nginx.conf je nastavena CSP politika s default-src 'self', připojením jen na Supabase domény a frame-ancestors 'none'. Ověřte v devtools → Network → Response Headers.",
    cloudAction: "Cloud má základní CSP. Pro custom doménu doporučte HTTP hlavičky přes proxy.",
  },
  {
    id: "frame-ancestors",
    category: "headers",
    title: "X-Frame-Options / frame-ancestors",
    description:
      "Zabraňuje vložení aplikace do iframe na cizí stránce (ochrana proti clickjacking).",
    severity: "high",
    selfHostedAction:
      "X-Frame-Options: SAMEORIGIN + CSP frame-ancestors 'none' je v nginx.conf nastaveno.",
  },
  {
    id: "rate-limit-auth",
    category: "rate",
    title: "Rate limiting na /auth/v1/* (anti brute-force)",
    description:
      "Bez limitu může útočník zkoušet hesla rychlostí tisíců pokusů za sekundu. Nutná ochrana přihlášení.",
    severity: "critical",
    selfHostedAction:
      "V selfhosted-resources/nginx-reverseproxy/frontend-api je nastaveno: limit_req_zone auth_strict rate=5r/m, burst=3 pro /auth/v1/(token|signup|recover|otp|magiclink). Definujte zóny v hlavním nginx.conf v http {} kontextu.",
    cloudAction: "Cloud má aplikační rate limiting na auth endpoints.",
  },
  {
    id: "rate-limit-general",
    category: "rate",
    title: "Obecný rate limiting na ostatní endpointy",
    description:
      "Limit požadavků per IP brání DoS útokům a scrapingu dat.",
    severity: "medium",
    selfHostedAction:
      "Zóna api_general rate=30r/s, burst=60 v nginx.conf. limit_conn conn_per_ip 50 omezuje souběžná spojení.",
  },
  {
    id: "rls",
    category: "rls",
    title: "Row-Level Security (RLS) na všech tabulkách",
    description:
      "Bez RLS může každý autentizovaný uživatel číst/měnit data všech ostatních. RLS je hlavní obrana citlivých údajů.",
    severity: "critical",
    selfHostedAction:
      "Spusťte v administraci → Bezpečnost → \"Spustit security scan\". Detekuje tabulky bez RLS i příliš povolené policy. Případné migrace aplikujte přes Database Migrations.",
    docsLink: "https://docs.lovable.dev/features/security",
  },
  {
    id: "secure-cookies",
    category: "auth",
    title: "Secure / HttpOnly / SameSite cookies",
    description:
      "Auth tokeny v Supabase jsou předávány v Authorization header (Bearer JWT) a session je v localStorage. Reverse-proxy musí vynucovat HTTPS, jinak token uniká po síti.",
    severity: "high",
    selfHostedAction:
      "Reverse-proxy nastavuje X-Forwarded-Proto https + HSTS. Pokud používáte cookie-based session, doplňte v nginx: proxy_cookie_flags ~ secure samesite=strict;",
  },
  {
    id: "secrets-rotation",
    category: "secrets",
    title: "Rotace secrets (DB heslo, JWT secret, SMTP)",
    description:
      "Únik klíčů znamená kompletní kompromitaci. Pravidelná rotace (alespoň 1× ročně, ihned po podezření) snižuje riziko.",
    severity: "high",
    selfHostedAction:
      "Aktualizujte v docker/.env: POSTGRES_PASSWORD, JWT_SECRET, SUPABASE_SERVICE_KEY, SMTP_PASSWORD. Po změně JWT_SECRET je nutné odhlásit všechny uživatele. Nezapomeňte i SECRET_KEY_BASE pro Realtime.",
    cloudAction: "V cloudu lze rotovat přes Lovable Cloud → Connections → API keys.",
  },
  {
    id: "default-admin",
    category: "secrets",
    title: "Změna výchozího admin hesla",
    description:
      "Edge funkce seed-initial-admin vytváří účet admin@system.local / admin123. Bez okamžité změny hesla je systém otevřený.",
    severity: "critical",
    selfHostedAction:
      "Při prvním přihlášení vás aplikace vynutí změnu hesla. Po změně účet znovu nepoužívejte pro běžnou práci, vytvořte si nominační admin účet.",
  },
  {
    id: "audit-logs",
    category: "monitoring",
    title: "Audit log a monitoring přihlášení",
    description:
      "Tabulky audit_logs a auth_signin_attempts zaznamenávají všechny akce a pokusy o přihlášení. Pravidelně kontrolujte.",
    severity: "medium",
    selfHostedAction:
      "Audit log je dostupný v menu Administrace → Audit log. Doporučujeme nastavit retenci a archivaci starších záznamů.",
  },
  {
    id: "smtp-tls",
    category: "transport",
    title: "TLS/STARTTLS pro SMTP",
    description:
      "E-maily s daty zaměstnanců (PLP, technické lhůty) musí být šifrovány během přenosu.",
    severity: "high",
    selfHostedAction:
      "V administraci → Email → SMTP nastavení použijte port 587 (STARTTLS) nebo 465 (SMTPS). M365 a Gmail OAuth2 jsou šifrované automaticky.",
  },
  {
    id: "backup",
    category: "monitoring",
    title: "Pravidelné zálohy databáze",
    description:
      "Bez záloh hrozí trvalá ztráta dat při ransomwaru, hardware selhání nebo lidské chybě.",
    severity: "high",
    selfHostedAction:
      "Nastavte automatický pg_dump (denní snapshoty s retencí 30 dní) a uchovávejte zálohy mimo hlavní server. Otestujte obnovu alespoň 1× měsíčně.",
    cloudAction: "Cloud zálohuje automaticky každých 24 h s retencí 7 dní.",
  },
  {
    id: "permissions-policy",
    category: "headers",
    title: "Permissions-Policy",
    description:
      "Zakazuje prohlížeči přístup k senzorům (kamera, mikrofon, GPS, atd.), které aplikace nepoužívá.",
    severity: "info",
    selfHostedAction:
      "V nginx.conf: add_header Permissions-Policy \"camera=(), microphone=(), geolocation=(), interest-cohort=()\" always;",
  },
  {
    id: "security-scan",
    category: "monitoring",
    title: "Pravidelný security scan",
    description:
      "Spouštějte scan před každým nasazením a alespoň 1× měsíčně.",
    severity: "medium",
    selfHostedAction:
      "Administrace → Bezpečnost → Spustit security scan. Spouští DB linter, kontroluje CSP/HSTS hlavičky a auditujev secrets.",
  },
];

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
      return "Doporučení";
  }
};

const STORAGE_KEY = "security-checklist-state-v1";

export default function SecurityChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const totalCritical = CHECKLIST.filter((i) => i.severity === "critical").length;
  const completedCritical = CHECKLIST.filter((i) => i.severity === "critical" && checked[i.id]).length;
  const totalCompleted = CHECKLIST.filter((i) => checked[i.id]).length;
  const totalCount = CHECKLIST.length;

  const handleExport = () => {
    const lines = [
      "# Security Hardening Checklist",
      `Vygenerováno: ${new Date().toISOString()}`,
      `Splněno: ${totalCompleted} / ${totalCount}`,
      "",
    ];
    CHECKLIST.forEach((item) => {
      const mark = checked[item.id] ? "[x]" : "[ ]";
      lines.push(`${mark} **${item.title}** (${severityLabel(item.severity)})`);
      lines.push(`    ${item.description}`);
      lines.push(`    Self-hosted: ${item.selfHostedAction}`);
      if (item.cloudAction) lines.push(`    Cloud: ${item.cloudAction}`);
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `security-checklist-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const grouped = CHECKLIST.reduce(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {} as Record<string, ChecklistItem[]>,
  );

  const categoryLabels: Record<string, string> = {
    transport: "Šifrování přenosu",
    headers: "HTTP bezpečnostní hlavičky",
    auth: "Autentizace a session",
    rls: "Database & RLS",
    rate: "Rate limiting & brute-force",
    secrets: "Secrets a hesla",
    monitoring: "Monitoring & zálohy",
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      <PageHeader
        icon={ShieldCheck}
        title="Security hardening checklist"
        description="Kontrolní seznam pro bezpečné nasazení aplikace na produkční doménu (self-hosted i cloud)."
      />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Stav hardeningu</CardTitle>
              <CardDescription>
                Splněno: <strong>{totalCompleted} / {totalCount}</strong>
                {" · "}
                Kritické položky: <strong>{completedCritical} / {totalCritical}</strong>
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport} title="Stáhnout checklist jako Markdown">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {completedCritical < totalCritical ? (
            <div className="flex items-start gap-2 p-3 bg-status-error/10 border border-status-error/30 rounded-md">
              <AlertTriangle className="w-5 h-5 text-status-error shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>Před nasazením do produkce:</strong> dokončete všechny kritické
                položky ({totalCritical - completedCritical} zbývá). Aplikace obsahuje
                citlivé osobní údaje zaměstnanců (PLP) a podléhá GDPR.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 p-3 bg-status-success/10 border border-status-success/30 rounded-md">
              <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
              <div className="text-sm">
                Všechny kritické položky jsou splněné. Doporučujeme dokončit i ostatní
                a spustit pravidelný security scan.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category}>
          <CardHeader>
            <CardTitle className="text-lg">{categoryLabels[category]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id}>
                {idx > 0 && <Separator className="my-4" />}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={item.id}
                    checked={!!checked[item.id]}
                    onCheckedChange={() => toggle(item.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <label htmlFor={item.id} className="flex items-center gap-2 font-medium cursor-pointer">
                      {item.title}
                      <Badge variant="outline" className={severityColor(item.severity)}>
                        {severityLabel(item.severity)}
                      </Badge>
                    </label>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <div className="text-xs space-y-1 bg-muted/50 p-3 rounded border">
                      <div>
                        <strong className="text-foreground">Self-hosted:</strong>{" "}
                        <span className="text-muted-foreground">{item.selfHostedAction}</span>
                      </div>
                      {item.cloudAction && (
                        <div>
                          <strong className="text-foreground">Cloud:</strong>{" "}
                          <span className="text-muted-foreground">{item.cloudAction}</span>
                        </div>
                      )}
                      {item.docsLink && (
                        <a
                          href={item.docsLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          Dokumentace <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
