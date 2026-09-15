#!/usr/bin/env bash
# Quick prod DB checks before/after migrate. Run from repo root on the Ubuntu server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

ENV_FILE="${ENV_FILE:-.env}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod-db.yml}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-oriondb}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

echo "=== DATABASE_URL target ==="
node -e "
const u = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || '';
try {
  const url = new URL(u.replace(/^postgresql:/, 'http:'));
  console.log(url.hostname + ':' + (url.port || '5432') + url.pathname);
} catch { console.log('(invalid DATABASE_URL)'); }
"

echo ""
echo "=== Docker postgres containers ==="
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' \
  | grep -iE 'postgres|pgvector|NAME' || echo "(none found)"

echo ""
echo "=== Port ${POSTGRES_PORT} listening? ==="
ss -tlnp 2>/dev/null | grep ":${POSTGRES_PORT} " || echo "nothing listening on ${POSTGRES_PORT}"

echo ""
if docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" ps postgres 2>/dev/null | grep -q "Up"; then
  echo "=== pgvector extension ==="
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c "\\dx vector" || true

  echo ""
  echo "=== applied migrations ==="
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
    "SELECT id, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;" 2>/dev/null || \
    echo "(drizzle.__drizzle_migrations not found — fresh DB or never migrated)"

  echo ""
  echo "=== chat_messages.image_url type ==="
  docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}" exec -T postgres \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -c \
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'image_url';" 2>/dev/null || true
else
  echo "=== compose postgres not running (${COMPOSE_FILE}) ==="
  echo "Start with: docker compose -f ${COMPOSE_FILE} --env-file ${ENV_FILE} up -d postgres"
fi

echo ""
echo "=== run migrate with full errors ==="
echo "  pnpm db:migrate"
