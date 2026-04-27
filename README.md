# Lhůtník — Systém správy školení, technických lhůt a lékařských prohlídek

Webová aplikace **Lhůtník** pro evidenci školení zaměstnanců, technických lhůt zařízení a pracovně-lékařských prohlídek (PLP) s automatickým systémem připomínek a kompletním auditem.

## 📋 Moduly

| Modul | Popis |
|-------|-------|
| **Dashboard** | Souhrnný přehled klíčových ukazatelů a blížících se expirací |
| **Školení** | Evidence školení zaměstnanců s automatickým výpočtem expirací a verzováním |
| **Technické události** | Evidence technických kontrol, revizí a lhůt zařízení |
| **PLP (Prohlídky)** | Pracovně-lékařské prohlídky vč. zdravotních rizik |
| **Zaměstnanci** | Hierarchie nadřízených, oddělení, statusy, věkové milníky |
| **Neaktivní zaměstnanci** | Přehled MD/RD, nemocenské, ukončených pracovních poměrů |
| **Zkušební doby** | Sledování zkušebních dob a jejich překážek |
| **Zařízení** | Evidence inventáře s přiřazením odpovědných osob |
| **Provozovny / Oddělení** | Organizační struktura |
| **Skupiny odpovědných osob** | Sdílené příjemci připomínek napříč moduly |
| **Dokumenty** | Sdílené firemní dokumenty organizované do složek |
| **Statistiky** | Reporty a grafy napříč moduly |
| **Historie** | Soft-deleted záznamy s možností obnovení nebo trvalého smazání |
| **Audit log** | Kompletní historie změn (Basic / Advanced / RLS Diagnostics) |
| **Administrace** | Uživatelé, role, moduly, SMTP, šablony připomínek, bezpečnost |

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
| Supabase Auth (GoTrue) | Autentizace (JWT) |
| Supabase Storage | Úložiště dokumentů (3 buckety) |
| Edge Functions (Deno) | Serverless funkce |
| Row Level Security | Granulární bezpečnostní politiky |
| pg_cron + pg_net | Plánované úlohy (retention, cleanup) |

### E-mail
- **Protokol**: Nativní SMTP (Deno implementace) — STARTTLS, SMTPS i M365/Gmail OAuth2
- **Konfigurace**: V administraci (Administrace → Nastavení → E-mail)
- **Šablony**: Plně editovatelné HTML/text šablony s proměnnými ({{employeeName}}, {{trainingType}}, {{expiryDate}} …) a živým náhledem

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
VITE_SUPABASE_URL=https://YOUR_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id

# ============================================
# CRON ZABEZPEČENÍ
# ============================================
# Vygenerujte: openssl rand -hex 32
# Edge funkce akceptují hlavičku x-cron-secret
# a kontrolují proměnnou X_CRON_SECRET (i fallback CRON_SECRET)
X_CRON_SECRET=your-generated-secret-key
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
# Připomínky - každou hodinu (4 edge funkce)
0 * * * * curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/send-training-reminders" -H "x-cron-secret: $X_CRON_SECRET" >> /var/log/reminders.log 2>&1
5 * * * * curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/run-deadline-reminders" -H "x-cron-secret: $X_CRON_SECRET" >> /var/log/reminders.log 2>&1
10 * * * * curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/run-medical-reminders" -H "x-cron-secret: $X_CRON_SECRET" >> /var/log/reminders.log 2>&1
# Sumární přehled (týdenní souhrn) - jednou týdně v pondělí v 7:00
0 7 * * 1 curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/run-reminders" -H "x-cron-secret: $X_CRON_SECRET" >> /var/log/reminders.log 2>&1
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

> **Poznámka:** Samoregistrace je zakázána. Všechny další uživatele vytváří administrátor přes UI (Administrace → Správa uživatelů → Přidat uživatele).

### 9. Po přihlášení

1. V administraci nakonfigurujte **SMTP server** pro odesílání emailů (Administrace → Nastavení → E-mail)
2. Otestujte SMTP konfiguraci odesláním testovacího emailu
3. Nastavte `X_CRON_SECRET` v Lovable Cloud (sekce Secrets) — musí se shodovat s hodnotou v `.env` / crontabu
4. Ověřte funkci CRON úloh manuálním testem
5. Nastavte **modulový přístup** uživatelům (Administrace → Správa uživatelů) — moduly: `trainings`, `deadlines`, `plp`

### 10. Checklist po instalaci (infrastruktura)

- [ ] Docker kontejner běží (`docker ps`)
- [ ] Aplikace je dostupná v prohlížeči
- [ ] První admin uživatel vytvořen (a heslo změněno!)
- [ ] SMTP nakonfigurován a otestován (Administrace → Nastavení → E-mail)
- [ ] CRON úlohy nastaveny (4 endpointy — 3× hodinově + 1× týdenně)
- [ ] X_CRON_SECRET synchronizován mezi `.env`/crontab a Lovable Cloud
- [ ] Modulový přístup nakonfigurován (trainings, deadlines, plp)
- [ ] SSL certifikát nainstalován (produkce)
- [ ] Zálohovací strategie nastavena

### 11. Checklist prvního administrátora (konfigurace aplikace)

Po dokončení technické instalace projděte tyto kroky pro plnou konfiguraci systému **Lhůtník**:

#### 🔐 Fáze 1: Zabezpečení účtu
- [ ] Přihlásit se výchozími údaji (`admin@system.local` / `admin123`)
- [ ] **Ihned změnit heslo** v profilu uživatele
- [ ] Po vytvoření reálného admin účtu deaktivovat nebo smazat `admin@system.local`
- [ ] Ověřit, že `X_CRON_SECRET` je silný a unikátní

#### 🏢 Fáze 2: Organizační struktura
- [ ] **Provozovny**: Systém → Provozovny → Přidat všechny provozovny (kód + název), ověřit že jsou aktivní
- [ ] **Oddělení**: Systém → Oddělení → Přidat všechna oddělení (kód + název)

#### 📋 Fáze 3: Číselníky typů
- [ ] **Typy školení**: Přidat názvy, periodicitu (dny) a provozovnu
- [ ] **Typy technických událostí**: Přidat názvy, periodicitu a provozovnu
- [ ] **Typy lékařských prohlídek**: Přidat názvy, periodicitu a provozovnu

#### 👥 Fáze 4: Zaměstnanci
- [ ] Připravit CSV/XLSX (os. číslo, jméno, příjmení, email, pozice, oddělení)
- [ ] Provést hromadný import nebo přidat ručně
- [ ] Ověřit správnost nadřízených (manager vazby)
- [ ] Zkontrolovat přiřazení do oddělení

#### 🔑 Fáze 5: Uživatelské účty
- [ ] Systém → Správa uživatelů → Přidat uživatele pro každého, kdo potřebuje přístup
- [ ] Nastavit role: **Admin** (plný přístup) / **Manažer** (editace svého subtree) / **Uživatel** (náhled)
- [ ] **Propojit profily s kartami zaměstnanců** (povinné pro Manažery a Uživatele — nutné pro RLS!)
- [ ] Nastavit přístup k modulům: Školení (`trainings`), Technické události (`deadlines`), PLP (`plp`)

#### 👨‍👩‍👧‍👦 Fáze 6: Skupiny odpovědných osob
- [ ] Systém → Skupiny odpovědných → Vytvořit skupiny (např. "BOZP tým", "Technici")
- [ ] Přiřadit členy do skupin

#### 📧 Fáze 7: E-maily a připomínky
- [ ] Administrace → Nastavení → E-mail → Nakonfigurovat SMTP server
- [ ] Odeslat **testovací e-mail** a ověřit doručení
- [ ] Nastavit e-mailové šablony pro **školení**
- [ ] Nastavit e-mailové šablony pro **technické události**
- [ ] Nastavit e-mailové šablony pro **lékařské prohlídky**
- [ ] Nakonfigurovat příjemce souhrnných e-mailů (per modul)

#### 📥 Fáze 8: Import dat
- [ ] Importovat existující záznamy **školení** (hromadný import)
- [ ] Importovat **technické události / lhůty**
- [ ] Importovat **lékařské prohlídky**
- [ ] Zkontrolovat vypočtené stavy (✅ platné / ⚠️ blíží se / ❌ po termínu)

#### ✅ Fáze 9: Ověření funkčnosti
- [ ] Zkontrolovat **Stav systému** — poslední běh připomínek
- [ ] Spustit manuální běh připomínek a ověřit logy
- [ ] Ověřit statistiky na dashboardu
- [ ] Otestovat přihlášení jiným uživatelem (manažer / uživatel)
- [ ] Ověřit, že modulový přístup funguje správně (viditelnost menu)

> 💡 **Tip:** Po dokončení všech kroků doporučujeme vytvořit zálohu databáze jako výchozí referenční bod.

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

### Režim B: Self-hosted Supabase (optimalizovaný produkční stack)

Tento režim spustí **optimalizovaný Supabase stack** (9 komponent) na vašem serveru:

| Služba | Image | Port | Popis |
|--------|-------|------|-------|
| **Frontend** | Custom (Nginx) | 80 | React aplikace |
| **Kong** | kong:2.8.1 | 8000 | API Gateway |
| **GoTrue** | supabase/gotrue:v2.185.0 | - | Autentizace |
| **PostgREST** | postgrest/postgrest:v14.3 | - | REST API |
| **Realtime** | supabase/realtime:v2.72.0 | - | WebSocket subscriptions |
| **Storage** | supabase/storage-api:v1.37.1 | - | Úložiště souborů |
| **Edge Functions** | supabase/edge-runtime:v1.70.0 | - | Serverless funkce (Deno) |
| **PostgreSQL** | supabase/postgres:15.8.1.085 | 5432 | Databáze |
| **CRON** | alpine:3.19 | - | Automatické připomínky |

> **Poznámka:** Doplňkové služby (Studio, Analytics, ImgProxy, Meta, Vector, Supavisor) byly odstraněny pro snížení nároků na zdroje. Pokud potřebujete Studio dashboard, přidejte jej zpět dle [oficiální dokumentace Supabase](https://supabase.com/docs/guides/self-hosting/docker).

#### Požadavky na server

| Komponenta | Požadavek |
|------------|-----------|
| **RAM** | Min. **2 GB** (doporučeno 4 GB) |
| **Disk** | Min. 10 GB |
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

#### ⚠️ Důležité: API_EXTERNAL_URL

Proměnná `API_EXTERNAL_URL` je **klíčová pro produkční nasazení**. Ovlivňuje:

1. **Frontend** — `VITE_SUPABASE_URL` se při buildu nastaví na hodnotu `API_EXTERNAL_URL` (aplikace se na tuto adresu připojuje jako na backend)
2. **GoTrue Auth** — callback URL, ověřovací odkazy v emailech (reset hesla, potvrzení registrace)

**Pokud `API_EXTERNAL_URL` nenastavíte**, frontend se buildí s fallbackem `http://{SITE_DOMAIN}:{KONG_HTTP_PORT}` (výchozí `http://localhost:8000`), což v produkci nefunguje.

```env
# Příklady správného nastavení:
API_EXTERNAL_URL=http://vasedomena.cz:8000        # HTTP bez reverse proxy
API_EXTERNAL_URL=https://api.vasedomena.cz         # HTTPS s reverse proxy
API_EXTERNAL_URL=http://192.168.1.100:8000         # LAN přístup přes IP
```

> **Po změně `API_EXTERNAL_URL` je nutné znovu buildnout frontend:**
> ```bash
> docker compose -f docker-compose.supabase.yml build frontend
> docker compose -f docker-compose.supabase.yml up -d frontend
> ```

#### Krok 5: Spuštění

```bash
# Build a spuštění všech služeb
docker compose -f docker-compose.supabase.yml up -d --build

# Sledování logů
docker compose -f docker-compose.supabase.yml logs -f

# Kontrola stavu
docker compose -f docker-compose.supabase.yml ps
```

#### Krok 6: Vytvoření prvního administrátora

1. Zavolejte Edge funkci `seed-initial-admin` pro vytvoření prvního admin účtu:

```bash
curl -X POST "http://localhost:8000/functions/v1/seed-initial-admin" \
  -H "Content-Type: application/json"
```

2. Otevřete aplikaci: `http://vasedomena.cz`
3. **Přihlaste se** pomocí: `admin@system.local` / `admin123`
4. **Ihned si změňte heslo** v Profilu

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
| Pondělí 7:00 | Sumární přehled | `run-reminders` |

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

| Funkce | Modul | Endpoint | Frekvence |
|--------|-------|----------|-----------|
| `send-training-reminders` | Školení | `/functions/v1/send-training-reminders` | Hodinově |
| `run-deadline-reminders` | Technické události | `/functions/v1/run-deadline-reminders` | Hodinově |
| `run-medical-reminders` | PLP Prohlídky | `/functions/v1/run-medical-reminders` | Hodinově |
| `run-reminders` | Sumární přehled (školení) | `/functions/v1/run-reminders` | Týdně (po 7:00) |

### Linux Crontab (Režim A — externí Supabase/Cloud)

Otevřete crontab: `crontab -e` a přidejte:

```bash
# ============================================
# PŘIPOMÍNKY - KAŽDOU HODINU + TÝDENNÍ SOUHRN
# ============================================

# Školení - každou hodinu v :00
0 * * * * curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/send-training-reminders" -H "Content-Type: application/json" -H "x-cron-secret: YOUR_X_CRON_SECRET" >> /var/log/training-reminders.log 2>&1

# Technické události - každou hodinu v :05
5 * * * * curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/run-deadline-reminders" -H "Content-Type: application/json" -H "x-cron-secret: YOUR_X_CRON_SECRET" >> /var/log/deadline-reminders.log 2>&1

# PLP prohlídky - každou hodinu v :10
10 * * * * curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/run-medical-reminders" -H "Content-Type: application/json" -H "x-cron-secret: YOUR_X_CRON_SECRET" >> /var/log/medical-reminders.log 2>&1

# Sumární přehled školení - jednou týdně v pondělí v 7:00
0 7 * * 1 curl -s -X POST "https://YOUR_SUPABASE_URL/functions/v1/run-reminders" -H "Content-Type: application/json" -H "x-cron-secret: YOUR_X_CRON_SECRET" >> /var/log/summary-reminders.log 2>&1
```

### Bash skript (alternativa)

Vytvořte `/opt/scripts/run-reminders.sh`:

```bash
#!/bin/bash
# ============================================
# Skript pro spouštění připomínek
# ============================================

X_CRON_SECRET="YOUR_X_CRON_SECRET"
BASE_URL="https://YOUR_SUPABASE_URL/functions/v1"
LOG_DIR="/var/log/reminders"

mkdir -p $LOG_DIR

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Spouštím připomínky..." >> $LOG_DIR/cron.log

# Školení
echo "[$(date '+%Y-%m-%d %H:%M:%S')] -> Školení" >> $LOG_DIR/cron.log
curl -s -X POST "$BASE_URL/send-training-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $X_CRON_SECRET" \
  >> $LOG_DIR/training.log 2>&1

# Technické události
echo "[$(date '+%Y-%m-%d %H:%M:%S')] -> Technické události" >> $LOG_DIR/cron.log
curl -s -X POST "$BASE_URL/run-deadline-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $X_CRON_SECRET" \
  >> $LOG_DIR/deadline.log 2>&1

# PLP prohlídky
echo "[$(date '+%Y-%m-%d %H:%M:%S')] -> PLP prohlídky" >> $LOG_DIR/cron.log
curl -s -X POST "$BASE_URL/run-medical-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $X_CRON_SECRET" \
  >> $LOG_DIR/medical.log 2>&1

# Sumární přehled
echo "[$(date '+%Y-%m-%d %H:%M:%S')] -> Sumární přehled" >> $LOG_DIR/cron.log
curl -s -X POST "$BASE_URL/run-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $X_CRON_SECRET" \
  >> $LOG_DIR/summary.log 2>&1

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

Tento klíč nastavte jako `X_CRON_SECRET` v Lovable Cloud (sekce Secrets) a současně do `.env` / crontabu.

### Testování

```bash
# Manuální test
curl -X POST "https://YOUR_SUPABASE_URL/functions/v1/send-training-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_X_CRON_SECRET"
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

### Korelace logů (run_id)

Každý běh připomínek (školení) vytváří záznam v tabulce `reminder_runs` s unikátním `run_id`. Všechny odeslané e-maily v rámci jednoho běhu sdílejí tento `run_id`, což umožňuje:
- filtrovat logy podle konkrétního běhu
- zobrazit detail běhu (počet odeslaných / chybových e-mailů)
- diagnostikovat problémy v kontextu jednoho spuštění

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

## 🔒 Bezpečnost — Kompletní přehled implementovaných funkcí

Aplikace **Lhůtník** je navržena jako **defense-in-depth** systém s vícevrstvým zabezpečením. Níže je úplný seznam bezpečnostních funkcí, které jsou v aplikaci aktivní.

### 1. Autentizace a autorizace

| Funkce | Popis | Konfigurace |
|--------|-------|-------------|
| **Role-based access control** | Tři role: `admin`, `manager`, `user`. Role uloženy v separátní tabulce `user_roles` (zabraňuje privilege escalation přes `profiles`) | Administrace → Správa uživatelů |
| **Modulový přístup** | Per-uživatel granularita pro `trainings`, `deadlines`, `plp` | Administrace → Správa uživatelů → Moduly |
| **RLS (Row Level Security)** | RLS politiky na **všech** tabulkách + `SECURITY DEFINER` funkce (`has_role`, `is_admin_safe`) bez rekurze | Automaticky |
| **Atomická změna rolí** | RPC `set_user_role` mění roli a logy v jedné transakci | — |
| **JWT verifikace** | Edge funkce verifikují JWT, `x-cron-secret` hlavička pro automatizaci | `X_CRON_SECRET` v `.env` |
| **Samoregistrace ZAKÁZÁNA** | Účty vytváří pouze administrátor | `DISABLE_SIGNUP=true` v `.env` |
| **Hierarchická viditelnost** | Manažer vidí pouze záznamy ve svém subtree (FK `manager_employee_id`) | — |

### 2. Politika hesel a relací

| Funkce | Popis | Konfigurace |
|--------|-------|-------------|
| **Password policy** | Konfigurovatelná délka, velká/malá písmena, číslice, speciální znaky | Administrace → Bezpečnost → Politika hesel |
| **Vynucená změna hesla** | Při prvním přihlášení seed admina, ručním resetu adminem, vytvoření uživatele | Automaticky (`must_change_password`) |
| **Idle timeout** | Automatické odhlášení po nečinnosti | Administrace → Bezpečnost → Časový limit relace |
| **HIBP (Have I Been Pwned)** | Detekce kompromitovaných hesel proti databázi 1B+ uniklých hesel | `GOTRUE_PASSWORD_HIBP_ENABLED=true` v `.env` |
| **MFA / TOTP** | Vícefaktorová autentizace | `GOTRUE_MFA_ENABLED=true` v `.env` |
| **Zkrácená platnost OTP** | Magické odkazy a OTP kódy 1 h (default 24 h) | `GOTRUE_MAILER_OTP_EXP=3600` v `.env` |
| **JWT expirace** | Konfigurovatelná životnost tokenu | `JWT_EXPIRY=3600` v `.env` |

### 3. Brute-force ochrana (account lockout)

- **Aktivní zamykání účtů**: Po **N neúspěšných pokusech v X minutách** (default 5 / 15) se účet automaticky uzamkne na **Y minut** (default 15)
- **Pre-check v `signIn`**: RPC `is_account_locked` se volá **před** GoTrue → nesnižuje GoTrue rate-limit
- **Login UI**: Jasné upozornění *„Účet je dočasně uzamčen"* s **živým odpočtem** do odemčení
- **Toast warning**: *„Zbývá X pokusů do uzamčení"* (last 2 attempts)
- **Admin dashboard** (Administrace → Bezpečnost → Monitorování přihlašování):
  - Tabulka aktuálně uzamčených účtů s odpočtem do odemčení
  - Early-warning přehled opakovaných selhání bez uzamčení (3+ za 24 h)
  - Auto-refresh každých 30 s
- **Konfigurace** politiky: `system_settings` (lockout_threshold, lockout_window_minutes, lockout_duration_minutes)

### 4. Audit log

- **Kompletní auditing** všech změn v hlavních tabulkách → `audit_logs` (kdo, co, kdy, stará/nová hodnota, IP)
- **Sekce Administrace → Audit log** s třemi záložkami:
  - **Basic** — denní přehled aktivit
  - **Advanced** — detailní filtrace, export do CSV
  - **RLS Diagnostics** — diagnostika RLS politik
- **Tabulka `auth_signin_attempts`** — všechny pokusy o přihlášení (success/failure) s IP a user-agentem

### 5. Automatická retence logů (pg_cron)

Automatický `pg_cron` job `cleanup_old_security_logs_daily` (denně **03:30 UTC**) maže staré záznamy:

| Tabulka | Default retence | Konfigurace |
|---------|-----------------|-------------|
| `audit_logs` | 365 dní | `system_settings.audit_log_retention_days` |
| `reminder_logs` | 90 dní | `system_settings.reminder_log_retention_days` |
| `auth_signin_attempts` | 180 dní | `system_settings.signin_attempts_retention_days` |
| `deadline_reminder_logs` | 90 dní | — |
| `medical_reminder_logs` | 90 dní | — |

Vyžaduje aktivní extenze **`pg_cron`** a **`pg_net`** v PostgreSQL.

### 6. Bezpečnostní HTTP hlavičky (nginx)

Frontend kontejner (`nginx.conf`) i reverse-proxy konfigurace (`selfhosted-resources/nginx-reverseproxy/`) nastavují:

| Hlavička | Hodnota | Ochrana proti |
|----------|---------|---------------|
| **Content-Security-Policy** | `default-src 'self'`, povolené Supabase endpointy, `frame-ancestors 'none'` | XSS, data exfiltration |
| **X-Frame-Options** | `SAMEORIGIN` | Clickjacking |
| **X-Content-Type-Options** | `nosniff` | MIME-type sniffing |
| **X-XSS-Protection** | `1; mode=block` | Legacy XSS (starší klienti) |
| **Strict-Transport-Security** | `max-age=31536000; includeSubDomains; preload` | Downgrade attack (HTTPS only) |
| **Referrer-Policy** | `strict-origin-when-cross-origin` | Únik dat přes Referer |
| **Permissions-Policy** | `camera=(), microphone=(), geolocation=(), interest-cohort=()` | Zneužití API + FLoC tracking |
| **server_tokens off** | — | Skrytí verze nginx |

### 7. Rate limiting (nginx)

| Zóna | Limit | Účel |
|------|-------|------|
| `auth_zone` | **5 r/s** pro `/auth/*` | Brute-force ochrana login |
| `api_zone` | **30 r/s**, burst 60 | Obecné API |
| `conn_per_ip` | **50 souběžných spojení** na IP | DoS ochrana |

### 8. Edge funkce — autorizace

- **Duální mechanismus**: validní JWT **NEBO** `x-cron-secret` hlavička (pro CRON)
- Citlivé admin funkce (`admin-create-user`, `admin-delete-user`, `admin-reset-password`) vyžadují **server-side ověření role admin**
- `admin-delete-user` provádí **kompletní cascade cleanup** (mazání souborů ze storage, profilů, rolí)

### 9. Storage zabezpečení

- **3 buckety** (`training-documents`, `deadline-documents`, `medical-documents`) s RLS
- Přístup pouze pro autorizované uživatele s vazbou na záznam
- Soubory se mažou při permanent-delete záznamu

### 10. Self-hosted hardening checklist

Aplikace obsahuje **interaktivní Security Checklist** (Administrace → Bezpečnost → Security Findings) pokrývající všechny body níže. Doporučujeme projít po nasazení.

---

## 🛡️ Self-hosted: Detailní bezpečnostní hardening

Tato sekce obsahuje **podrobný návod** jak zabezpečit self-hosted instanci na vlastním serveru.

### Krok 1: Požadavky před nasazením

| Komponenta | Minimum | Doporučené |
|------------|---------|------------|
| **OS** | Ubuntu 22.04 / Debian 11 / RHEL 8 | Ubuntu 24.04 LTS |
| **Docker** | 24.0+ | 27.0+ |
| **Docker Compose** | 2.20+ | 2.29+ |
| **Node.js** (pouze pro generování JWT klíčů) | 18+ | 20 LTS |
| **RAM** | 4 GB | 8 GB+ |
| **CPU** | 2 jádra | 4+ jádra |
| **Disk** | 20 GB SSD | 50+ GB SSD |
| **PostgreSQL** | 15+ (součást Supabase image) | 15.8+ |
| **Doména + SSL** | Let's Encrypt zdarma | Wildcard cert pro subdomény |

> ⚠️ **Pozor**: Self-hosted Supabase **nelze provozovat** s externím PostgreSQL — musíte použít `supabase/postgres` image, který obsahuje extenze `pg_cron`, `pg_net`, `pgsodium`, `pgjwt`.

### Krok 2: Generování silných tajných klíčů

```bash
# Vytvořte všechny klíče najednou
cat > /tmp/generate-secrets.sh << 'EOF'
#!/bin/bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)"
echo "JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)"
echo "DASHBOARD_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
echo "SECRET_KEY_BASE=$(openssl rand -hex 32)"
echo "VAULT_ENC_KEY=$(openssl rand -hex 16)"
echo "X_CRON_SECRET=$(openssl rand -hex 32)"
EOF
chmod +x /tmp/generate-secrets.sh
/tmp/generate-secrets.sh > .env.secrets
cat .env.secrets  # Vložte hodnoty do .env
```

### Krok 3: Klíčové `.env` proměnné pro produkční hardening

```env
# ============================================
# POVINNÁ BEZPEČNOSTNÍ NASTAVENÍ
# ============================================

# 🔒 ZÁKAZ samoregistrace — pouze admin vytváří účty
DISABLE_SIGNUP=true

# 🔒 SILNÉ Studio heslo (POVINNĚ ZMĚŇTE!)
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=<vygenerované-silné-heslo-min-24-znaků>

# 🔒 HIBP — kontrola hesel proti databázi 1B+ uniklých hesel
GOTRUE_PASSWORD_HIBP_ENABLED=true

# 🔒 MFA / TOTP autentizace
GOTRUE_MFA_ENABLED=true
GOTRUE_MFA_MAX_ENROLLED_FACTORS=2

# 🔒 Zkrácení platnosti OTP a recovery odkazů (default 24h → 1h)
GOTRUE_MAILER_OTP_EXP=3600

# 🔒 Vypnutí anonymních uživatelů
ENABLE_ANONYMOUS_USERS=false

# 🔒 Vypnutí phone signup (nepoužíváme)
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

# 🔒 JWT expirace 1h
JWT_EXPIRY=3600

# 🔒 Rate-limit hlavička za reverse proxy
GOTRUE_RATE_LIMIT_HEADER=X-Forwarded-For

# 🔒 SITE_URL musí být HTTPS produkční doména
SITE_URL=https://lhutnik.vasefirma.cz
API_EXTERNAL_URL=https://api.lhutnik.vasefirma.cz

# 🔒 CRON secret (32+ znaků, unikátní)
X_CRON_SECRET=<vygenerovaný-hex-32>
```

### Krok 4: Nastavení nginx (CSP, X-Frame-Options, SSL)

Frontend kontejner už má v `nginx.conf` přednastavené všechny bezpečnostní hlavičky. Pro **reverse proxy** (HTTPS termination) použijte vzory v `selfhosted-resources/nginx-reverseproxy/`.

#### 4a. Reverse proxy s Let's Encrypt SSL

```bash
# 1. Instalace nginx + certbot
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# 2. Získání certifikátu
sudo certbot --nginx -d lhutnik.vasefirma.cz -d api.lhutnik.vasefirma.cz \
  --agree-tos --email admin@vasefirma.cz --redirect

# 3. Auto-renewal (certbot vytvoří systemd timer automaticky)
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run
```

#### 4b. Vzor reverse-proxy konfigurace

```nginx
# /etc/nginx/sites-available/lhutnik.conf

# Rate limit zóny (musí být v http kontextu — vložte do nginx.conf)
limit_req_zone $binary_remote_addr zone=auth_zone:10m rate=5r/s;
limit_req_zone $binary_remote_addr zone=api_zone:10m rate=30r/s;
limit_conn_zone $binary_remote_addr zone=conn_per_ip:10m;

# Frontend (port 80 → frontend kontejner :8087)
server {
    listen 443 ssl http2;
    server_name lhutnik.vasefirma.cz;

    ssl_certificate /etc/letsencrypt/live/lhutnik.vasefirma.cz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lhutnik.vasefirma.cz/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Bezpečnostní hlavičky (CSP, HSTS, X-Frame-Options atd.)
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.lhutnik.vasefirma.cz wss://api.lhutnik.vasefirma.cz; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests" always;

    limit_conn conn_per_ip 50;
    server_tokens off;

    location / {
        proxy_pass http://127.0.0.1:8087;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# Supabase API (port Kong :8091)
server {
    listen 443 ssl http2;
    server_name api.lhutnik.vasefirma.cz;

    ssl_certificate /etc/letsencrypt/live/api.lhutnik.vasefirma.cz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.lhutnik.vasefirma.cz/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    server_tokens off;

    # Strict rate-limit pro auth endpointy
    location /auth/ {
        limit_req zone=auth_zone burst=10 nodelay;
        proxy_pass http://127.0.0.1:8091;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        limit_req zone=api_zone burst=60 nodelay;
        limit_conn conn_per_ip 50;
        proxy_pass http://127.0.0.1:8091;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        # WebSocket podpora pro Realtime
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name lhutnik.vasefirma.cz api.lhutnik.vasefirma.cz;
    return 301 https://$host$request_uri;
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lhutnik.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Krok 5: Aktivace pg_cron pro retenci logů

Po prvním nasazení **ověřte**, že retenční job běží:

```bash
# Připojení do databáze
docker exec -it supabase-db psql -U postgres -d postgres

# Ověření pg_cron extenze
SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

# Seznam aktivních CRON jobů
SELECT jobid, schedule, command, active FROM cron.job;

# Měl by být vidět job 'cleanup_old_security_logs_daily' (30 3 * * *)
# Pokud chybí, ručně aktivujte z migrace:
\i /docker-entrypoint-initdb.d/migrations/20260427105248_*.sql
```

Pokud `pg_cron` extenze chybí (např. starší PostgreSQL image):

```sql
-- V databázi jako superuser
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
GRANT USAGE ON SCHEMA cron TO postgres;
```

A v `postgresql.conf` (nebo přes Docker `command:`):
```
shared_preload_libraries = 'pg_cron'
cron.database_name = 'postgres'
```

### Krok 6: Firewall — uzavřete interní porty

**KRITICKÉ**: Self-hosted Supabase stack vystavuje **interní porty**, které **NESMÍ být dostupné z internetu**:

| Port | Služba | Smí být na internetu? |
|------|--------|------------------------|
| **5432** | PostgreSQL | ❌ **NIKDY** |
| **3000** | Supabase Studio | ❌ Nikdy (pouze přes VPN/SSH tunnel) |
| **8091** | Kong (API Gateway) | ⚠️ Pouze přes reverse-proxy (443) |
| **4000** | Logflare/Vector | ❌ Nikdy |
| **8443** | Kong HTTPS (interní) | ❌ Nikdy |
| **8087** | Frontend kontejner | ⚠️ Pouze přes reverse-proxy (443) |
| 80, 443 | Nginx reverse proxy | ✅ Veřejně |
| 22 | SSH | ✅ Lépe omezit na známé IP |

#### UFW konfigurace (Ubuntu/Debian)

```bash
# Reset firewall (POZOR — zruší všechna stávající pravidla)
sudo ufw --force reset

# Default: blokuj vše příchozí, povol vše odchozí
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Povolené veřejné porty
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP (redirect na HTTPS)'
sudo ufw allow 443/tcp comment 'HTTPS'

# EXPLICITNĚ blokuj interní Supabase porty z internetu
sudo ufw deny 5432/tcp comment 'PostgreSQL — NIKDY'
sudo ufw deny 3000/tcp comment 'Studio — pouze přes SSH tunnel'
sudo ufw deny 8091/tcp comment 'Kong — pouze přes reverse proxy'
sudo ufw deny 4000/tcp comment 'Logflare'
sudo ufw deny 8443/tcp comment 'Kong HTTPS interní'
sudo ufw deny 8087/tcp comment 'Frontend — pouze přes reverse proxy'

# Volitelně: SSH pouze ze známých IP
# sudo ufw allow from 203.0.113.0/24 to any port 22

# Aktivace
sudo ufw enable
sudo ufw status verbose
```

#### Docker bind pouze na localhost

V `docker-compose.supabase.yml` ověřte, že interní porty jsou bindované **pouze na 127.0.0.1**:

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5432:5432"   # ✅ pouze localhost
      # NE: "5432:5432"           ❌ vystaví na všechna interface
  kong:
    ports:
      - "127.0.0.1:8091:8000"   # ✅ pouze localhost (reverse proxy přepošle)
  studio:
    ports:
      - "127.0.0.1:3000:3000"   # ✅ pouze přes SSH tunnel
```

#### Přístup ke Studio přes SSH tunnel

```bash
# Z lokálního počítače
ssh -L 3000:127.0.0.1:3000 user@vas-server.cz
# Pak otevřete http://localhost:3000 v lokálním prohlížeči
```

### Krok 7: Doporučené kroky po prvním nasazení

#### 7.1 IHNED po `seed-initial-admin`

```bash
# 1. Zavolejte seed funkci
curl -X POST "https://api.lhutnik.vasefirma.cz/functions/v1/seed-initial-admin"

# 2. Přihlaste se: admin@system.local / admin123
# 3. ⚠️ OKAMŽITĚ změňte heslo v Profilu (vynuceno systémem)
```

#### 7.2 Vytvořte reálný admin účet

1. Administrace → Správa uživatelů → **Přidat uživatele** s vaším reálným e-mailem
2. Přiřaďte roli **admin**
3. Přihlaste se reálným účtem
4. **Deaktivujte nebo smažte** výchozí `admin@system.local`

#### 7.3 Zapněte HIBP v Supabase Auth

V `.env`:
```env
GOTRUE_PASSWORD_HIBP_ENABLED=true
```

Restartujte auth službu:
```bash
docker compose -f docker-compose.supabase.yml restart auth
```

#### 7.4 Změňte výchozí Studio heslo

```bash
# V .env
DASHBOARD_PASSWORD=<silné-heslo-min-24-znaků>

# Restartujte Studio
docker compose -f docker-compose.supabase.yml restart studio
```

#### 7.5 Ověřte bezpečnostní hlavičky

```bash
# Test CSP, HSTS, X-Frame-Options
curl -sI https://lhutnik.vasefirma.cz | grep -iE 'content-security|x-frame|strict-transport|x-content-type|referrer-policy'

# Online test
# https://securityheaders.com/?q=lhutnik.vasefirma.cz
# Cílový rating: A nebo A+
```

#### 7.6 Ověřte že interní porty NEJSOU veřejné

```bash
# Z externího počítače (NE ze serveru!)
nmap -p 5432,3000,8091,4000,8443 vas-server.cz
# Očekávaný výsledek: všechny porty 'filtered' nebo 'closed'

# Test PostgreSQL z internetu (musí selhat!)
psql "postgresql://postgres:heslo@vas-server.cz:5432/postgres"
# Očekávané: connection timeout / refused
```

#### 7.7 Aktivujte automatickou retenci logů

```bash
# Ověřte že pg_cron job běží
docker exec -it supabase-db psql -U postgres -c "SELECT jobname, schedule, active FROM cron.job;"

# Měl by vrátit:
#  jobname                          | schedule    | active
# ----------------------------------+-------------+--------
#  cleanup_old_security_logs_daily  | 30 3 * * *  | t
```

#### 7.8 Nakonfigurujte SMTP pro auth e-maily

Administrace → Nastavení → E-mail (testovací odeslání povinné!)

#### 7.9 Nastavte zálohovací strategii

Viz sekce **💾 Zálohování databáze a Storage** níže.

#### 7.10 Aktivujte fail2ban (volitelné, doporučené)

```bash
sudo apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600
EOF

sudo systemctl enable --now fail2ban
sudo fail2ban-client status
```

### Krok 8: Kompletní self-hosted hardening checklist

Aplikace obsahuje **interaktivní Security Checklist** (Administrace → Bezpečnost → Security Findings) s živou kontrolou. Manuálně projděte:

- [ ] `DISABLE_SIGNUP=true` v `.env`
- [ ] Změněno výchozí Studio heslo (`DASHBOARD_PASSWORD`)
- [ ] Vygenerován silný `JWT_SECRET` (min 48 znaků, unikátní per instance)
- [ ] Vygenerován silný `POSTGRES_PASSWORD` (min 32 znaků)
- [ ] Vygenerován silný `X_CRON_SECRET` (32+ hex znaků)
- [ ] `GOTRUE_PASSWORD_HIBP_ENABLED=true`
- [ ] `GOTRUE_MFA_ENABLED=true` (volitelné, doporučené)
- [ ] `GOTRUE_MAILER_OTP_EXP=3600` (1h místo 24h)
- [ ] `ENABLE_ANONYMOUS_USERS=false`
- [ ] HTTPS aktivní (Let's Encrypt, auto-renewal)
- [ ] HSTS hlavička s `includeSubDomains; preload`
- [ ] CSP hlavička bez `unsafe-eval` (nebo zdokumentováno proč)
- [ ] X-Frame-Options: SAMEORIGIN
- [ ] Firewall: porty **5432, 3000, 8091, 4000, 8443, 8087 NEDOSTUPNÉ z internetu**
- [ ] Docker porty bindované pouze na `127.0.0.1` (kromě 80/443)
- [ ] `pg_cron` job `cleanup_old_security_logs_daily` aktivní
- [ ] Reálný admin účet vytvořen + výchozí `admin@system.local` deaktivován
- [ ] SMTP konfigurován + testovací e-mail odeslán
- [ ] Denní automatická záloha DB + Storage (cron 3:00)
- [ ] Týdenní off-site záloha (rsync / S3)
- [ ] fail2ban aktivní (volitelné)
- [ ] SSH: `PermitRootLogin no`, klíčová autentizace (no password)
- [ ] PostgreSQL verze aktualizovaná (`SELECT version();`)
- [ ] Pravidelný `docker compose pull` + restart (měsíčně)
- [ ] Test obnovy ze zálohy proveden alespoň 1× 


---

## 💾 Zálohování databáze a Storage

### Přehled

| Co zálohovat | Obsah | Nástroj |
|--------------|-------|---------|
| **Databáze** | Tabulky, RLS, funkce, triggery | `pg_dump` |
| **Storage** | Dokumenty školení, lhůt, prohlídek | `docker cp` / rsync |
| **Konfigurace** | `.env`, `docker-compose.yml` | Ruční kopie / git |

---

### A) Záloha databáze (Self-hosted Supabase)

#### Jednorázová záloha

```bash
# Kompletní záloha (schéma + data)
docker exec -t supabase-db pg_dump -U postgres -d postgres \
  --no-owner --no-privileges \
  | gzip > backup_db_$(date +%Y%m%d_%H%M%S).sql.gz

# Pouze data (bez struktury - pro migraci)
docker exec -t supabase-db pg_dump -U postgres -d postgres \
  --data-only --no-owner \
  | gzip > backup_data_$(date +%Y%m%d_%H%M%S).sql.gz

# Pouze public schéma (bez auth/storage interních)
docker exec -t supabase-db pg_dump -U postgres -d postgres \
  --schema=public --no-owner --no-privileges \
  | gzip > backup_public_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Obnova databáze ze zálohy

```bash
# Rozbalení
gunzip backup_db_20250210_030000.sql.gz

# Obnova do běžící databáze
docker exec -i supabase-db psql -U postgres -d postgres \
  < backup_db_20250210_030000.sql

# Obnova s vyčištěním (POZOR: smaže aktuální data!)
docker exec -i supabase-db psql -U postgres -d postgres \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
docker exec -i supabase-db psql -U postgres -d postgres \
  < backup_db_20250210_030000.sql
```

---

### B) Záloha Storage (dokumenty)

Aplikace používá 3 storage buckety:

| Bucket | Obsah |
|--------|-------|
| `training-documents` | Dokumenty ke školením |
| `deadline-documents` | Dokumenty k technickým lhůtám |
| `medical-documents` | Dokumenty k lékařským prohlídkám |

#### Záloha pomocí Docker volume

```bash
# Zjistěte název storage volume
docker volume ls | grep storage

# Záloha celého storage volume
docker run --rm \
  -v supabase_storage-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/storage_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .
```

#### Záloha přes Supabase Storage API

```bash
#!/bin/bash
# backup-storage.sh - Záloha souborů přes REST API

SUPABASE_URL="http://localhost:8000"
SERVICE_ROLE_KEY="your-service-role-key"
BACKUP_DIR="/var/backups/training-system/storage"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR/$TIMESTAMP"

for BUCKET in training-documents deadline-documents medical-documents; do
  echo "[$(date)] Zálohuji bucket: $BUCKET"
  mkdir -p "$BACKUP_DIR/$TIMESTAMP/$BUCKET"

  # Získání seznamu souborů
  FILES=$(curl -s "$SUPABASE_URL/storage/v1/object/list/$BUCKET" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":10000}')

  # Stažení každého souboru
  echo "$FILES" | jq -r '.[].name // empty' | while read -r FILE; do
    curl -s "$SUPABASE_URL/storage/v1/object/$BUCKET/$FILE" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -o "$BACKUP_DIR/$TIMESTAMP/$BUCKET/$FILE"
  done

  echo "[$(date)] Bucket $BUCKET: hotovo"
done

# Komprese
tar czf "$BACKUP_DIR/storage_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR/$TIMESTAMP" .
rm -rf "$BACKUP_DIR/$TIMESTAMP"

echo "[$(date)] Záloha storage dokončena: storage_$TIMESTAMP.tar.gz"
```

#### Obnova storage ze zálohy

```bash
# Rozbalení
mkdir -p /tmp/storage-restore
tar xzf storage_20250210_030000.tar.gz -C /tmp/storage-restore

# Upload souborů zpět přes API
for BUCKET in training-documents deadline-documents medical-documents; do
  find /tmp/storage-restore/$BUCKET -type f | while read -r FILE; do
    FILENAME=$(basename "$FILE")
    curl -s -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/$FILENAME" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -H "Content-Type: application/octet-stream" \
      --data-binary @"$FILE"
  done
done
```

---

### C) Kompletní zálohovací skript (DB + Storage)

Vytvořte `/opt/scripts/backup-all.sh`:

```bash
#!/bin/bash
# ============================================
# Kompletní záloha: Databáze + Storage
# ============================================

BACKUP_DIR="/var/backups/training-system"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/backup-training.log"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# --- 1. Záloha databáze ---
log "=== Záloha databáze ==="
DB_FILE="$BACKUP_DIR/db_$TIMESTAMP.sql.gz"
docker exec -t supabase-db pg_dump -U postgres -d postgres \
  --no-owner --no-privileges 2>>"$LOG_FILE" \
  | gzip > "$DB_FILE"

if [ $? -eq 0 ] && [ -s "$DB_FILE" ]; then
  log "DB záloha OK: $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"
else
  log "CHYBA: DB záloha selhala!"
fi

# --- 2. Záloha storage volume ---
log "=== Záloha storage ==="
STORAGE_FILE="$BACKUP_DIR/storage_$TIMESTAMP.tar.gz"
docker run --rm \
  -v supabase_storage-data:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/storage_$TIMESTAMP.tar.gz" -C /data . 2>>"$LOG_FILE"

if [ $? -eq 0 ] && [ -s "$STORAGE_FILE" ]; then
  log "Storage záloha OK: $STORAGE_FILE ($(du -h "$STORAGE_FILE" | cut -f1))"
else
  log "VAROVÁNÍ: Storage záloha selhala (volume neexistuje?)"
fi

# --- 3. Záloha konfigurace ---
log "=== Záloha konfigurace ==="
CONFIG_FILE="$BACKUP_DIR/config_$TIMESTAMP.tar.gz"
tar czf "$CONFIG_FILE" \
  .env docker-compose.supabase.yml docker-compose.yml \
  nginx.conf docker/.env.example 2>>"$LOG_FILE"

if [ $? -eq 0 ]; then
  log "Config záloha OK: $CONFIG_FILE"
fi

# --- 4. Mazání starých záloh ---
log "=== Čištění starých záloh (retence: ${RETENTION_DAYS} dní) ==="
DELETED=$(find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
log "Smazáno $DELETED starých záloh"

# --- 5. Souhrn ---
log "=== Souhrn ==="
log "Celková velikost záloh: $(du -sh "$BACKUP_DIR" | cut -f1)"
log "Počet záloh: $(ls "$BACKUP_DIR"/*.gz 2>/dev/null | wc -l)"
log "=== Hotovo ==="
```

### D) Automatické zálohování (CRON)

```bash
# Oprávnění
chmod +x /opt/scripts/backup-all.sh

# Denní záloha ve 3:00
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/scripts/backup-all.sh") | crontab -

# Týdenní záloha na vzdálené úložiště (neděle 4:00)
(crontab -l 2>/dev/null; echo "0 4 * * 0 rsync -az /var/backups/training-system/ user@backup-server:/backups/training/") | crontab -
```

### E) Doporučená strategie zálohování

| Typ zálohy | Frekvence | Retence | Úložiště | Obsah |
|------------|-----------|---------|----------|-------|
| **Denní** | Každý den 3:00 | 7 dní | Lokální server | DB + Storage |
| **Týdenní** | Neděle 4:00 | 4 týdny | Vzdálený server (rsync/S3) | DB + Storage + Config |
| **Měsíční** | 1. den měsíce | 12 měsíců | Offline archiv | Kompletní |

### F) Ověření záloh

```bash
# Test integrity DB zálohy
gunzip -t backup_db_20250210_030000.sql.gz && echo "OK" || echo "POŠKOZENO"

# Test obnovy do dočasného kontejneru
docker run --rm -d --name test-restore \
  -e POSTGRES_PASSWORD=test \
  postgres:15
sleep 5
gunzip -c backup_db_20250210_030000.sql.gz | \
  docker exec -i test-restore psql -U postgres -d postgres
docker stop test-restore
```

> ⚠️ **Důležité**: Pravidelně testujte obnovu ze zálohy! Záloha, kterou nelze obnovit, je bezcenná.

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
# HTTP status (frontend)
curl -i http://localhost:80/
# Očekávaná odpověď: HTTP 200 OK

# Ověření edge funkcí (Supabase / Self-hosted)
curl -s "https://YOUR_SUPABASE_URL/functions/v1/send-training-reminders" \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -d '{"test_mode": true}'
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
curl -i https://YOUR_SUPABASE_URL

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

# Ověření X_CRON_SECRET
# Zkontrolujte shodu mezi .env a Lovable Cloud

# Manuální test připomínky
curl -X POST "https://YOUR_SUPABASE_URL/functions/v1/send-training-reminders" \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_X_CRON_SECRET" \
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

## 🔀 Migrace dat mezi Lovable Cloud a Self-hosted

### Přehled scénářů

| Směr | Popis | Typický důvod |
|------|-------|---------------|
| **Cloud → Self-hosted** | Export z Lovable Cloud, import do vlastního serveru | Přechod na vlastní infrastrukturu |
| **Self-hosted → Cloud** | Export z vlastního serveru, import do Lovable Cloud | Přechod na spravovanou službu |
| **Self-hosted → Self-hosted** | Migrace mezi dvěma servery | Stěhování serveru |

### A) Export dat z Lovable Cloud

#### 1. Export databáze

V Lovable Cloud UI (Cloud View → Run SQL) spusťte pro ověření:

```sql
SELECT 
  (SELECT COUNT(*) FROM employees) as employees,
  (SELECT COUNT(*) FROM trainings) as trainings,
  (SELECT COUNT(*) FROM deadlines) as deadlines,
  (SELECT COUNT(*) FROM medical_examinations) as medical_exams,
  (SELECT COUNT(*) FROM equipment) as equipment,
  (SELECT COUNT(*) FROM departments) as departments;
```

Pro export použijte Supabase CLI nebo `pg_dump`:

```bash
# Supabase CLI
supabase db dump --project-ref YOUR_PROJECT_REF > cloud_backup.sql

# Pouze data (bez schématu)
supabase db dump --project-ref YOUR_PROJECT_REF --data-only > cloud_data.sql

# Alternativa: pg_dump s connection stringem z Cloud View → Database Settings
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  --schema=public --no-owner --no-privileges > cloud_backup.sql
```

#### 2. Export storage (dokumenty)

```bash
#!/bin/bash
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
SERVICE_ROLE_KEY="your-service-role-key"
EXPORT_DIR="./storage-export"

for BUCKET in training-documents deadline-documents medical-documents; do
  mkdir -p "$EXPORT_DIR/$BUCKET"
  FILES=$(curl -s "$SUPABASE_URL/storage/v1/object/list/$BUCKET" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"prefix":"","limit":10000}')
  echo "$FILES" | jq -r '.[].name // empty' | while read -r FILE; do
    curl -s "$SUPABASE_URL/storage/v1/object/$BUCKET/$FILE" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -o "$EXPORT_DIR/$BUCKET/$FILE"
  done
  echo "Bucket $BUCKET: hotovo"
done
```

#### 3. Export uživatelů

```bash
supabase auth list-users --project-ref YOUR_PROJECT_REF > users_export.json
```

> ⚠️ **Hesla nelze exportovat** — uživatelé si musí po migraci nastavit nová hesla.

---

### B) Import dat do Self-hosted

#### 1. Příprava cílového serveru

```bash
docker compose -f docker-compose.supabase.yml up -d --build
sleep 30
docker compose -f docker-compose.supabase.yml ps
```

#### 2. Import databáze

```bash
# Kompletní import (schéma + data)
docker exec -i supabase-db psql -U postgres -d postgres < cloud_backup.sql

# Pouze data (pokud init-db.sql již vytvořil strukturu)
docker exec -i supabase-db psql -U postgres -d postgres \
  -c "TRUNCATE employees, trainings, deadlines, medical_examinations, equipment, departments CASCADE;"
docker exec -i supabase-db psql -U postgres -d postgres < cloud_data.sql
```

#### 3. Import storage

```bash
SUPABASE_URL="http://localhost:8000"
SERVICE_ROLE_KEY="your-local-service-role-key"

for BUCKET in training-documents deadline-documents medical-documents; do
  find ./storage-export/$BUCKET -type f | while read -r FILE; do
    FILENAME=$(basename "$FILE")
    curl -s -X POST "$SUPABASE_URL/storage/v1/object/$BUCKET/$FILENAME" \
      -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
      -H "Content-Type: application/octet-stream" \
      --data-binary @"$FILE"
  done
done
```

#### 4. Vytvoření uživatelů

```bash
# První admin
curl -X POST "http://localhost:8000/functions/v1/seed-initial-admin" \
  -H "Content-Type: application/json"
# Přihlášení: admin@system.local / admin123 → ihned změňte heslo!

# Ostatní uživatele vytvořte v Administrace → Správa uživatelů
```

#### 5. Ověření

```bash
docker exec -t supabase-db psql -U postgres -d postgres -c "
  SELECT 
    (SELECT COUNT(*) FROM employees) as employees,
    (SELECT COUNT(*) FROM trainings) as trainings,
    (SELECT COUNT(*) FROM deadlines) as deadlines,
    (SELECT COUNT(*) FROM medical_examinations) as medical_exams,
    (SELECT COUNT(*) FROM equipment) as equipment;
"
```

---

### C) Migrace Self-hosted → Cloud

```bash
# 1. Export z self-hosted
docker exec -t supabase-db pg_dump -U postgres -d postgres \
  --schema=public --data-only --no-owner > selfhosted_data.sql

# 2. Import do Cloud
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" \
  < selfhosted_data.sql
```

---

### D) Checklist migrace

- [ ] Záloha zdrojové i cílové databáze
- [ ] Export databáze (schéma + data)
- [ ] Export storage (3 buckety dokumentů)
- [ ] Export seznamu uživatelů
- [ ] Import databáze do cíle
- [ ] Import storage do cíle
- [ ] Vytvoření admin účtu + ostatních uživatelů
- [ ] Konfigurace SMTP na cíli
- [ ] Nastavení X_CRON_SECRET a CRON úloh
- [ ] Ověření počtu záznamů (shoda zdroj ↔ cíl)
- [ ] Test přihlášení a funkčnosti
- [ ] Přesměrování DNS / deaktivace starého prostředí

---

## 🔄 Aktualizace aplikace

### Postup aktualizace

```bash
# 1. Zastavení a backup
docker-compose down
/opt/scripts/backup-all.sh

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
PGPASSWORD="$DB_PASSWORD" psql -h db.YOUR_PROJECT_REF.supabase.co \
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

### Tajné klíče (X_CRON_SECRET)

```bash
# NIKDY nesdílejte v Plain textu
# Udržujte v .env souboru mimo git
# Změňte periodicky (doporučeno jednou za měsíc)

# Generování nového klíče
NEW_SECRET=$(openssl rand -hex 32)
echo "Nový X_CRON_SECRET: $NEW_SECRET"
# Pak aktualizujte v .env, crontabu a Lovable Cloud
```

---

## 📁 Struktura projektu

```
├── src/
│   ├── components/     # React komponenty (vč. ReminderTemplateEditor, LockoutMonitorPanel,
│   │                   #   AuditLogPanel, SecurityScanRunner, SecurityFindings, …)
│   ├── contexts/       # React contexts (AuthContext, AppModeContext)
│   ├── hooks/          # Custom hooks (useDeadlines, useTrainings, useSessionTimeout, …)
│   ├── pages/          # Stránky aplikace (Dashboard, AdminSettings, SecurityChecklist,
│   │                   #   Guides, Probations, InactiveEmployeesReport, …)
│   ├── lib/            # Utility funkce (migrationRegistry, dateFormat, csvExport,
│   │                   #   routeAccess, healthRisks, …)
│   └── integrations/   # Supabase client a auto-generované typy
├── supabase/
│   ├── functions/      # Edge funkce (Deno)
│   │   ├── send-training-reminders/  # Připomínky školení (SMTP)
│   │   ├── run-reminders/            # Sumární připomínky školení (SMTP)
│   │   ├── run-deadline-reminders/   # Připomínky technických událostí (SMTP)
│   │   ├── run-medical-reminders/    # Připomínky lékařských prohlídek (SMTP)
│   │   ├── send-test-email/          # Testovací SMTP email
│   │   ├── seed-initial-admin/       # Inicializace prvního admina
│   │   ├── apply-migrations/         # Aplikace migrací z migrationRegistry
│   │   ├── admin-create-user/        # Vytvoření uživatele (admin)
│   │   ├── admin-reset-password/     # Reset hesla (admin)
│   │   ├── admin-change-email/       # Změna emailu (admin)
│   │   ├── admin-deactivate-user/    # Deaktivace uživatele (admin)
│   │   ├── admin-delete-user/        # Smazání uživatele + cascade cleanup
│   │   ├── admin-link-employee/      # Propojení profilu se zaměstnancem
│   │   └── list-users/               # Seznam uživatelů
│   └── migrations/     # DB migrace (inkrementální, registrované v migrationRegistry.ts)
├── docker/
│   ├── .env.example    # Příklad ENV proměnných
│   ├── init-db.sql     # Bootstrap schéma pro self-hosted (NEEDITUJTE — generováno)
│   └── volumes/        # Konfigurace Supabase stacku (Kong, Realtime, …)
├── selfhosted-resources/
│   ├── env-example                  # Produkční .env šablona s hardening proměnnými
│   ├── README-selfhosted.md         # Návod pro self-hosted nasazení
│   └── nginx-reverseproxy/          # Vzorové konfigurace reverse proxy (HTTPS, CSP, HSTS)
├── Dockerfile          # Frontend Docker image (Nginx + bezpečnostní hlavičky)
├── Dockerfile.db       # PostgreSQL Docker image
├── docker-compose.yml                  # Režim A — Frontend + externí Supabase
├── docker-compose.supabase.yml         # Režim B — Self-hosted Supabase stack
├── docker-compose-production.yml       # Produkční overlay
├── docker-compose-selfhosted.yml       # Alternativní self-hosted compose
└── nginx.conf          # Nginx konfigurace (CSP, HSTS, X-Frame-Options, rate limiting)
```

## ❓ FAQ — Nejčastější problémy po nasazení

### Přihlášení a přístup

**Q: Po spuštění `seed-initial-admin` se nemůžu přihlásit**
- Ověřte, že Edge funkce vrátila úspěšnou odpověď (HTTP 200)
- Zkontrolujte, zda GoTrue (Auth) služba běží: `docker compose -f docker-compose.supabase.yml logs auth`
- Ujistěte se, že `SITE_URL` v `.env` odpovídá URL, na které přistupujete
- Zkuste vyčistit cache prohlížeče a cookies

**Q: Uživatel se přihlásí, ale vidí prázdnou stránku nebo "Nedostatečná oprávnění"**
- Zkontrolujte, zda má uživatel přiřazenou **roli** (Systém → Správa uživatelů)
- Ověřte, že profil má `approval_status = 'approved'`
- Pro Manažery a Uživatele: profil **musí být propojen se zaměstnancem** (`profiles.employee_id`)
- Zkontrolujte, zda má uživatel přiřazený **přístup k alespoň jednomu modulu** (trainings / deadlines / plp)

**Q: Manažer nevidí žádná data**
- Manažer vidí pouze záznamy zaměstnanců ve svém subtree (nadřízený → podřízení)
- Ověřte, že propojený zaměstnanec má správně nastaveného `manager_employee_id` v hierarchii
- Zkontrolujte RLS politiky v databázi

### E-maily a připomínky

**Q: Testovací email se neodešle**
- Ověřte SMTP konfiguraci v Administraci → Nastavení → E-mail
- Pro Gmail: použijte **App Password** (ne běžné heslo), povolte 2FA
- Zkontrolujte port: `587` (STARTTLS) nebo `465` (SMTPS)
- Podívejte se do logů Edge funkcí: `docker compose -f docker-compose.supabase.yml logs functions`

**Q: CRON připomínky se neodesílají**
- Ověřte, že `X_CRON_SECRET` je **shodný** v `.env`, crontabu a Lovable Cloud Secrets
- Zkontrolujte logy CRON kontejneru: `docker compose -f docker-compose.supabase.yml logs cron`
- Manuální test:
  ```bash
  curl -X POST "http://localhost:8000/functions/v1/send-training-reminders" \
    -H "x-cron-secret: VAS_SECRET"
  ```
- Ověřte, že existují aktivní šablony připomínek s platnými příjemci

**Q: Připomínky se odesílají, ale nikdo je nedostává**
- Zkontrolujte, zda šablona má nastavené **příjemce** (`target_user_ids`)
- Ověřte, že příjemci mají platnou e-mailovou adresu
- Podívejte se do logů odesílání: Stav systému → Historie odesílání
- Zkontrolujte spam/junk složku příjemce

### Import dat

**Q: Hromadný import zaměstnanců selže**
- CSV musí být v kódování **UTF-8** (pozor na Excel, který často ukládá v CP-1250)
- Povinné sloupce: `employee_number`, `first_name`, `last_name`, `email`, `position`, `status`
- Osobní číslo (`employee_number`) musí být **unikátní**
- E-mail musí být platný a unikátní

**Q: Po importu školení/lhůt jsou špatné stavy (vše červené)**
- Zkontrolujte formát dat: `YYYY-MM-DD` (ISO 8601)
- Ověřte, že `next_training_date` / `next_check_date` je v budoucnosti pro platné záznamy
- Stavy se počítají automaticky: platné (>30 dní), blíží se (≤30 dní), po termínu (v minulosti)

### Docker a infrastruktura

**Q: Kontejner se stále restartuje**
- Zkontrolujte logy: `docker compose -f docker-compose.supabase.yml logs <služba>`
- Časté příčiny: chybějící ENV proměnné, špatný `JWT_SECRET`, nedostupná databáze
- Ověřte dostatek RAM: `free -h` (doporučeno min. 4 GB pro self-hosted Supabase)

**Q: Edge funkce vrací 500 / "Internal Server Error"**
- Zkontrolujte logy: `docker compose -f docker-compose.supabase.yml logs functions`
- Ověřte, že `SERVICE_ROLE_KEY` je správně vygenerován z `JWT_SECRET`
- Zkontrolujte, zda funkce mají přístup k ENV proměnným (SMTP konfigurace atd.)

**Q: Databáze se neinicializuje správně**
- Smažte volume a spusťte znovu: `docker compose -f docker-compose.supabase.yml down -v && docker compose -f docker-compose.supabase.yml up -d`
- ⚠️ **Pozor**: `-v` smaže všechna data! Použijte pouze při čisté instalaci
- Zkontrolujte logy DB: `docker compose -f docker-compose.supabase.yml logs db`

**Q: Aplikace je pomalá / timeouty**
- Zkontrolujte vytížení serveru: `htop` nebo `docker stats`
- Ověřte connection pooler (Supavisor): `docker compose -f docker-compose.supabase.yml logs supavisor`
- Zvažte navýšení RAM nebo přidání swap: `sudo fallocate -l 2G /swapfile`

### Zálohy

**Q: Jak zálohovat databázi?**
```bash
# Záloha (self-hosted)
docker exec training-db pg_dump -U supabase_admin -d postgres > backup_$(date +%F).sql

# Obnova
cat backup_2025-01-15.sql | docker exec -i training-db psql -U supabase_admin -d postgres
```

**Q: Jak zálohovat úložiště souborů (Storage)?**
```bash
# Záloha storage volume
docker cp supabase-storage:/var/lib/storage ./storage-backup-$(date +%F)
```

### Upgrade na novou verzi

**Q: Jak aktualizovat aplikaci na novou verzi?**

Doporučený postup pro **zero-downtime update**:

```bash
# 1. Stáhněte novou verzi
cd /opt/training-system
git fetch origin
git pull origin main

# 2. Záloha databáze PŘED upgradem (povinné!)
docker exec training-db pg_dump -U supabase_admin -d postgres > backup_pre_upgrade_$(date +%F_%H%M).sql

# 3. Build nového frontend image (bez zastavení běžícího)
docker compose build frontend --no-cache

# 4. Rolling update frontendu (zero-downtime)
docker compose up -d --no-deps frontend

# 5. Ověření, že nová verze běží
docker ps | grep frontend
curl -s -o /dev/null -w "%{http_code}" http://localhost:80
```

**Q: Jak aplikovat migrace databázového schématu?**

Migrace jsou uloženy v `supabase/migrations/` a aplikují se automaticky při použití Lovable Cloud. Pro self-hosted nasazení:

```bash
# 1. Záloha (vždy před migrací!)
docker exec training-db pg_dump -U supabase_admin -d postgres > backup_pre_migration_$(date +%F).sql

# 2. Aplikování nových migrací
# Migrace se spouštějí ručně proti databázi:
for f in supabase/migrations/*.sql; do
  echo "Applying migration: $f"
  docker exec -i training-db psql -U supabase_admin -d postgres < "$f"
done

# 3. Ověření schématu
docker exec training-db psql -U supabase_admin -d postgres -c "\dt public.*"
```

> ⚠️ **Důležité**: Migrace jsou **inkrementální** — aplikujte pouze nové migrace od posledního upgradu. Sledujte soubory přidané mezi verzemi pomocí `git diff --name-only <stará-verze> <nová-verze> -- supabase/migrations/`.

**Q: Co dělat, když migrace selže?**

```bash
# 1. Zkontrolujte chybu v logu
docker exec training-db psql -U supabase_admin -d postgres < problematic_migration.sql 2>&1

# 2. Pokud je potřeba rollback databáze
cat backup_pre_migration_YYYY-MM-DD.sql | docker exec -i training-db psql -U supabase_admin -d postgres

# 3. Po opravě migrace zkuste znovu
docker exec -i training-db psql -U supabase_admin -d postgres < fixed_migration.sql
```

**Q: Jak provést upgrade self-hosted Supabase stacku?**

```bash
# 1. Záloha všeho
docker exec training-db pg_dump -U supabase_admin -d postgres > full_backup_$(date +%F).sql
docker cp supabase-storage:/var/lib/storage ./storage-backup-$(date +%F)

# 2. Aktualizujte verze images v docker-compose.supabase.yml
# Změňte verze služeb (gotrue, postgrest, realtime atd.) na nové

# 3. Stáhněte nové images
docker compose -f docker-compose.supabase.yml pull

# 4. Rolling restart služeb (databáze zůstává běžet)
docker compose -f docker-compose.supabase.yml up -d --no-deps auth rest realtime storage functions

# 5. Ověření
docker compose -f docker-compose.supabase.yml ps
docker compose -f docker-compose.supabase.yml logs --tail=20 auth rest
```

**Q: Jak ověřit kompatibilitu Edge funkcí po upgradu?**

```bash
# Test všech klíčových endpointů
endpoints=("send-training-reminders" "run-deadline-reminders" "run-medical-reminders" "list-users")
for ep in "${endpoints[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "http://localhost:8000/functions/v1/$ep" \
    -H "x-cron-secret: $X_CRON_SECRET")
  echo "$ep: HTTP $status"
done

# Test seed funkce (bezpečné — obsahuje pojistku proti duplicitám)
curl -s "http://localhost:8000/functions/v1/seed-initial-admin" | head -c 200
```

**Q: Jak naplánovat údržbové okno?**

| Krok | Doba | Výpadek |
|------|------|---------|
| Záloha DB | 1–5 min | ❌ Ne |
| Build nového image | 2–5 min | ❌ Ne |
| Aplikace migrací | 1–2 min | ⚠️ Možný (dle typu migrace) |
| Restart frontendu | 5–10 s | ⚠️ Krátký |
| Restart backend služeb | 10–30 s | ⚠️ Krátký |
| Ověření | 2–5 min | ❌ Ne |

> 💡 **Tip**: Plánujte upgrady mimo pracovní dobu. Nedestruktivní migrace (přidání sloupce, indexu) lze aplikovat i za běhu bez výpadku.

---

## 📚 Další zdroje

- [Lovable Docs](https://docs.lovable.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

## 📄 Licence

Proprietární software - všechna práva vyhrazena.

---

> Vytvořeno s ❤️ pomocí [Lovable](https://lovable.dev) — aplikaci vyvinul **EV**.
