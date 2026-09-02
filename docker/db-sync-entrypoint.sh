#!/bin/sh
# Daily sync: local Postgres -> remote SYNC_DATABASE_URL
# Retry up to 5 times per batch; if all fail, wait 1 hour and repeat until one succeeds.

set -eu

MAX_ATTEMPTS="${SYNC_MAX_ATTEMPTS:-5}"
RETRY_DELAY="${SYNC_RETRY_DELAY_SECONDS:-60}"
HOURLY_DELAY="${SYNC_HOURLY_DELAY_SECONDS:-3600}"
DAILY_INTERVAL="${SYNC_INTERVAL_SECONDS:-86400}"

log() {
  printf '[db-sync] %s\n' "$1"
}

with_ssl() {
  url="$1"
  case "$url" in
    *sslmode=*)
      printf '%s' "$url"
      ;;
    *supabase.com*|*neon.tech*|*pooler.*)
      if printf '%s' "$url" | grep -q '?'; then
        printf '%s&sslmode=require' "$url"
      else
        printf '%s?sslmode=require' "$url"
      fi
      ;;
    *)
      printf '%s' "$url"
      ;;
  esac
}

local_url() {
  with_ssl "postgresql://${POSTGRES_USER:-postgres}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-noclickmail}"
}

remote_url() {
  if [ -n "${SYNC_DATABASE_URL:-}" ]; then
    with_ssl "$SYNC_DATABASE_URL"
    return
  fi
  log "ERROR: SYNC_DATABASE_URL is not set"
  exit 1
}

wait_for_postgres() {
  log "Waiting for local Postgres..."
  until pg_isready -h postgres -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-noclickmail}" >/dev/null 2>&1; do
    sleep 2
  done
  log "Local Postgres is ready"
}

sync_once() {
  local dump_file="/tmp/noclickmail-sync.dump"
  local src dest

  src="$(local_url)"
  dest="$(remote_url)"

  log "Dumping local database..."
  pg_dump "$src" --format=custom --no-owner --no-acl --file="$dump_file"

  log "Restoring to remote database..."
  pg_restore --clean --if-exists --no-owner --no-acl --dbname="$dest" "$dump_file"

  rm -f "$dump_file"
  log "Sync completed successfully"
}

attempt_batch() {
  attempt=1
  while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    log "Sync attempt ${attempt}/${MAX_ATTEMPTS}..."
    if sync_once; then
      return 0
    fi
    log "Attempt ${attempt} failed"
    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      log "Retrying in ${RETRY_DELAY}s..."
      sleep "$RETRY_DELAY"
    fi
    attempt=$((attempt + 1))
  done
  return 1
}

run_until_success() {
  while ! attempt_batch; do
    log "All ${MAX_ATTEMPTS} attempts failed; waiting ${HOURLY_DELAY}s before next batch..."
    sleep "$HOURLY_DELAY"
  done
}

wait_for_postgres

log "Starting db-sync loop (daily interval: ${DAILY_INTERVAL}s)"
while true; do
  run_until_success
  log "Next sync in ${DAILY_INTERVAL}s"
  sleep "$DAILY_INTERVAL"
done
