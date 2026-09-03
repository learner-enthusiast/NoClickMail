# Orion

**Quiet Intelligence** — an AI-powered executive assistant for Gmail and Google Calendar.

Orion connects to your Google accounts, syncs mail and events in real time, and gives you an AI assistant that can summarize threads, draft replies, and schedule meetings — from one dashboard.

**Live:** [orion.arnabsamanta.in](https://orion.arnabsamanta.in)

---

## Tech stack

Next.js 16, React 19, TypeScript, Tailwind CSS v4, tRPC v11, TanStack React Query, Express 5, PostgreSQL, Drizzle ORM, Corsair (Gmail + Calendar), OpenAI, Pinecone (RAG), Inngest (background jobs), Google OAuth, SSE, Docker, pnpm, Turborepo.

## Monorepo structure

```
apps/
  web/          Next.js frontend (dashboard, inbox, calendar, AI chat)
  api/          Express API (tRPC, OAuth, webhooks, SSE)

packages/
  trpc/         tRPC routers, auth middleware, procedures
  services/     Gmail, Calendar, Chat/Agent, Corsair, User services
  database/     Drizzle schema, migrations, Postgres client
  logger/       Structured logging
```

---

## Architecture

### Application overview

```mermaid
flowchart TB
  subgraph browser [Browser]
    Web[Next.js web]
  end

  subgraph api [Express API]
    TRPC["/trpc — tRPC"]
    Auth["/auth — Google sign-in"]
    Connect["/connect — Corsair OAuth"]
    WH["/webhooks — Gmail Pub/Sub"]
    SSE["/events — SSE stream"]
    Inngest["/api/inngest — Inngest"]
  end

  subgraph data [Data & AI]
    PG[(PostgreSQL)]
    Pinecone[(Pinecone RAG)]
    OpenAI[OpenAI API]
  end

  subgraph external [External]
    Google[Google OAuth / Gmail / Calendar]
    InngestCloud[Inngest Cloud]
  end

  Web -->|tRPC + cookies| TRPC
  Web -->|OAuth proxy| Auth
  TRPC --> PG
  Connect --> Google
  WH --> Google
  TRPC --> OpenAI
  TRPC --> Pinecone
  Inngest --> InngestCloud
  Inngest --> Pinecone
```

| Layer | Responsibility |
| ----- | -------------- |
| **apps/web** | Dashboard UI, inbox, calendar, Orion Intelligence chat. Proxies Google OAuth callback so cookies land on the web origin in dev. |
| **apps/api** | tRPC server, JWT auth, Corsair connect flow, Gmail/Calendar webhooks, SSE, Inngest handler, OpenAPI docs. |
| **packages/trpc** | Routers, auth middleware, agent procedures. |
| **packages/services** | Gmail, Calendar, Corsair, RAG ingest, OpenAI embeddings, user service. |
| **packages/database** | Drizzle schema, migrations, Postgres client. |

### Request flow (authenticated tRPC)

1. Browser calls `NEXT_PUBLIC_API_URL` with `credentials: include` and CSRF header.
2. API validates JWT from httpOnly cookie → builds tRPC context.
3. Procedures read/write Postgres; agent path may trigger Inngest → Pinecone RAG ingest.
4. Gmail/Calendar changes arrive via Pub/Sub webhook → SSE notifies connected clients.

### Deployment modes

| Mode | When | Doc section |
| ---- | ---- | ----------- |
| **Local dev** | Day-to-day development | [Quick start](#quick-start-local) |
| **Home-server Docker** | Self-hosted via GitHub Actions + SSH | [Home-server deployment](#home-server-deployment) |

---

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** 9 (`corepack enable && corepack prepare pnpm@9.0.0 --activate`)
- **Docker** (for local Postgres) or a hosted Postgres URL (Neon, Supabase, etc.)
- **Google Cloud project** with OAuth credentials + Gmail Pub/Sub (for push sync)
- **OpenAI API key** (for Orion Intelligence chat)

---

## Quick start (local)

### 1. Clone and install

```bash
git clone <repo-url>
cd NoClickMail
pnpm install
```

### 2. Environment

```bash
cp .env.example .env
```

Fill in `.env` — see [Environment variables](#environment-variables) below.

### 3. Start Postgres

```bash
docker compose up -d
```

Default local URL: `postgresql://postgres:postgres@localhost:5432/dev`

### 4. Run migrations

```bash
pnpm db:migrate
```

### 5. Corsair setup (required once per database)

Creates `corsair_integrations` rows and stores encrypted Google OAuth credentials for Gmail and Calendar plugins:

```bash
pnpm --filter @repo/api corsair:setup
```

You should see `✓ gmail` and `✓ googlecalendar` in the output.

### 6. Start dev servers

```bash
pnpm dev
```

| Service  | URL                        |
| -------- | -------------------------- |
| Web      | http://localhost:3000      |
| API      | http://localhost:8000      |
| tRPC     | http://localhost:8000/trpc |
| API docs | http://localhost:8000/docs |

### 7. First-time app flow

1. Open http://localhost:3000 → **Sign in with Google**
2. In the header, open **Connections** (refresh icon) → **Connect** Gmail and Google Calendar
3. Open **Inbox** / **Calendar** — data loads via Corsair
4. Use **Orion Intelligence** (right panel) to summarize, draft, or create calendar invites

---

## Environment variables

Copy `.env.example` to `.env` at the **repo root**. All apps and packages load from this file.

### Database

| Variable       | Requires | Description                                                                                                                              |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | Postgres connection string. Local: `postgresql://postgres:postgres@localhost:5432/dev`. For Neon/Supabase use the pooled URL at runtime. |

**Migrations on hosted Postgres:** use a **direct** (non-pooler) URL when running `pnpm db:migrate`, e.g. `DATABASE_URL_DIRECT` — Neon pooler URLs can fail on DDL.

---

### API server

| Variable      | Required | Description                                                                         |
| ------------- | -------- | ----------------------------------------------------------------------------------- |
| `PORT`        | No       | API port (default `8000`)                                                           |
| `BASE_URL`    | No       | Public API base URL (default `http://localhost:8000`)                               |
| `CLIENT_URL`  | Yes      | Web app URL — used for OAuth redirects after login/connect                          |
| `CORS_ORIGIN` | Yes      | Web origin allowed for credentialed tRPC requests (must match `CLIENT_URL` exactly) |
| `NODE_ENV`    | No       | `development` \| `prod` \| `production` — controls secure cookies                   |

---

### JWT auth

| Variable               | Required | Description                                |
| ---------------------- | -------- | ------------------------------------------ |
| `ACCESS_TOKEN_SECRET`  | Yes      | Min 32 chars — `openssl rand -base64 32`   |
| `REFRESH_TOKEN_SECRET` | Yes      | Min 32 chars — separate from access secret |
| `ACCESS_TOKEN_EXPIRY`  | No       | Default `1d`                               |
| `REFRESH_TOKEN_EXPIRY` | No       | Default `30d`                              |

---

### Frontend

| Variable              | Required | Description                                                                                                        |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_API_URL` | Yes      | Browser tRPC endpoint, e.g. `http://localhost:8000/trpc`. **Baked in at build time** — rebuild web after changing. |
| `API_INTERNAL_URL`    | No       | Server-side Next.js → API URL (OAuth proxy route). Default `http://localhost:8000`                                 |

---

### Google OAuth — sign-in

Used for **logging into Orion** (not the same flow as connecting Gmail in the dashboard).

| Variable                     | Required | Description                                                                                  |
| ---------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `GOOGLE_OAUTH_CLIENT_ID`     | Yes      | From [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Yes      | OAuth 2.0 client secret                                                                      |
| `GOOGLE_OAUTH_REDIRECT_URI`  | Yes      | Must match a **Authorized redirect URI** in Google Console exactly                           |

**Local dev (API-direct callback — recommended):**

```
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/auth/google/callback
```

**Production (split subdomains — web on `orion.*`, API on `orionserver.*`):**

```
GOOGLE_OAUTH_REDIRECT_URI=https://orionserver.arnabsamanta.in/auth/google/callback
CLIENT_URL=https://orion.arnabsamanta.in
CORS_ORIGIN=https://orion.arnabsamanta.in
NEXT_PUBLIC_API_URL=https://orionserver.arnabsamanta.in/trpc
```

**Home-server (single domain — nginx proxies API paths):**

```
CLIENT_URL=https://orion.example.com
# GOOGLE_OAUTH_REDIRECT_URI defaults to https://orion.example.com/auth/google/callback
# NEXT_PUBLIC_API_URL=/trpc (set at Docker build)
```

Cookies on home-server deploy use same-origin `/trpc`; set `COOKIE_DOMAIN` if you also serve other subdomains on the same parent domain.

---

### OpenAI & RAG (Pinecone)

| Variable                      | Required (prod) | Description                                      |
| ----------------------------- | --------------- | ------------------------------------------------ |
| `OPENAI_API_KEY`              | Yes             | Orion Intelligence + embedding generation        |
| `PINECONE_API_KEY`            | Yes             | Vector store for RAG                             |
| `PINECONE_INDEX`              | Yes             | Pinecone index name                              |
| `OPENAI_EMBEDDING_MODEL`      | No              | Default `text-embedding-3-small`                 |
| `OPENAI_EMBEDDING_DIMENSIONS` | Yes             | Must match Pinecone index dimension (1024/1536)  |
| `RAG_CHUNK_SIZE`              | No              | Default `600`                                    |
| `RAG_CHUNK_OVERLAP`           | No              | Default `80`                                     |

---

### Inngest (background jobs)

| Variable              | Required (prod) | Description                                           |
| --------------------- | --------------- | ----------------------------------------------------- |
| `INNGEST_DEV`         | Local only      | Set `1` for local dev with `inngest dev`              |
| `INNGEST_EVENT_KEY`   | Yes             | From [app.inngest.com](https://app.inngest.com)       |
| `INNGEST_SIGNING_KEY` | Yes             | Verifies Inngest webhook calls to `/api/inngest`    |

RAG ingest runs as Inngest functions triggered on user messages.

---

### Corsair — Gmail & Calendar

| Variable                        | Required | Default (if unset)                          |
| ------------------------------- | -------- | ------------------------------------------- |
| `CORSAIR_KEK`                   | Yes      | —                                           |
| `CORSAIR_WEBHOOK_SECRET`        | Yes      | Min 16 chars — Pub/Sub `?token=`            |
| `GMAIL_PUBSUB_TOPIC_ID`         | Yes      | GCP topic for Gmail push                    |
| `CORSAIR_CONNECT_REDIRECT_URI`  | No       | `${CLIENT_URL}/connect/callback`            |
| `CORSAIR_GMAIL_REDIRECT_URI`    | No       | `${CLIENT_URL}/dashboard/inbox`             |
| `CORSAIR_CALENDAR_REDIRECT_URI` | No       | `${CLIENT_URL}/dashboard/calendar`          |
| `CORSAIR_WEBHOOK_BASE`          | No       | `BASE_URL` or `CLIENT_URL`                  |
| `COOKIE_DOMAIN`                 | No       | e.g. `.example.com` for subdomain cookies   |

---

### Optional

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `LOGGER_LEVEL`        | `debug` \| `info` \| `error`                     |
| `PUBLIC_OPENAPI_DOCS` | `true` to expose `/docs` (default `true` in dev, `false` in prod) |
| `SKIP_ENV_VALIDATION` | Set `true` for Docker/CI builds without full env |
| `DATABASE_URL_DIRECT` | Direct Postgres URL for migrations / db sync   |

See `.env.example` for local, split-host, and home-server examples.

---

## Google Cloud setup

### A. OAuth client (sign-in + Corsair)

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create **OAuth 2.0 Client ID** (Web application)
3. Add **Authorized redirect URIs**:

   **Local:**

   ```
   http://localhost:8000/auth/google/callback
   http://localhost:8000/connect/callback
   ```

   **Split-host production:**

   ```
   https://orionserver.example.com/auth/google/callback
   https://orionserver.example.com/connect/callback
   ```

   **Home-server production (single domain via nginx):**

   ```
   https://orion.example.com/auth/google/callback
   https://orion.example.com/connect/callback
   ```

4. Copy **Client ID** and **Client secret** into `.env` as `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`

### B. Enable APIs

In **APIs & Services → Library**, enable:

- Gmail API
- Google Calendar API

### C. Gmail push notifications (Pub/Sub)

1. Create a **Pub/Sub topic** in the same GCP project
2. Grant Gmail publish permission on the topic (Google's docs: `gmail-push` setup)
3. Set `GMAIL_PUBSUB_TOPIC_ID=projects/YOUR_PROJECT/topics/YOUR_TOPIC`
4. Create a **Push subscription** with endpoint:

   **Split-host:**

   ```
   https://orionserver.example.com/webhooks/corsair?token=YOUR_CORSAIR_WEBHOOK_SECRET
   ```

   **Home-server (single domain):**

   ```
   https://orion.example.com/webhooks/corsair?token=YOUR_CORSAIR_WEBHOOK_SECRET
   ```

   Must match exactly:

   ```
   ${CORSAIR_WEBHOOK_BASE}/webhooks/corsair?token=${CORSAIR_WEBHOOK_SECRET}
   ```

5. Enable **authentication** on the push subscription (Google sends a Bearer JWT; the API verifies it)

**Dev:** use ngrok or Cloudflare Tunnel for `CORSAIR_WEBHOOK_BASE` and point the subscription at that HTTPS URL.

### D. OAuth scopes (Corsair connect)

When users click **Connect** in the dashboard, they authorize Gmail and Calendar via `/connect/gmail` and `/connect/googlecalendar`. Uses the same Google OAuth client credentials stored by `corsair:setup`.

---

## Corsair setup (detailed)

Corsair is the integration layer for Gmail and Google Calendar. Before any user can load inbox or calendar data, the **server-side integration records** must exist in Postgres.

### What `corsair:setup` does

```bash
pnpm --filter @repo/api corsair:setup
```

Script: `apps/api/src/scripts/corsair-setup.ts`

1. Runs `setupCorsair()` — creates rows in `corsair_integrations` for `gmail` and `googlecalendar`
2. Encrypts and stores `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` per integration (using `CORSAIR_KEK`)

### When to re-run

- Fresh database / after `db:migrate` on empty DB
- Changed `CORSAIR_KEK` (will need re-setup)
- Changed Google OAuth client credentials

### Per-user connect (after setup)

1. User signs in to Orion
2. Header → **Connections** → **Connect** on Gmail / Google Calendar
3. Browser → `GET /connect/gmail` or `/connect/googlecalendar` (API)
4. Google OAuth → `GET /connect/callback` → tokens stored per user (`tenantId` = user id)
5. Gmail watch + Calendar watch registered (webhooks)

### Troubleshooting: `Integration "gmail" not found`

Means `corsair:setup` was not run on this database. Run it and restart the API.

---

## Split-host production

Web and API on **separate subdomains** (manual deploy on a VPS with `pnpm build` + process manager of your choice).

| Role | Host                            |
| ---- | ------------------------------- |
| Web  | `https://orion.example.com`     |
| API  | `https://orionserver.example.com` |

```env
CLIENT_URL=https://orion.example.com
BASE_URL=https://orionserver.example.com
CORS_ORIGIN=https://orion.example.com
NEXT_PUBLIC_API_URL=https://orionserver.example.com/trpc
GOOGLE_OAUTH_REDIRECT_URI=https://orionserver.example.com/auth/google/callback
CORSAIR_CONNECT_REDIRECT_URI=https://orionserver.example.com/connect/callback
CORSAIR_WEBHOOK_BASE=https://orionserver.example.com
```

### Checklist

- [ ] `pnpm db:migrate` on production DB (use direct URL for migrate)
- [ ] `pnpm --filter @repo/api corsair:setup` on production DB
- [ ] Web rebuilt after changing `NEXT_PUBLIC_API_URL`
- [ ] Google Console redirect URIs on API host
- [ ] Pub/Sub push subscription on API webhook URL
- [ ] nginx forwards `Authorization` for Pub/Sub JWT verification

---

## Home-server deployment

Self-hosted Docker stack on a home server. GitHub Actions builds images, transfers them over SSH (Cloudflare Access), and runs `docker compose`.

**Workflow:** `.github/workflows/homeserver-deploy.yml`

### Home-server architecture

```mermaid
flowchart TB
  subgraph ci [GitHub Actions]
    Build[Build API + Web images]
    Save[docker save → tar.gz]
    SCP[SCP via cloudflared SSH]
  end

  subgraph tunnel [Cloudflare]
    CF[Cloudflare Tunnel]
  end

  subgraph server [Home server Docker]
    Proxy[nginx :8080]
    Web[web — Next.js :3000]
    API[api — Express :8000]
    PG[(postgres — pg_data volume)]
    Sync[db-sync — daily backup]
  end

  subgraph remote [Remote cloud]
    Neon[(Neon Postgres backup)]
    Pinecone[(Pinecone)]
    Inngest[Inngest Cloud]
    Google[Google APIs]
  end

  Build --> Save --> SCP
  SCP --> server
  CF -->|HTTPS| Proxy
  Proxy -->|"/"| Web
  Proxy -->|"/trpc /auth /connect /webhooks"| API
  Web -->|API_INTERNAL_URL| API
  API --> PG
  API --> Pinecone
  API --> Inngest
  API --> Google
  Sync -->|pg_dump daily| Neon
  PG --> Sync
```

### Docker Compose services

| Service    | Image / role | Notes |
| ---------- | ------------ | ----- |
| `postgres` | postgres:15  | Primary database; data in `pg_data` volume |
| `api`      | noclickmail-api | Runs migrations on start; tRPC, webhooks, Inngest |
| `web`      | noclickmail-web | Next.js standalone; `NEXT_PUBLIC_API_URL=/trpc` |
| `proxy`    | nginx        | Single public port (`EXTERNAL_PORT` — host → container `:80`) |
| `db-sync`  | postgres:15  | Daily `pg_dump` → remote `SYNC_DATABASE_URL` (Neon) |

Nginx routes (all on `CLIENT_URL`):

| Path | Backend |
| ---- | ------- |
| `/` | Next.js web |
| `/trpc`, `/auth`, `/connect`, `/webhooks`, `/events`, `/api`, `/docs` | Express API |

### Deploy flow

1. Push to `main` (or manual workflow dispatch)
2. CI builds `noclickmail-api` and `noclickmail-web` Docker images
3. Images exported as `noclickmail-images.tar.gz`
4. SCP tarball + `docker-compose.deploy.yml` + `nginx.deploy.conf` + `.env` to server
5. Server: `docker load` → `docker compose up -d`
6. Health check: `GET /` and `GET /health` on localhost:`EXTERNAL_PORT`

### Database strategy

- **Runtime:** app uses **local Postgres** in Docker (`postgresql://postgres:PASS@postgres:5432/noclickmail`)
- **Backup:** `db-sync` pushes a full dump to **remote Neon** (`DATABASE_URL` GitHub secret) every 24h
- **Retry:** 5 attempts per batch, 1h wait between batches until success

Point Cloudflare Tunnel at `http://127.0.0.1:EXTERNAL_PORT` (set via GitHub secret).

### Home-server env model

Secrets live in **GitHub repository secrets**. The workflow generates `.env` on the server — you do not edit `.env` manually on deploy.

| GitHub secret | Role |
| ------------- | ---- |
| `CLIENT_URL` | Public URL (e.g. `https://orion.example.com`) — also `BASE_URL` |
| `DATABASE_URL` | Remote Neon URL for daily sync |
| `POSTGRES_PASSWORD` | Local Postgres password (keep stable) |
| `PINECONE_*`, `INNGEST_*`, `OPENAI_*` | RAG pipeline |
| `CORSAIR_*`, `GMAIL_PUBSUB_TOPIC_ID` | Gmail/Calendar |
| `EXTERNAL_PORT` | Host port Docker binds (e.g. `8080`) — tunnel targets `http://127.0.0.1:EXTERNAL_PORT` |

Full secret list is documented in the workflow header (`.github/workflows/homeserver-deploy.yml`).

### One-time server setup

```bash
# Install Docker + Compose plugin, then:
mkdir -p /opt/noclickmail
```

**Corsair setup (once per fresh database):** the production API image does not include the setup script. From your dev machine, SSH-tunnel to the home server's Postgres and run:

```bash
# Terminal 1 — tunnel local 5433 → server postgres:5432
ssh -L 5433:127.0.0.1:5432 user@homeserver

# Terminal 2 — from repo root, point at tunneled DB
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5433/noclickmail \
  pnpm --filter @repo/api corsair:setup
```

Use the same `CORSAIR_KEK` and Google OAuth values as in GitHub secrets.

### Home-server Google Console

Single domain — register on `CLIENT_URL`:

```
https://orion.example.com/auth/google/callback
https://orion.example.com/connect/callback
```

Webhook:

```
https://orion.example.com/webhooks/corsair?token=YOUR_SECRET
```

### Useful commands on the server

```bash
cd /opt/noclickmail

# Status
docker compose -f docker-compose.deploy.yml ps

# Logs
docker compose -f docker-compose.deploy.yml logs -f api
docker compose -f docker-compose.deploy.yml logs -f db-sync
docker compose -f docker-compose.deploy.yml logs migrate

# Manual staged deploy (same as CI)
DEPLOY_SHA=manual ./deploy-remote.sh

# Restart after manual .env edit (normally CI overwrites .env)
docker compose -f docker-compose.deploy.yml --env-file .env up -d
```

### Docker files reference

| File | Purpose |
| ---- | ------- |
| `docker/Dockerfile.api` | Express API (tsup bundle) |
| `docker/Dockerfile.web` | Next.js standalone |
| `docker-compose.deploy.yml` | Production stack |
| `docker/nginx.deploy.conf` | Reverse proxy rules |
| `docker/db-sync-entrypoint.sh` | Daily Neon backup + retry logic |
| `docker/deploy-remote.sh` | Staged deploy + diagnostics (used by CI over SSH) |
| `apps/api/migrate.mjs` | Drizzle migrations (run by `migrate` service) |

---

## Scripts

| Command                                 | Description                            |
| --------------------------------------- | -------------------------------------- |
| `pnpm dev`                              | Start web + API in dev mode            |
| `pnpm build`                            | Build all apps                         |
| `pnpm db:migrate`                       | Apply Drizzle migrations               |
| `pnpm db:generate`                      | Generate migration from schema changes |
| `pnpm --filter @repo/api corsair:setup` | Initialize Corsair integrations        |
| `pnpm lint`                             | Lint all packages                      |
| `pnpm check-types`                      | Typecheck all packages                 |

---

## Runtime notes

- **Auth:** JWT in httpOnly cookies; CSRF token for tRPC mutations. Home-server: same-origin `/trpc` via nginx.
- **Realtime:** SSE at `/events/stream` — webhooks notify connected clients.
- **AI / RAG:** Agent messages → Inngest → chunk + embed → Pinecone upsert.
- **Rate limiting:** Express limiters on `/auth`, `/connect`, `/trpc`.

---

## Troubleshooting

| Issue                            | Fix                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.me` 401 after Google login | Align `GOOGLE_OAUTH_REDIRECT_URI`, `CORS_ORIGIN`, `CLIENT_URL`, `NEXT_PUBLIC_API_URL`                                                          |
| `Integration "gmail" not found`  | Run `pnpm --filter @repo/api corsair:setup` on the active database                                                                           |
| Webhook 401                      | `CORSAIR_WEBHOOK_BASE` + `?token=` must match Pub/Sub URL; nginx must pass `Authorization`                                                   |
| SSL DB errors (Neon)             | Use `sslmode=require` in connection string                                                                                                   |
| `NEXT_PUBLIC_*` not updating     | Rebuild web image / `pnpm build` after env change                                                                                            |
| Home-server db-sync fails        | Use Neon **direct** URL in `DATABASE_URL_DIRECT`; pooler URLs fail `pg_restore`                                                            |
| RAG not ingesting                | Verify `PINECONE_*`, `INNGEST_*`, `OPENAI_EMBEDDING_DIMENSIONS` match index; check `docker compose logs api`                                 |

---

## License

Private — All rights reserved.
