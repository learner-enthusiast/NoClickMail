#!/bin/sh
set -eu

if [ "${RUN_DB_MIGRATE:-0}" = "1" ]; then
  echo "[api-entrypoint] Running database migrations..."
  if ! node /app/apps/api/migrate.mjs; then
    echo "[api-entrypoint] Database migration failed" >&2
    exit 1
  fi
fi

exec "$@"
