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

---

## 🔧 Instalace pro administrátory serveru

Tato sekce obsahuje kompletní pokyny pro nasazení aplikace na produkční server.

### 1. Požadavky na server

| Komponenta | Požadavek |
|------------|-----------|
| **OS** | Linux (Ubuntu 22.04+, Debian 11+, CentOS 8+) |
| **Docker** | 24.0+ |
| **Docker Compose** | 2.20+ |
| **RAM** | Min. 2 GB |
| **Disk** | Min. 10 GB |
| **Síť** | Veřejná IP nebo doménové jméno |
| **Porty** | 80 (HTTP), 443 (HTTPS) |

### 2. Instalace Dockeru

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Odhlaste se a přihlaste znovu, nebo:
newgrp docker

# Ověření instalace
docker --version
docker-compose --version
```

### 3. Příprava projektu

```bash
# Klonování repozitáře
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Vytvoření .env souboru
cp docker/.env.example .env
nano .env  # nebo vim/vi
```

### 4. Konfigurace prostředí

Upravte soubor `.env`:

```env
# ============================================
# SUPABASE / LOVABLE CLOUD
# ============================================
VITE_SUPABASE_URL=https://xgtwutpbojltmktprdui.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=xgtwutpbojltmktprdui

# ============================================
# CRON ZABEZPEČENÍ
# ============================================
# Vygenerujte: openssl rand -hex 32
CRON_SECRET=your-generated-secret-key
```

### 5. Build a spuštění

```bash
# Build a spuštění (na pozadí)
docker-compose up -d --build

# Sledování logů
docker-compose logs -f frontend

# Ověření běhu
docker ps
curl http://localhost:80
```

### 6. Konfigurace CRON úloh

Otevřete crontab: `crontab -e`

```bash
# Připomínky - každou hodinu
0 * * * * curl -s -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/send-training-reminders" -H "x-cron-secret: $CRON_SECRET" >> /var/log/reminders.log 2>&1
5 * * * * curl -s -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/run-deadline-reminders" -H "x-cron-secret: $CRON_SECRET" >> /var/log/reminders.log 2>&1
10 * * * * curl -s -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/run-medical-reminders" -H "x-cron-secret: $CRON_SECRET" >> /var/log/reminders.log 2>&1
```

### 7. Nastavení HTTPS (volitelné)

Pro produkční nasazení doporučujeme použít reverse proxy s SSL:

```bash
# Instalace Certbot pro Let's Encrypt
sudo apt install certbot python3-certbot-nginx

# Získání certifikátu
sudo certbot --nginx -d vasedomena.cz
```

### 8. První přihlášení

**Varianta A: Automatická inicializace (doporučeno)**

1. Otevřete aplikaci v prohlížeči: `http://vasedomena.cz`
2. Zavolejte Edge funkci `seed-initial-admin` pro vytvoření prvního admin účtu:

```bash
curl -X POST "https://YOUR_SUPABASE_URL/functions/v1/seed-initial-admin" \
  -H "Content-Type: application/json"
```

3. Přihlaste se s výchozími údaji:
   - **Email**: `admin@system.local`
   - **Heslo**: `admin123`
4. **IHNED změňte heslo** v profilu uživatele!

**Varianta B: Samoregistrace prvního uživatele**

1. Otevřete aplikaci a zaregistrujte se jako první uživatel
2. Databázový trigger automaticky přidělí roli `admin` a schválí profil

### 9. Po přihlášení

1. V administraci nakonfigurujte **SMTP server** pro odesílání emailů (Administrace → Nastavení → E-mail)
2. Otestujte SMTP konfiguraci odesláním testovacího emailu
3. Nastavte `X_CRON_SECRET` v Lovable Cloud (sekce Secrets)
4. Ověřte funkci CRON úloh manuálním testem

### 10. Checklist po instalaci

- [ ] Docker kontejner běží (`docker ps`)
- [ ] Aplikace je dostupná v prohlížeči
- [ ] První admin uživatel vytvořen (a heslo změněno!)
- [ ] SMTP nakonfigurován a otestován (Administrace → Nastavení → E-mail)
- [ ] CRON úlohy nastaveny (3 endpointy každou hodinu)
- [ ] X_CRON_SECRET synchronizován s Lovable Cloud
- [ ] SSL certifikát nainstalován (produkce)
- [ ] Zálohovací strategie nastavena

---

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

### Dva režimy nasazení

| Režim | Docker Compose soubor | Popis |
|-------|----------------------|-------|
| **A) Jednoduchý** | `docker-compose.yml` | Frontend + standalone PostgreSQL (připojení k externímu Supabase/Lovable Cloud) |
| **B) Self-hosted Supabase** | `docker-compose.supabase.yml` | Frontend + **kompletní Supabase stack** (vše na jednom serveru) |

---

### Režim A: Jednoduchý (Frontend + externí Supabase)

```bash
cp docker/.env.example .env
nano .env  # vyplňte VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY

docker-compose up -d --build
docker-compose logs -f frontend
```

---

### Režim B: Self-hosted Supabase (kompletní stack)

Tento režim spustí **kompletní Supabase infrastrukturu** na vašem serveru:

| Služba | Image | Port | Popis |
|--------|-------|------|-------|
| **Frontend** | Custom (Nginx) | 80 | React aplikace |
| **Kong** | kong:2.8.1 | 8000 | API Gateway |
| **GoTrue** | supabase/gotrue:v2.185.0 | - | Autentizace |
| **PostgREST** | postgrest/postgrest:v14.3 | - | REST API |
| **Realtime** | supabase/realtime:v2.72.0 | - | WebSocket subscriptions |
| **Storage** | supabase/storage-api:v1.37.1 | - | Úložiště souborů |
| **Edge Functions** | supabase/edge-runtime:v1.70.0 | - | Serverless funkce (Deno) |
| **Studio** | supabase/studio | 8000 (via Kong) | Administrační dashboard |
| **PostgreSQL** | supabase/postgres:15.8.1.085 | 5432 | Databáze |
| **Analytics** | supabase/logflare:1.30.3 | 4000 | Logování |
| **ImgProxy** | darthsim/imgproxy:v3.30.1 | - | Transformace obrázků |
| **Meta** | supabase/postgres-meta:v0.95.2 | - | DB metadata API |
| **Vector** | timberio/vector:0.28.1 | - | Log pipeline |
| **Supavisor** | supabase/supavisor:2.7.4 | 6543 | Connection pooler |
| **CRON** | alpine:3.19 | - | Automatické připomínky |

#### Požadavky na server

| Komponenta | Požadavek |
|------------|-----------|
| **RAM** | Min. **4 GB** (doporučeno 8 GB) |
| **Disk** | Min. 20 GB |
| **CPU** | Min. 2 jádra |
| **Docker** | 24.0+ |
| **Docker Compose** | 2.20+ |

#### Krok 1: Příprava prostředí

```bash
# Klonování repozitáře
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Vytvoření .env souboru
cp docker/.env.example .env
```

#### Krok 2: Generování bezpečnostních klíčů

```bash
# JWT Secret (POVINNÉ - změňte!)
echo "JWT_SECRET=$(openssl rand -base64 32)"

# Heslo databáze
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"

# Dashboard heslo
echo "DASHBOARD_PASSWORD=$(openssl rand -hex 16)"

# Šifrovací klíče
echo "SECRET_KEY_BASE=$(openssl rand -base64 48)"
echo "VAULT_ENC_KEY=$(openssl rand -hex 16)"
echo "PG_META_CRYPTO_KEY=$(openssl rand -hex 16)"

# Logflare tokeny
echo "LOGFLARE_PUBLIC_ACCESS_TOKEN=$(openssl rand -hex 32)"
echo "LOGFLARE_PRIVATE_ACCESS_TOKEN=$(openssl rand -hex 32)"

# CRON secret
echo "X_CRON_SECRET=$(openssl rand -hex 32)"
```

**DŮLEŽITÉ**: Po vygenerování zapište hodnoty do `.env` souboru!

#### Krok 3: Generování JWT klíčů (ANON_KEY, SERVICE_ROLE_KEY)

Pro produkční nasazení musíte vygenerovat vlastní JWT klíče s vaším `JWT_SECRET`.

Použijte online nástroj: https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys

Nebo vygenerujte pomocí Node.js:
```bash
# ANON_KEY
node -e "
const jwt = require('jsonwebtoken');
const payload = { role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + (10*365*24*60*60) };
console.log(jwt.sign(payload, process.env.JWT_SECRET));
"

# SERVICE_ROLE_KEY
node -e "
const jwt = require('jsonwebtoken');
const payload = { role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + (10*365*24*60*60) };
console.log(jwt.sign(payload, process.env.JWT_SECRET));
"
```

#### Krok 4: Konfigurace .env

Upravte soubor `.env` a nastavte zejména:

```env
# Bezpečnost (POVINNÉ)
POSTGRES_PASSWORD=<vygenerované-heslo>
JWT_SECRET=<vygenerovaný-jwt-secret>
ANON_KEY=<vygenerovaný-anon-key>
SERVICE_ROLE_KEY=<vygenerovaný-service-role-key>
DASHBOARD_PASSWORD=<silné-heslo>

# URL vaší aplikace
SITE_URL=http://vasedomena.cz
SITE_DOMAIN=vasedomena.cz
API_EXTERNAL_URL=http://vasedomena.cz:8000
SUPABASE_PUBLIC_URL=http://vasedomena.cz:8000

# SMTP pro autentizační emaily (potvrzení, reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=vas@email.cz
SMTP_PASS=app-password
SMTP_SENDER_NAME=Training System

# SMTP pro připomínky (edge funkce)
SMTP_FROM=noreply@vasedomena.cz
```

#### Krok 5: Spuštění

```bash
# Build a spuštění všech služeb
docker compose -f docker-compose.supabase.yml up -d --build

# Sledování logů
docker compose -f docker-compose.supabase.yml logs -f

# Kontrola stavu
docker compose -f docker-compose.supabase.yml ps
```

#### Krok 6: První přihlášení

1. Otevřete aplikaci: `http://vasedomena.cz`
2. **Zaregistrujte se** jako první uživatel → automaticky dostanete roli **Admin**
3. Nebo použijte `seed-initial-admin`:

```bash
curl -X POST "http://localhost:8000/functions/v1/seed-initial-admin" \
  -H "Content-Type: application/json"
# Přihlášení: admin@system.local / admin123
```

4. V Administraci → Nastavení → E-mail nakonfigurujte SMTP
5. Otestujte odeslání testovacího emailu

#### Supabase Studio Dashboard

Studio je dostupné na: `http://vasedomena.cz:8000`

Přihlašovací údaje: viz `DASHBOARD_USERNAME` a `DASHBOARD_PASSWORD` v `.env`

#### CRON připomínky

V režimu B je CRON kontejner **integrován přímo v Docker Compose**. Připomínky se spouštějí automaticky každou hodinu:

| Čas | Modul | Edge funkce |
|-----|-------|-------------|
| :00 | Školení | `send-training-reminders` |
| :05 | Technické události | `run-deadline-reminders` |
| :10 | PLP prohlídky | `run-medical-reminders` |

Není potřeba nastavovat externí crontab!

#### Docker příkazy (Režim B)

| Příkaz | Popis |
|--------|-------|
| `docker compose -f docker-compose.supabase.yml up -d` | Spustit na pozadí |
| `docker compose -f docker-compose.supabase.yml down` | Zastavit |
| `docker compose -f docker-compose.supabase.yml down -v` | Zastavit + smazat data |
| `docker compose -f docker-compose.supabase.yml logs -f kong` | Logy Kong gateway |
| `docker compose -f docker-compose.supabase.yml logs -f auth` | Logy autentizace |
| `docker compose -f docker-compose.supabase.yml logs -f functions` | Logy edge funkcí |
| `docker compose -f docker-compose.supabase.yml logs -f db` | Logy databáze |
| `docker compose -f docker-compose.supabase.yml restart functions` | Restart edge funkcí |
| `docker compose -f docker-compose.supabase.yml ps` | Stav všech služeb |

### Docker příkazy (Režim A)

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

---

## 💾 Zálohování databáze

### Automatické zálohy (Lovable Cloud)

Lovable Cloud automaticky provádí denní zálohy databáze s retencí 7 dní. Pro přístup k zálohám kontaktujte podporu Lovable.

### Manuální export dat

#### Export přes SQL (doporučeno)

V Lovable Cloud → Run SQL můžete exportovat data do CSV:

```sql
-- Export školení
COPY (SELECT * FROM trainings WHERE deleted_at IS NULL) TO STDOUT WITH CSV HEADER;

-- Export zaměstnanců
COPY (SELECT * FROM employees) TO STDOUT WITH CSV HEADER;

-- Export technických událostí
COPY (SELECT * FROM deadlines WHERE deleted_at IS NULL) TO STDOUT WITH CSV HEADER;

-- Export lékařských prohlídek
COPY (SELECT * FROM medical_examinations WHERE deleted_at IS NULL) TO STDOUT WITH CSV HEADER;
```

#### Export přes pg_dump (pro administrátory)

Pokud máte přímý přístup k databázi:

```bash
# Kompletní záloha
pg_dump -h db.xgtwutpbojltmktprdui.supabase.co -U postgres -d postgres \
  --no-owner --no-privileges \
  -f backup_$(date +%Y%m%d_%H%M%S).sql

# Pouze data (bez struktury)
pg_dump -h db.xgtwutpbojltmktprdui.supabase.co -U postgres -d postgres \
  --data-only --no-owner \
  -f data_backup_$(date +%Y%m%d_%H%M%S).sql

# Komprimovaná záloha
pg_dump -h db.xgtwutpbojltmktprdui.supabase.co -U postgres -d postgres \
  --no-owner --no-privileges \
  | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Zálohovací skript

Vytvořte `/opt/scripts/backup-db.sh`:

```bash
#!/bin/bash
# ============================================
# Automatické zálohování databáze
# ============================================

# Konfigurace
DB_HOST="db.xgtwutpbojltmktprdui.supabase.co"
DB_USER="postgres"
DB_NAME="postgres"
BACKUP_DIR="/var/backups/training-system"
RETENTION_DAYS=30

# Vytvoření adresáře
mkdir -p $BACKUP_DIR

# Název souboru
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Záloha
echo "[$(date)] Spouštím zálohu..."
PGPASSWORD="$DB_PASSWORD" pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME \
  --no-owner --no-privileges \
  | gzip > $BACKUP_FILE

# Kontrola úspěchu
if [ $? -eq 0 ]; then
  echo "[$(date)] Záloha úspěšně vytvořena: $BACKUP_FILE"
  echo "[$(date)] Velikost: $(du -h $BACKUP_FILE | cut -f1)"
else
  echo "[$(date)] CHYBA: Záloha selhala!"
  exit 1
fi

# Mazání starých záloh
echo "[$(date)] Mažu zálohy starší než $RETENTION_DAYS dní..."
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Hotovo"
```

### Nastavení automatického zálohování

```bash
# Oprávnění
chmod +x /opt/scripts/backup-db.sh

# Crontab - záloha každý den ve 3:00
echo "0 3 * * * DB_PASSWORD='your-db-password' /opt/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1" | crontab -

# Nebo pro týdenní zálohy (neděle 3:00)
echo "0 3 * * 0 DB_PASSWORD='your-db-password' /opt/scripts/backup-db.sh >> /var/log/db-backup.log 2>&1" | crontab -
```

### Obnova ze zálohy

```bash
# Rozbalení
gunzip backup_20250208_030000.sql.gz

# Obnova
PGPASSWORD="your-password" psql -h db.xgtwutpbojltmktprdui.supabase.co \
  -U postgres -d postgres < backup_20250208_030000.sql
```

### Záloha souborů (Storage)

Dokumenty ze Storage se zálohují samostatně:

```bash
# Seznam bucketů
# - training-documents
# - deadline-documents  
# - medical-documents

# Pro zálohu Storage kontaktujte podporu Lovable
# nebo použijte Supabase CLI (pokud je dostupné)
```

### Doporučená strategie zálohování

| Typ zálohy | Frekvence | Retence | Úložiště |
|------------|-----------|---------|----------|
| **Denní** | Každý den 3:00 | 7 dní | Lokální server |
| **Týdenní** | Neděle 3:00 | 4 týdny | Vzdálené úložiště (S3, GCS) |
| **Měsíční** | 1. den měsíce | 12 měsíců | Archiv (offline) |

---

## 🏥 Health Checks a Monitoring

### Docker health check

Docker-compose automaticky monitoruje zdraví kontejneru:

```bash
# Kontrola stavu
docker ps --format "table {{.Names}}\t{{.Status}}"

# Výstup:
# NAMES              STATUS
# training-frontend  Up 2 hours (healthy)
```

### Manuální health check

```bash
# HTTP status
curl -i http://localhost:80/

# Očekávaná odpověď: HTTP 200 OK

# Ověření datové základny (přihlášení admin účtem)
curl -X POST http://localhost:80/api/health
```

### Monitoring aplikace

Doporučujeme nastavit monitoring:

```bash
# Kontrola logů v reálném čase
docker-compose logs -f frontend

# Kontrola konkrétní chyby
docker-compose logs frontend | grep "ERROR"

# Sledování výkonu
docker stats training-frontend
```

---

## 📊 Logování a Audit

### Aplikační logy

Všechny změny jsou zaznamenány v tabulce `audit_logs`:

```sql
-- Posledních 100 změn
SELECT 
  created_at, 
  user_email, 
  action, 
  table_name, 
  changed_fields 
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 100;
```

### Docker logy

```bash
# Posledních 100 řádků
docker-compose logs --tail=100 frontend

# Sledování v reálném čase
docker-compose logs -f frontend

# Logy od určitého času
docker-compose logs --since 1h frontend

# Export logů do souboru
docker-compose logs frontend > app_logs_$(date +%Y%m%d).txt
```

### CRON a připomínky logy

```bash
# Školení
tail -f /var/log/training-reminders.log

# Technické události
tail -f /var/log/deadline-reminders.log

# Lékařské prohlídky
tail -f /var/log/medical-reminders.log

# Databázové zálohy
tail -f /var/log/db-backup.log
```

### Archivování logů

```bash
# Ročně archivujte staré logy
find /var/log/reminders -name "*.log" -mtime +30 -exec gzip {} \;
find /var/log/reminders -name "*.log.gz" -mtime +90 -delete
```

---

## 🔧 Troubleshooting

### Problém: Aplikace se nenačítá

```bash
# Kontrola běhu kontejneru
docker ps | grep training-frontend

# Pokud neběží, spusťte
docker-compose up -d --build

# Kontrola logů
docker-compose logs frontend | tail -50

# Ověření portu
netstat -tlnp | grep :80
```

### Problém: Chyba připojení k databázi

```bash
# Ověření ENV proměnných
grep VITE_SUPABASE .env

# Kontrola síťového spojení
curl -i https://xgtwutpbojltmktprdui.supabase.co

# Zkontrolujte firewall
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Problém: CRON úlohy se nespouštějí

```bash
# Kontrola crontab
crontab -l

# Kontrola logů cron
grep CRON /var/log/syslog | tail -20

# Ověření CRON_SECRET
# V docker-compose.yml nebo .env

# Manuální test připomínky
curl -X POST "https://xgtwutpbojltmktprdui.supabase.co/functions/v1/send-training-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"triggered_by":"test"}'
```

### Problém: Nedostatek místa na disku

```bash
# Kontrola místa
df -h

# Clearing Docker resources
docker-compose down
docker system prune -a --volumes

# Kontrola logů
du -sh /var/log/*
```

### Problém: Vysoké využití paměti

```bash
# Kontrola spotřeby
docker stats training-frontend

# Restart kontejneru
docker-compose restart frontend

# Zvýšení limitu v docker-compose.yml
# services:
#   frontend:
#     deploy:
#       resources:
#         limits:
#           memory: 1G
```

---

## 🔄 Aktualizace aplikace

### Postup aktualizace

```bash
# 1. Zastavení a backup
docker-compose down
/opt/scripts/backup-db.sh

# 2. Aktualizace kódu
git fetch origin
git checkout main  # nebo master
git pull

# 3. Rebuild a spuštění
docker-compose up -d --build

# 4. Kontrola logů
docker-compose logs -f frontend

# 5. Ověření funkce
curl http://localhost:80/
```

### Zero-downtime update (volitelné)

```bash
# 1. Build nového image
docker build -t training-frontend:new .

# 2. Spustit nový kontejner na jiném portu
docker run -d -p 8080:80 --name training-frontend-new training-frontend:new

# 3. Test nové verze
curl http://localhost:8080/

# 4. Přepnutí v nginx (pokud používáte reverse proxy)
# Aktualizujte nginx config a reload

# 5. Zastavení starého kontejneru
docker stop training-frontend
docker rename training-frontend training-frontend-old

# 6. Přejmenování nového
docker rename training-frontend-new training-frontend

# 7. Smazání starého
docker rm training-frontend-old
```

### Rollback při chybě

```bash
# 1. Zastavení nové verze
docker-compose down

# 2. Checkout předchozí verze
git checkout HEAD~1

# 3. Spuštění staré verze
docker-compose up -d --build

# 4. Obnova databáze z poslední zálohy (pokud potřeba)
PGPASSWORD="$DB_PASSWORD" psql -h db.xgtwutpbojltmktprdui.supabase.co \
  -U postgres -d postgres < /var/backups/training-system/latest_backup.sql
```

---

## 🛡️ Bezpečnostní tipy

### Firewall konfigurace

```bash
# UFW (Ubuntu)
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
```

### SSH bezpečnost

```bash
# Deaktivujte root login
sudo sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Zmeňte default port (volitelné)
sudo sed -i 's/#Port 22/Port 2222/' /etc/ssh/sshd_config

# Restart SSH
sudo systemctl restart sshd
```

### Tajné klíče (CRON_SECRET)

```bash
# NIKDY nesdílejte v Plain textu
# Udržujte v .env souboru mimo git
# Změňte během setup jednou za měsíc

# Generování nového klíče
NEW_SECRET=$(openssl rand -hex 32)
echo "Nový CRON_SECRET: $NEW_SECRET"
# Pak aktualizujte v .env a Lovable Cloud
```

---

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
│   │   ├── send-training-reminders/  # Připomínky školení (SMTP)
│   │   ├── run-reminders/            # Sumární připomínky školení (SMTP)
│   │   ├── run-deadline-reminders/   # Připomínky technických událostí (SMTP)
│   │   ├── run-medical-reminders/    # Připomínky lékařských prohlídek (SMTP)
│   │   ├── send-test-email/          # Testovací SMTP email
│   │   ├── seed-initial-admin/       # Inicializace prvního admina
│   │   ├── admin-create-user/        # Vytvoření uživatele (admin)
│   │   ├── admin-reset-password/     # Reset hesla (admin)
│   │   ├── admin-change-email/       # Změna emailu (admin)
│   │   ├── admin-deactivate-user/    # Deaktivace uživatele (admin)
│   │   ├── admin-delete-user/        # Smazání uživatele (admin)
│   │   ├── admin-link-employee/      # Propojení profilu se zaměstnancem
│   │   └── list-users/               # Seznam uživatelů
│   └── migrations/     # DB migrace (inkrementální aktualizace schématu)
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
