# Systém správy školení, technických lhůt a lékařských prohlídek

Webová aplikace pro evidenci školení zaměstnanců, technických lhůt zařízení a pracovně-lékařských prohlídek s automatickým systémem připomínek.

## 📋 Moduly

| Modul | Popis |
|-------|-------|
| **Školení** | Evidence školení zaměstnanců s automatickým výpočtem expirací |
| **Technické události** | Evidence technických kontrol, revizí a lhůt zařízení |
| **PLP (Prohlídky)** | Pracovně-lékařské prohlídky zaměstnanců |
| **Zaměstnanci** | Hierarchie nadřízených, oddělení, statusy |
| **Zařízení** | Evidence inventáře s přiřazením odpovědných osob |
| **Audit log** | Kompletní historie změn |

## 🛠️ Technologie

### Frontend
| Technologie | Verze | Účel |
|-------------|-------|------|
| React | 18.3 | UI framework |
| TypeScript | - | Typový systém |
| Vite | - | Build tool & dev server |
| Tailwind CSS | - | Utility-first CSS |
| shadcn/ui | - | Komponenty (Radix UI) |
| React Router | 6.30 | Routing |
| TanStack Query | 5.83 | Data fetching & caching |
| React Hook Form | 7.61 | Formuláře |
| Zod | 3.25 | Validace schémat |
| Recharts | 2.15 | Grafy a vizualizace |
| date-fns | 3.6 | Práce s datumy |

### Backend (Lovable Cloud / Supabase)
| Technologie | Účel |
|-------------|------|
| PostgreSQL 15 | Databáze |
| Supabase Auth | Autentizace (JWT) |
| Supabase Storage | Úložiště souborů |
| Edge Functions (Deno) | Serverless funkce |
| Row Level Security | Bezpečnostní politiky |
| pg_cron + pg_net | Plánované úlohy |

### E-mail
- **Protokol**: Nativní SMTP (Deno implementace)
- **Konfigurace**: Host, port, TLS/STARTTLS, autentizace
- **Šablony**: HTML s proměnnými

## 🚀 Lokální vývoj

### Požadavky

- Node.js 20+
- npm nebo bun

### Instalace

```bash
# Klonovat repozitář
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Instalace závislostí
npm install

# Spuštění vývojového serveru
npm run dev

# Produkční build
npm run build

# Náhled produkčního buildu
npm run preview
```

### Proměnné prostředí

Aplikace vyžaduje následující proměnné:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

## 🐳 Docker nasazení

### Rychlý start

```bash
# Build a spuštění
docker-compose up -d --build

# Sledování logů
docker-compose logs -f frontend

# Zastavení
docker-compose down
```

### Konfigurace

1. **Vytvořte `.env` soubor** v kořenovém adresáři:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

2. **Build a spuštění**:

```bash
docker build -t training-frontend \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
  --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
  .

docker run -d -p 80:80 --name training-frontend training-frontend
```

### Docker příkazy

| Příkaz | Popis |
|--------|-------|
| `docker-compose up -d` | Spustit na pozadí |
| `docker-compose down` | Zastavit a odstranit |
| `docker-compose logs -f` | Sledovat logy |
| `docker-compose build --no-cache` | Přestavět bez cache |
| `docker-compose restart frontend` | Restartovat frontend |

## ⏰ Automatické připomínky (CRON)

### Edge funkce

| Funkce | Modul | Endpoint |
|--------|-------|----------|
| `send-training-reminders` | Školení | `/functions/v1/send-training-reminders` |
| `run-deadline-reminders` | Technické události | `/functions/v1/run-deadline-reminders` |
| `run-medical-reminders` | PLP Prohlídky | `/functions/v1/run-medical-reminders` |

### Linux Crontab (každou hodinu)

Otevřete crontab: `crontab -e` a přidejte:

```bash
# ============================================
# PŘIPOMÍNKY - KAŽDOU HODINU
# ============================================

# Školení - každou hodinu v :00
0 * * * * curl -s -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/send-training-reminders" -H "Content-Type: application/json" -H "x-cron-secret: VAS_TAJNY_KLIC" >> /var/log/training-reminders.log 2>&1

# Technické události - každou hodinu v :05
5 * * * * curl -s -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/run-deadline-reminders" -H "Content-Type: application/json" -H "x-cron-secret: VAS_TAJNY_KLIC" >> /var/log/deadline-reminders.log 2>&1

# PLP prohlídky - každou hodinu v :10
10 * * * * curl -s -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/run-medical-reminders" -H "Content-Type: application/json" -H "x-cron-secret: VAS_TAJNY_KLIC" >> /var/log/medical-reminders.log 2>&1
```

### Bash skript (alternativa)

Vytvořte `/opt/scripts/run-reminders.sh`:

```bash
#!/bin/bash
# ============================================
# Skript pro spouštění připomínek
# ============================================

CRON_SECRET="VAS_TAJNY_KLIC"
BASE_URL="https://xgtwutpbojltmktprdui.supabase.co/functions/v1"
LOG_DIR="/var/log/reminders"

mkdir -p $LOG_DIR

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Spouštím připomínky..." >> $LOG_DIR/cron.log

# Školení
echo "[$(date '+%Y-%m-%d %H:%M:%S')] -> Školení" >> $LOG_DIR/cron.log
curl -s -X POST "$BASE_URL/send-training-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  >> $LOG_DIR/training.log 2>&1

# Technické události
echo "[$(date '+%Y-%m-%d %H:%M:%S')] -> Technické události" >> $LOG_DIR/cron.log
curl -s -X POST "$BASE_URL/run-deadline-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  >> $LOG_DIR/deadline.log 2>&1

# PLP prohlídky
echo "[$(date '+%Y-%m-%d %H:%M:%S')] -> PLP prohlídky" >> $LOG_DIR/cron.log
curl -s -X POST "$BASE_URL/run-medical-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  >> $LOG_DIR/medical.log 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Hotovo" >> $LOG_DIR/cron.log
```

Nastavte oprávnění a přidejte do crontab:

```bash
chmod +x /opt/scripts/run-reminders.sh

# V crontab
0 * * * * /opt/scripts/run-reminders.sh
```

### CRON syntaxe

| Vzor | Význam |
|------|--------|
| `0 * * * *` | Každou hodinu v :00 |
| `*/30 * * * *` | Každých 30 minut |
| `0 8 * * *` | Každý den v 8:00 |
| `0 8 * * 1` | Každé pondělí v 8:00 |
| `0 8 1 * *` | 1. den v měsíci v 8:00 |

### Vygenerování tajného klíče

```bash
# Vygenerovat silný klíč
openssl rand -hex 32

# Výstup např.: a1b2c3d4e5f6...
```

Tento klíč nastavte jako CRON_SECRET v Lovable Cloud.

### Testování

```bash
# Manuální test
curl -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/send-training-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: VAS_TAJNY_KLIC"
```

### Parametry edge funkcí

```json
{
  "triggered_by": "cron",
  "test_mode": false,
  "force": false
}
```

| Parametr | Popis |
|----------|-------|
| `triggered_by` | Identifikace spouštěče (cron, manual, test) |
| `test_mode` | Přidá [TEST] prefix k emailům |
| `force` | Obejde časovou kontrolu |

## 📧 SMTP Konfigurace

V administraci (Nastavení → E-mail) nastavte:

| Parametr | Popis | Příklad |
|----------|-------|---------|
| **SMTP Host** | Adresa SMTP serveru | `smtp.gmail.com` |
| **Port** | Port serveru | `587` (STARTTLS) nebo `465` (SMTPS) |
| **Uživatel** | Přihlašovací jméno | `vas@email.cz` |
| **Heslo** | Heslo nebo app password | `xxxx xxxx xxxx xxxx` |
| **Odesílatel** | Email a jméno odesílatele | `noreply@firma.cz` |
| **Zabezpečení** | Typ šifrování | STARTTLS / SMTPS / None |

### Gmail specifika

Pro Gmail vytvořte [aplikační heslo](https://support.google.com/accounts/answer/185833):

1. Přejděte na Nastavení účtu Google → Zabezpečení
2. Zapněte 2FA (pokud není)
3. Vytvořte "Heslo aplikace" pro Mail

## 🔐 Logika expirace a připomínek

### Výpočet stavu

Všechny moduly používají identickou logiku:

```
EXPIRED (🔴)  = next_date < DNES
WARNING (🟠) = next_date <= DNES + 30 dnů
VALID (🟢)   = next_date > DNES + 30 dnů
```

### Logika odesílání

Připomínka se odešle když:
```
next_date - remind_days_before <= DNES
```

Parametry na každém záznamu:
- **remind_days_before** (výchozí 30) — kolik dní před expirací upozornit
- **repeat_days_after** (výchozí 30) — interval opakování

## 🔒 Bezpečnost

- **RLS politiky** na všech tabulkách
- **Role**: admin, manager, user, viewer
- **Moduly**: trainings, deadlines, plp
- **JWT verifikace** v Edge funkcích
- **x-cron-secret** pro automatizaci

## 📁 Struktura projektu

```
├── src/
│   ├── components/     # React komponenty
│   ├── contexts/       # React contexts (Auth, AppMode)
│   ├── hooks/          # Custom hooks
│   ├── pages/          # Stránky aplikace
│   ├── lib/            # Utility funkce
│   └── integrations/   # Supabase client a typy
├── supabase/
│   ├── functions/      # Edge funkce
│   │   ├── send-training-reminders/
│   │   ├── run-deadline-reminders/
│   │   ├── run-medical-reminders/
│   │   ├── send-test-email/
│   │   ├── admin-create-user/
│   │   ├── admin-reset-password/
│   │   ├── admin-change-email/
│   │   ├── admin-deactivate-user/
│   │   ├── admin-link-employee/
│   │   └── list-users/
│   └── migrations/     # DB migrace
├── docker/
│   └── .env.example    # Příklad ENV proměnných
├── Dockerfile          # Frontend Docker image
├── Dockerfile.db       # PostgreSQL Docker image
├── docker-compose.yml  # Docker orchestrace
└── nginx.conf          # Nginx konfigurace
```

## 📚 Další zdroje

- [Lovable Docs](https://docs.lovable.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

## 📄 Licence

Proprietární software - všechna práva vyhrazena.
