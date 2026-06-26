# Orion

**Quiet Intelligence** — an AI-powered executive assistant for Gmail and Google Calendar.

Orion connects to your Google accounts, syncs mail and events in real time, and gives you an AI assistant that can summarize threads, draft replies, and schedule meetings — from one dashboard.

**Live:** [orion.arnabsamanta.in](https://orion.arnabsamanta.in)

---

## Tech stack

## Next.js 16, React 19, TypeScript, Tailwind CSS v4, tRPC v11, TanStack React Query, Express 5, PostgreSQL, Drizzle ORM, Corsair (Gmail + Calendar), OpenAI Agents, Google OAuth, SSE, pnpm,

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
cd trpc-monorepo
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

| Variable       | Required | Description                                                                                                                              |
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

Cookies are set on the **API host**; the web app calls tRPC on the same API host with `credentials: include`. Subdomains of the same domain (e.g. `*.arnabsamanta.in`) are same-site and work with `SameSite=Strict`.

---

### OpenAI

| Variable         | Required | Description                                              |
| ---------------- | -------- | -------------------------------------------------------- |
| `OPENAI_API_KEY` | Yes      | Powers Orion Intelligence (summarize, draft, agent chat) |

---

### Corsair — Gmail & Calendar

| Variable                        | Required | Description                                                                    |
| ------------------------------- | -------- | ------------------------------------------------------------------------------ |
| `CORSAIR_KEK`                   | Yes      | Encryption key for stored tokens, min 32 chars — `openssl rand -base64 32`     |
| `CORSAIR_CONNECT_REDIRECT_URI`  | Yes      | API OAuth callback for connect flow: `http://localhost:8000/connect/callback`  |
| `CORSAIR_GMAIL_REDIRECT_URI`    | Yes      | User-facing redirect after Gmail connect (can match web URL)                   |
| `CORSAIR_CALENDAR_REDIRECT_URI` | Yes      | User-facing redirect after Calendar connect                                    |
| `CORSAIR_WEBHOOK_BASE`          | Yes      | Public **HTTPS** base for webhooks (ngrok in dev, API domain in prod)          |
| `CORSAIR_WEBHOOK_SECRET`        | Yes      | Min 16 chars — appended as `?token=` on webhook URLs                           |
| `GMAIL_PUBSUB_TOPIC_ID`         | Yes\*    | GCP Pub/Sub topic for Gmail push, e.g. `projects/my-project/topics/gmail-push` |

\*Required for Gmail realtime sync via webhooks.

---

### Optional

| Variable              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `LOGGER_LEVEL`        | `debug` \| `info` \| `warn` \| `error`           |
| `PUBLIC_OPENAPI_DOCS` | `true` to expose `/docs`                         |
| `OPENAPI_DOCS_SECRET` | Protect `/docs` in production                    |
| `SKIP_ENV_VALIDATION` | Set `true` for Docker/CI builds without full env |

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

   **Production:**

   ```
   https://orionserver.arnabsamanta.in/auth/google/callback
   https://orionserver.arnabsamanta.in/connect/callback
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

   ```
   https://orionserver.arnabsamanta.in/webhooks/corsair?token=YOUR_CORSAIR_WEBHOOK_SECRET
   ```

   The URL must **exactly** match:

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

## Production deployment

Example split-host setup:

| Role | Host                                  |
| ---- | ------------------------------------- |
| Web  | `https://orion.arnabsamanta.in`       |
| API  | `https://orionserver.arnabsamanta.in` |

### Checklist

- [ ] `pnpm db:migrate` on production DB (use direct URL for migrate)
- [ ] `pnpm --filter @repo/api corsair:setup` on production DB
- [ ] API env: `NODE_ENV=prod`, `CLIENT_URL`, `CORS_ORIGIN`, `CORSAIR_WEBHOOK_*`
- [ ] Web env: `NEXT_PUBLIC_API_URL=https://orionserver.../trpc` → **rebuild web**
- [ ] Google Console redirect URIs updated for production API host
- [ ] Pub/Sub push subscription points to production webhook URL
- [ ] nginx forwards `Authorization` header for Pub/Sub: `proxy_set_header Authorization $http_authorization;`
- [ ] PM2 / process manager restarts after env changes

Deploy workflow (`.github/workflows/deploy.yml`): `git pull` → `pnpm install` → `pnpm db:migrate` → `pnpm build` → `pm2 restart all`

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

## Architecture notes

- **Auth:** JWT in httpOnly cookies on API host; CSRF token for tRPC mutations
- **Realtime:** SSE at `/events/stream` — Gmail/Calendar webhooks notify connected clients
- **AI:** `agent.runAgent` tRPC mutation → OpenAI via `@openai/agents`
- **Rate limiting:** Express limiters on `/auth`, `/connect`, `/trpc`; tRPC limits on auth + agent procedures

---

## Troubleshooting

| Issue                            | Fix                                                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.me` 401 after Google login | Align `GOOGLE_OAUTH_REDIRECT_URI` (API host), `CORS_ORIGIN`, `CLIENT_URL`, `NEXT_PUBLIC_API_URL`; see [Google OAuth](#google-oauth--sign-in) |
| `Integration "gmail" not found`  | Run `pnpm --filter @repo/api corsair:setup`                                                                                                  |
| Webhook 401                      | `CORSAIR_WEBHOOK_BASE` + `?token=` must match Pub/Sub subscription URL exactly; check nginx passes `Authorization`                           |
| SSL DB errors (Neon)             | Use SSL connection string; see `packages/database/pg.ts`                                                                                     |
| `NEXT_PUBLIC_*` not updating     | Rebuild web app after env change                                                                                                             |

---

## License

Private — All rights reserved.
