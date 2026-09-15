#!/usr/bin/env bash
# Upgrade production Postgres to pgvector without losing data, then run Drizzle migrations.
#
# Usage: ./scripts/upgrade-prod-postgres-pgvector.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod-db.yml}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups/postgres}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

# Prod database — edit here if credentials change
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="Arnab@2854"
POSTGRES_DB="oriondb"
POSTGRES_PORT="5432"
PGADMIN_EMAIL="loveumearnab.2812000@gmail.com"
PGADMIN_PASSWORD="Arnab@2854"
PGADMIN_PORT="5050"
DATABASE_URL="postgresql://postgres:Arnab%402854@127.0.0.1:5432/oriondb"
DATABASE_URL_DIRECT="${DATABASE_URL}"

export POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB POSTGRES_PORT
export PGADMIN_EMAIL PGADMIN_PASSWORD PGADMIN_PORT
export DATABASE_URL DATABASE_URL_DIRECT

log() { echo ""; echo "=== $* ==="; }

log "Database: 127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB} (user: ${POSTGRES_USER})"

docker_psql() {
  docker compose -f "${COMPOSE_FILE}" exec -T \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" postgres \
    psql -h 127.0.0.1 -U "${POSTGRES_USER}" "$@"
}

docker_pg_dump() {
  docker compose -f "${COMPOSE_FILE}" exec -T \
    -e PGPASSWORD="${POSTGRES_PASSWORD}" postgres \
    pg_dump -h 127.0.0.1 -U "${POSTGRES_USER}" "$@"
}

log "Pull pgvector Postgres image"
docker compose -f "${COMPOSE_FILE}" pull postgres

log "Backup database to ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}"
BACKUP_FILE="${BACKUP_DIR}/${POSTGRES_DB}-${TIMESTAMP}.sql.gz"

if docker compose -f "${COMPOSE_FILE}" ps postgres 2>/dev/null | grep -q "Up"; then
  docker_pg_dump -d "${POSTGRES_DB}" --no-owner --no-acl | gzip > "${BACKUP_FILE}"
  log "Backup saved: ${BACKUP_FILE}"
else
  log "Postgres not running yet — skipping live backup"
fi

log "Start / upgrade Postgres (pgvector/pgvector:pg15)"
docker compose -f "${COMPOSE_FILE}" up -d postgres

log "Wait for Postgres healthy"
for _ in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" exec -T postgres \
    pg_isready -h 127.0.0.1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

docker compose -f "${COMPOSE_FILE}" exec -T postgres \
  pg_isready -h 127.0.0.1 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"

log "Enable pgvector extension"
docker_psql -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
docker_psql -d "${POSTGRES_DB}" -c "\\dx vector"

log "Run Drizzle migrations"
pnpm db:migrate

log "Done. Postgres on 127.0.0.1:${POSTGRES_PORT}"
echo "Restart app: sudo systemctl restart orion"
