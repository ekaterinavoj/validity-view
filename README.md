# Systém správy školení a technických lhůt

Webová aplikace pro evidenci školení zaměstnanců a technických lhůt zařízení s automatickým systémem připomínek.

## 📋 Funkce

- **Evidence školení** - Správa školení zaměstnanců s automatickým výpočtem expirací
- **Technické lhůty** - Evidence technických kontrol a revizí zařízení
- **Automatické připomínky** - E-mailové notifikace před vypršením termínů
- **Správa zaměstnanců** - Hierarchie nadřízených, oddělení, statusy
- **Správa zařízení** - Evidence inventáře s přiřazením odpovědných osob
- **Audit log** - Kompletní historie změn
- **Uživatelské role** - Admin, Manager, User, Viewer

## 🛠️ Technologie

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **E-mail**: SMTP / Resend

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
```

### Proměnné prostředí

Aplikace vyžaduje následující proměnné (automaticky nastavené v Lovable):

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

## 🐳 Docker nasazení

### Rychlý start

```bash
# Build a spuštění (připojení k Supabase Cloud)
docker-compose up -d --build

# Sledování logů
docker-compose logs -f frontend
```

### Konfigurace

1. **Vytvořte `.env` soubor** v kořenovém adresáři:

```env
# Supabase Cloud credentials (povinné)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

2. **Build a spuštění**:

```bash
# Produkční build
docker-compose up -d --build

# Pouze frontend (připojení k cloud backendu)
docker build -t training-frontend \
  --build-arg VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
  --build-arg VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID \
  .

docker run -d -p 80:80 --name training-frontend training-frontend
```

### Docker Compose struktura

```yaml
# docker-compose.yml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
        - VITE_SUPABASE_PUBLISHABLE_KEY=${VITE_SUPABASE_PUBLISHABLE_KEY}
        - VITE_SUPABASE_PROJECT_ID=${VITE_SUPABASE_PROJECT_ID}
    ports:
      - "80:80"
    restart: unless-stopped
```

### Příkazy

| Příkaz | Popis |
|--------|-------|
| `docker-compose up -d` | Spustit kontejnery na pozadí |
| `docker-compose down` | Zastavit a odstranit kontejnery |
| `docker-compose logs -f` | Sledovat logy |
| `docker-compose build --no-cache` | Přestavět bez cache |
| `docker-compose restart frontend` | Restartovat frontend |

### Health check

```bash
# Ověření běhu kontejneru
docker-compose ps

# Test HTTP odpovědi
curl -I http://localhost:80/
```

## ⏰ Automatické připomínky (Cron)

Pro automatické odesílání připomínek nastavte cron job, který volá edge funkci:

### Příklad cron konfigurace

```bash
# Každý den v 8:00 (školení)
0 8 * * * curl -X POST \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://xgtwutpbojltmktprdui.supabase.co/functions/v1/run-reminders

# Každý den v 8:15 (technické lhůty)
15 8 * * * curl -X POST \
  -H "x-cron-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  https://xgtwutpbojltmktprdui.supabase.co/functions/v1/run-deadline-reminders
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
| `force` | Obejde časovou kontrolu ("due now") |

## 📧 SMTP Konfigurace

V administraci (Nastavení → E-mail) nastavte:

- **SMTP Host**: např. `smtp.gmail.com`
- **Port**: 587 (STARTTLS) nebo 465 (SMTPS)
- **Uživatel**: váš email
- **Heslo**: aplikační heslo (ne běžné heslo!)
- **Odesílatel**: email a jméno odesílatele

### Gmail specifika

Pro Gmail vytvořte [aplikační heslo](https://support.google.com/accounts/answer/185833):
1. Přejděte na Nastavení účtu Google → Zabezpečení
2. Zapněte 2FA (pokud není)
3. Vytvořte "Heslo aplikace" pro Mail

## 📁 Struktura projektu

```
├── src/
│   ├── components/     # React komponenty
│   ├── contexts/       # React contexts (Auth, AppMode)
│   ├── hooks/          # Custom hooks
│   ├── pages/          # Stránky aplikace
│   └── integrations/   # Supabase client a typy
├── supabase/
│   ├── functions/      # Edge funkce
│   └── migrations/     # DB migrace
├── docker/
│   └── init-db.sql     # Inicializační SQL
├── Dockerfile          # Frontend Docker image
├── docker-compose.yml  # Docker orchestrace
└── nginx.conf          # Nginx konfigurace
```

## 🔒 Bezpečnost

- Všechny tabulky mají RLS (Row Level Security) politiky
- Citlivé klíče ukládejte do environment proměnných
- Nikdy neukládejte hesla přímo do kódu
- Pro CRON používejte `X-CRON-SECRET` header

## 📚 Další zdroje

- [Lovable Docs](https://docs.lovable.dev)
- [Supabase Docs](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)

## 📄 Licence

Proprietární software - všechna práva vyhrazena.
