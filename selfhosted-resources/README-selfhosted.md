# Self-Hosted Deployment Guide

This guide covers deploying the Validity View (Training System) using `docker-compose-selfhosted.yml` with an nginx reverse proxy for HTTPS access.

## Stack Overview

| Service | Image | Role |
|---|---|---|
| `frontend` | `ghcr.io/ekaterinavoj/validity-view:latest` | React/Vite app served via nginx |
| `kong` | `kong:2.8.1` | API gateway (Supabase entry point) |
| `auth` | `supabase/gotrue` | Authentication (GoTrue) |
| `rest` | `postgrest/postgrest` | Auto-generated REST API |
| `realtime` | `supabase/realtime` | WebSocket subscriptions |
| `storage` | `supabase/storage-api` | File storage |
| `functions` | `supabase/edge-runtime` | Deno edge functions |
| `db` | `supabase/postgres` | PostgreSQL database |
| `cron` | `alpine` | Scheduled reminder jobs |
| `smtp` | `haravich/fake-smtp-server` | Local SMTP (dev/test only) |

## Prerequisites

- Docker Engine 24+ and Docker Compose v2
- A server with two public DNS records pointing to it:
  - `frontend.domain` — the web application
  - `frontend-api.domain` — the API / Supabase gateway
- nginx installed on the host
- Certbot for SSL certificates

## Deployment Steps

### 1. Clone the repository

```bash
git clone <repo-url>
cd validity-view
```

### 2. Create the `.env` file

Copy the example and edit it with your values:

```bash
cp selfhosted-resources/env-example .env
```

Open `.env` and update **all** values marked as secrets. See the [Environment Variables](#environment-variables) section below.

### 3. Generate secrets

Replace the placeholder values in `.env` with freshly generated secrets:

```bash
# PostgreSQL password
openssl rand -base64 32

# JWT secret (min 32 chars)
openssl rand -base64 32

# SECRET_KEY_BASE
openssl rand -hex 16

# X_CRON_SECRET
openssl rand -hex 32
```

For `ANON_KEY` and `SERVICE_ROLE_KEY`, generate JWT tokens signed with your `JWT_SECRET`:
see [Supabase self-hosting docs](https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys).

### 4. Set your domain names in `.env`

```dotenv
SITE_URL=https://frontend.domain
SITE_DOMAIN=frontend.domain
API_EXTERNAL_URL=https://frontend-api.domain
```

Replace `frontend.domain` and `frontend-api.domain` with your actual domain names throughout.

### 5. Start the stack

```bash
docker compose -f docker-compose-selfhosted.yml up -d
```

Check that all containers are healthy:

```bash
docker compose -f docker-compose-selfhosted.yml ps
```

### 6. Configure nginx reverse proxy

Two nginx site definitions are provided in `selfhosted-resources/nginx-reverseproxy/`.

**Frontend** (`nginx-reverseproxy/frontend`):
- Proxies `https://frontend.domain` → `http://127.0.0.1:8087` (frontend container)

**API** (`nginx-reverseproxy/frontend-api`):
- Proxies `https://frontend-api.domain` → `http://127.0.0.1:8091` (Kong gateway)

Copy the definitions to the nginx sites directory, replacing `frontend.domain` and `frontend-api.domain` with your actual domains:

```bash
# Replace placeholder domains in the files
sed 's/frontend\.domain/your-frontend.example.com/g' \
    selfhosted-resources/nginx-reverseproxy/frontend \
    > /etc/nginx/sites-available/frontend

sed -e 's/frontend\.domain/your-api.example.com/g' \
    selfhosted-resources/nginx-reverseproxy/frontend-api \
    > /etc/nginx/sites-available/frontend-api

ln -s /etc/nginx/sites-available/frontend    /etc/nginx/sites-enabled/frontend
ln -s /etc/nginx/sites-available/frontend-api /etc/nginx/sites-enabled/frontend-api
```

### 7. Obtain SSL certificates with Certbot

```bash
certbot --nginx -d your-frontend.example.com -d your-api.example.com
```

Certbot will update the nginx configuration with certificate paths and enable automatic HTTP → HTTPS redirects.

Reload nginx:

```bash
nginx -t && systemctl reload nginx
```

### 8. Seed the initial admin user

After the stack is up, trigger the initial admin seeding edge function:

```bash
curl -X POST https://your-api.example.com/functions/v1/seed-initial-admin \
  -H "Content-Type: application/json"
```

---

## Environment Variables

Key variables in `.env` (see `selfhosted-resources/env-example` for the full list):

### Ports

| Variable | Default | Description |
|---|---|---|
| `FRONTEND_PORT` | `8087` | Host port for the frontend container |
| `KONG_HTTP_PORT` | `8091` | Host port for the Kong API gateway |
| `KONG_HTTPS_PORT` | `8443` | Host port for Kong HTTPS (not used when nginx terminates SSL) |

### Database

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | **Change this.** PostgreSQL password used by all services |
| `POSTGRES_DB` | Database name (default: `postgres`) |
| `POSTGRES_PORT` | Internal DB port (default: `5432`) |

### Secrets — change all of these before deploying

| Variable | Description |
|---|---|
| `JWT_SECRET` | Signs all JWTs; must be at least 32 characters |
| `ANON_KEY` | Public JWT for anonymous API access |
| `SERVICE_ROLE_KEY` | JWT with full DB access; keep private |
| `SECRET_KEY_BASE` | Encryption key for Realtime service |
| `DASHBOARD_PASSWORD` | Password for the Kong Supabase dashboard basic auth |
| `X_CRON_SECRET` | Shared secret protecting cron-triggered edge functions |

### URLs

| Variable | Example | Description |
|---|---|---|
| `SITE_URL` | `https://frontend.domain` | Public URL of the frontend application |
| `SITE_DOMAIN` | `frontend.domain` | Domain of the frontend (used in Kong config) |
| `API_EXTERNAL_URL` | `https://frontend-api.domain` | Public URL of the API gateway; used by GoTrue and the frontend |

### Authentication

| Variable | Default | Description |
|---|---|---|
| `DISABLE_SIGNUP` | `true` | Disables public self-registration; users are created by admin functions |
| `ENABLE_EMAIL_AUTOCONFIRM` | `true` | Skip email confirmation on registration |
| `JWT_EXPIRY` | `3600` | JWT lifetime in seconds |

### SMTP

| Variable | Description |
|---|---|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP port (25, 465, 587) |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials (leave blank if not required) |
| `SMTP_ADMIN_EMAIL` | Sender address for auth emails |
| `SMTP_FROM` | Sender address for edge function emails (reminders) |

> **Note:** The stack includes a `smtp` container (`haravich/fake-smtp-server`) for development. It exposes a web UI on port `8089` and accepts mail internally on port `2500`. For production, point `SMTP_HOST` at a real mail server and remove or comment out the `smtp` service.

---

## CRON Jobs

The `cron` container runs reminder jobs every hour automatically:

| Schedule | Edge Function | Purpose |
|---|---|---|
| Every hour `:00` | `send-training-reminders` | Training expiry reminders |
| Every hour `:00` | `run-deadline-reminders` | Technical event deadlines |
| Every hour `:00` | `run-medical-reminders` | Medical check-up reminders |

Jobs authenticate to the Kong gateway using `X_CRON_SECRET`. Set a strong random value in `.env`.

---

## Management Commands

**Start:**
```bash
docker compose -f docker-compose-selfhosted.yml up -d
```

**Stop:**
```bash
docker compose -f docker-compose-selfhosted.yml down
```

**View logs:**
```bash
docker compose -f docker-compose-selfhosted.yml logs -f
```

**Full reset (destroys all data):**
```bash
docker compose -f docker-compose-selfhosted.yml down -v --remove-orphans
```

---

## Data Persistence

The following Docker volumes hold persistent data:

| Volume | Contents |
|---|---|
| `db_data` | PostgreSQL data directory |
| `db_config` | PostgreSQL custom configuration |
| `storage_data` | Uploaded files (Supabase Storage) |

Back up these volumes before performing a full reset or migrating the server.
