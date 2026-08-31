#!/bin/sh
set -eu

if [ "${RUN_DB_MIGRATE:-0}" = "1" ]; then
  node /app/docker/migrate.mjs
fi

exec "$@"
