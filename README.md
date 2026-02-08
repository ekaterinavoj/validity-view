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

1. Otevřete aplikaci v prohlížeči: `http://vasedomena.cz`
2. Zaregistrujte se jako první uživatel (automaticky získá roli admin)
3. V administraci nakonfigurujte SMTP pro odesílání emailů
4. Nastavte CRON_SECRET v Lovable Cloud

### 9. Checklist po instalaci

- [ ] Docker kontejner běží (`docker ps`)
- [ ] Aplikace je dostupná v prohlížeči
- [ ] První admin uživatel vytvořen
- [ ] SMTP nakonfigurován a otestován
- [ ] CRON úlohy nastaveny
- [ ] CRON_SECRET synchronizován s Lovable Cloud
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
