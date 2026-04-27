import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, AlertTriangle, CheckCircle2, ExternalLink, Download, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { HelpButton } from "@/components/HelpButton";
import { useSecurityChecklistState } from "@/hooks/useSecurityChecklistState";
import { formatDisplayDateTime } from "@/lib/dateFormat";

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
  // ============== NOVÉ POLOŽKY ==============
  {
    id: "hibp",
    category: "auth",
    title: "Ochrana proti uniklým heslům (HIBP)",
    description:
      "Supabase GoTrue umí kontrolovat hesla proti databázi Have I Been Pwned a odmítnout dříve uniklá hesla. Bez této kontroly mohou uživatelé používat hesla z známých leakových databází.",
    severity: "high",
    selfHostedAction:
      "V docker/.env (resp. selfhosted-resources/env-example) nastavte: GOTRUE_PASSWORD_HIBP_ENABLED=true. Po změně restartujte kontejner auth (gotrue). Bezpečnostní efekt: blokuje top 1B uniklých hesel během signupu i změny hesla.",
    cloudAction:
      "Cloud → Users → Auth Settings → aktivujte „Password HIBP Check\" (Lovable Cloud i připojený Supabase).",
    docsLink: "https://docs.lovable.dev/features/security",
  },
  {
    id: "mfa",
    category: "auth",
    title: "Vícefaktorová autentizace (MFA / TOTP)",
    description:
      "Aplikace pracuje s osobními údaji zaměstnanců (PLP, zdravotní data) – GDPR doporučuje MFA pro administrátorské účty. Supabase nativně podporuje TOTP (Google Authenticator, 1Password atd.).",
    severity: "high",
    selfHostedAction:
      "V docker/.env zapněte: GOTRUE_MFA_ENABLED=true a GOTRUE_MFA_MAX_ENROLLED_FACTORS=2. Implementujte enrollment v Profilu uživatele (volání supabase.auth.mfa.enroll/challenge/verify). Vynuťte alespoň pro role admin/manager.",
    cloudAction: "Cloud → Users → Auth Settings → aktivujte MFA (TOTP).",
  },
  {
    id: "otp-expiry",
    category: "auth",
    title: "Krátká platnost OTP / recovery odkazů",
    description:
      "Výchozí platnost magických odkazů a OTP kódů je často 24 hodin. Pro citlivé aplikace zkraťte na 1 hodinu, aby se snížilo okno pro zneužití zachyceného odkazu.",
    severity: "medium",
    selfHostedAction:
      "V docker/.env: GOTRUE_MAILER_OTP_EXP=3600 (1 h pro reset hesla / magic link). Pro session zvažte JWT_EXPIRY=3600 (default je obvykle vyhovující).",
    cloudAction: "Cloud → Users → Auth Settings → snižte OTP/Recovery expiry na 1 h.",
  },
  {
    id: "disable-signup",
    category: "auth",
    title: "Vypnutí veřejné registrace (DISABLE_SIGNUP)",
    description:
      "Aplikace je interní – nikdo by se neměl registrovat sám. Účty zakládá výhradně administrátor přes Onboarding. Bez tohoto vypnutí může kdokoli s URL aplikace vytvořit účet (i když pak čeká na schválení).",
    severity: "critical",
    selfHostedAction:
      "V docker/.env nastavte DISABLE_SIGNUP=true. Po restartu auth kontejneru jsou registrace přes /auth/v1/signup odmítnuty. Onboarding edge funkce (admin-create-user) toto omezení obchází – funguje dál.",
    cloudAction: "Cloud → Users → Auth Settings → zakažte „Allow new users to sign up\".",
  },
  {
    id: "studio-password",
    category: "secrets",
    title: "Změna výchozího hesla Supabase Studia",
    description:
      "Self-hosted Studio (port 3000 / 8000) chrání pouze basic-auth z DASHBOARD_USERNAME/DASHBOARD_PASSWORD. Výchozí hodnota „this_password_is_insecure_and_should_be_updated\" je veřejně známá.",
    severity: "critical",
    selfHostedAction:
      "V docker/.env změňte DASHBOARD_PASSWORD na silné heslo (min. 24 znaků, openssl rand -base64 24). Ideálně ponechte Studio dostupné jen z VPN / interní sítě (firewall / nginx allow/deny).",
  },
  {
    id: "firewall-ports",
    category: "transport",
    title: "Firewall – nevystavovat interní porty na internet",
    description:
      "Postgres (5432), Studio (3000/8000), Kong (8091), Realtime (4000) NESMÍ být dostupné z veřejného internetu. Útočník by obešel rate-limit i auth a získal přímý přístup k DB.",
    severity: "critical",
    selfHostedAction:
      "ufw allow 22,80,443/tcp; ufw deny 5432,3000,8000,8091,4000 from any. Pokud potřebujete vzdálený přístup k DB pro zálohy, povolte jen z konkrétní IP. Ověřte: nmap -Pn váš.server.cz – mělo by ukázat jen 80/443.",
  },
  {
    id: "audit-retention",
    category: "monitoring",
    title: "Retence audit logu a tabulky reminder_logs",
    description:
      "Tabulky audit_logs, reminder_logs, deadline_reminder_logs, medical_reminder_logs a auth_signin_attempts rostou donekonečna. Po roce mohou mít stovky MB a zpomalovat dotazy. Také obsahují PII (e-maily, IP) – GDPR vyžaduje retenci.",
    severity: "medium",
    selfHostedAction:
      "Vytvořte cron migraci, která maže záznamy starší než N dní (doporučeně 365 dní pro audit, 90 dní pro reminder logy). Příklad: pg_cron job DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '365 days'. Před smazáním exportujte do dlouhodobého archivu (S3, NAS).",
  },
  {
    id: "db-ssl",
    category: "transport",
    title: "TLS mezi PostgREST/GoTrue a PostgreSQL",
    description:
      "Pokud běží PostgREST/GoTrue v jiném kontejneru/hostu než Postgres, hesla a data tečou po síti v plain textu. V docker compose stack na jednom hostu je riziko nízké, při rozdělení vysoké.",
    severity: "medium",
    selfHostedAction:
      "Pokud DB běží mimo localhost, v PostgREST nastavte ?sslmode=require v DB_URI. V Postgres povolte ssl=on s vlastním certifikátem (postgresql.conf). Na jednom hostu (loopback) lze ignorovat.",
  },
  {
    id: "edge-cors",
    category: "auth",
    title: "Restriktivní CORS na edge funkcích",
    description:
      "Edge funkce s Access-Control-Allow-Origin: * mohou být zneužity z cizích webů přes přihlášeného uživatele (CSRF s tokenem v storage). Doporučeno omezit na konkrétní origin produkční domény.",
    severity: "medium",
    selfHostedAction:
      "V supabase/functions/_shared (pokud existuje) nahraďte Access-Control-Allow-Origin: * konkrétní doménou aplikace (např. https://lhutnik.gematex.cz). Pro vývoj použijte env proměnnou. Pozn.: většina Lovable šablon má dnes wildcard – ručně upravte před produkcí.",
  },
  {
    id: "realtime-encryption",
    category: "secrets",
    title: "Realtime šifrovací klíče (DB_ENC_KEY, API_JWT_SECRET)",
    description:
      "Realtime služba má vlastní šifrovací klíče pro broadcast / presence. Při úniku může útočník dešifrovat realtime kanály.",
    severity: "medium",
    selfHostedAction:
      "V docker/.env: DB_ENC_KEY (32 znaků, openssl rand -hex 16) a SECRET_KEY_BASE (64+ znaků). Při rotaci JWT_SECRET rotujte i tyto. Po rotaci restartujte kontejner realtime.",
  },
  {
    id: "container-non-root",
    category: "secrets",
    title: "Kontejnery běží pod neprivilegovaným uživatelem",
    description:
      "Pokud nginx / app kontejner běží pod root, escape z kontejneru = root na hostu. Standardní docker images supabase už neprivilegovaného uživatele používají, vlastní (frontend Dockerfile) ale nemusí.",
    severity: "medium",
    selfHostedAction:
      "V Dockerfile přidejte před CMD: RUN adduser -D appuser && chown -R appuser /usr/share/nginx/html && USER appuser. Nikdy nemontujte /var/run/docker.sock do kontejneru aplikace.",
  },
  {
    id: "session-timeout",
    category: "auth",
    title: "Auto-logout po nečinnosti (session timeout)",
    description:
      "Aplikace má vestavěný hook useSessionTimeout, který odhlásí uživatele po nastavené době nečinnosti. Důležité pro sdílené stanice (kanceláře, výroba).",
    severity: "medium",
    selfHostedAction:
      "V Administrace → Bezpečnost → Session timeout nastavte rozumnou hodnotu (typicky 30–60 min). Hodnota se ukládá do system_settings.session_timeout. Doporučeno kratší pro admin role.",
  },
],

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

export default function SecurityChecklist() {
  const { state, toggle } = useSecurityChecklistState();
  const checked = state.items;

  const totalCritical = useMemo(
    () => CHECKLIST.filter((i) => i.severity === "critical").length,
    [],
  );
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
        description="Sdílený kontrolní seznam pro bezpečné nasazení aplikace na produkční doménu (self-hosted i cloud)."
        actions={<HelpButton section="admin-bezpecnost" label="Co je tento checklist a jak ho používat" />}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p>
                <strong>K čemu slouží:</strong> Checklist je seznam doporučených bezpečnostních
                opatření, která je potřeba ručně ověřit nebo nastavit mimo aplikaci
                (na úrovni serveru, reverse-proxy, SMTP, záloh apod.).
                Aplikace tyto úkony technicky nevynucuje – musíte je provést sami.
              </p>
              <p>
                <strong>Jak se ukládá:</strong> Zaškrtnutí jednotlivých položek se ukládá do
                databáze (klíč <code>security_checklist_state</code>) a je <strong>sdíleno mezi
                všemi administrátory</strong> – kolega vidí stejný stav jako vy. Ukládá se i čas
                a kdo položku naposledy změnil (audit dohledatelný v audit logu).
              </p>
              {state.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Naposledy upravil: <strong>{state.updated_by ?? "—"}</strong> ·{" "}
                  {formatDisplayDateTime(state.updated_at)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
