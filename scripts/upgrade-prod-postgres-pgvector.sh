#!/usr/bin/env bash
# Upgrade production Postgres to pgvector without losing data, then run Drizzle migrations.
#
# Safe when moving postgres:15 → pgvector/pgvector:pg15 on the same pg_data volume (same major version).
#
# Usage (on Ubuntu server, from repo root):
#   chmod +x scripts/upgrade-prod-postgres-pgvector.sh
#   ./scripts/upgrade-prod-postgres-pgvector.sh
#
# Requires in .env:
#   DATABASE_URL (or DATABASE_URL_DIRECT) — user, password, host, port, db name are read from this
#   POSTGRES_* vars optional overrides for Docker compose

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod-db.yml}"
ENV_FILE="${ENV_FILE:-.env}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups/postgres}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

log() { echo ""; echo "=== $* ==="; }

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} at repo root" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

MIGRATE_DATABASE_URL="${DATABASE_URL_DIRECT:-${DATABASE_URL:-}}"
if [[ -z "${MIGRATE_DATABASE_URL}" ]]; then
  echo "DATABASE_URL (or DATABASE_URL_DIRECT) must be set in ${ENV_FILE}" >&2
  exit 1
fi

eval "$(node -e "
  const raw = process.argv[1];
  const u = new URL(raw.replace(/^postgresql:/, 'http:'));
  const db = u.pathname.replace(/^\\//, '') || 'postgres';
  const user = decodeURIComponent(u.username || 'postgres');
  const pass = decodeURIComponent(u.password || '');
  const port = u.port || '5432';
  const host = u.hostname;
  const emit = (k, v) => console.log('export ' + k + '=' + JSON.stringify(v));
  emit('PARSED_DB_USER', user);
  emit('PARSED_DB_NAME', db);
  emit('PARSED_DB_PORT', port);
  emit('PARSED_DB_HOST', host);
  emit('PARSED_DB_PASSWORD', pass);
" "${MIGRATE_DATABASE_URL}")"

POSTGRES_USER="${POSTGRES_USER:-${PARSED_DB_USER}}"
POSTGRES_DB="${POSTGRES_DB:-${PARSED_DB_NAME}}"
POSTGRES_PORT="${POSTGRES_PORT:-${PARSED_DB_PORT}}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-${PARSED_DB_PASSWORD:-}}"

if [[ -z "${POSTGRES_PASSWORD}" ]]; then
  echo "Postgres password missing — set POSTGRES_PASSWORD or include it in DATABASE_URL" >&2
  exit 1
fi

export POSTGRES_USER POSTGRES_DB POSTGRES_PORT POSTGRES_PASSWORD

log "Using database from .env: ${PARSED_DB_HOST}:${POSTGRES_PORT}/${POSTGRES_DB} (user: ${POSTGRES_USER})"

log "Pull pgvector Postgres image"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" pull postgres

log "Backup database to ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}-${TIMESTAMP}.sql.gz"

if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps postgres 2>/dev/null | grep -q "Up"; then
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --no-acl \
    | gzip > "${BACKUP_FILE}"
  log "Backup saved: ${BACKUP_FILE}"
else
  log "Postgres not running yet — skipping live backup (fresh volume or first start)"
fi

log "Start / upgrade Postgres (pgvector/pgvector:pg15, same pg_data volume)"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" up -d postgres

log "Wait for Postgres healthy"
for _ in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

log "Verify pgvector extension (migration 0007 also runs CREATE EXTENSION IF NOT EXISTS vector)"
docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"

docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
  psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "\\dx vector"

log "Run Drizzle migrations (0007 pgvector, 0008/0009 image_url, etc.)"
pnpm db:migrate

log "Done. Postgres on 127.0.0.1:${POSTGRES_PORT}, volume pg_data preserved."
echo "Restart the app when ready: sudo systemctl restart orion  (or scripts/restart-orion.sh)"
