#!/usr/bin/env bash
# Shared deploy helpers — sourced by deploy-manual.sh and deploy-remote.sh.
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH is required}"
: "${COMPOSE_FILE:=docker-compose.deploy.yml}"
: "${ENV_FILE:=.env}"
: "${DEPLOY_SHA:=unknown}"
: "${MAX_HEALTH_WAIT_SECONDS:=600}"
: "${HEALTH_POLL_INTERVAL:=15}"

log_section() {
  echo ""
  echo "================================================================"
  echo "  $*"
  echo "================================================================"
}

log_step() {
  echo ""
  echo "--- $*"
}

fail_with_diagnostics() {
  local reason="${1:-Deploy failed}"
  echo ""
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  echo "  DEPLOY FAILED: $reason"
  echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
  dump_diagnostics "$reason"
  exit 1
}

dump_diagnostics() {
  local reason="${1:-unknown}"
  log_section "DIAGNOSTICS (reason: $reason)"

  log_step "Working directory & files"
  pwd
  ls -la "$COMPOSE_FILE" "$ENV_FILE" nginx.deploy.conf db-sync-entrypoint.sh 2>/dev/null || true

  log_step "Disk space"
  df -h . 2>/dev/null || df -h

  log_step "Docker versions"
  docker version 2>/dev/null || echo "docker version unavailable"
  docker compose version 2>/dev/null || echo "docker compose unavailable"

  log_step "Image tags (noclickmail-*)"
  docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' \
    | grep -E 'noclickmail|^REPOSITORY' || echo "No noclickmail images found"

  log_step "Env summary (secrets redacted)"
  if [ -f "$ENV_FILE" ]; then
    grep -E '^(POSTGRES_USER|POSTGRES_DB|API_IMAGE_TAG|WEB_IMAGE_TAG|EXTERNAL_PORT|CLIENT_URL|NODE_ENV)=' \
      "$ENV_FILE" || true
    echo "POSTGRES_PASSWORD=<redacted>"
    echo "DATABASE_URL=<redacted local postgres url>"
  else
    echo "Missing $ENV_FILE"
  fi

  log_step "Compose service status (all)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -a 2>/dev/null || true

  log_step "Postgres logs (last 80 lines)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs postgres --tail 80 2>/dev/null || true

  log_step "Migrate logs (all available)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs migrate 2>/dev/null || true

  log_step "Corsair setup logs (all available)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs corsair-setup 2>/dev/null || true

  log_step "API logs (last 150 lines)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs api --tail 150 2>/dev/null || true

  log_step "Web logs (last 80 lines)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs web --tail 80 2>/dev/null || true

  log_step "Proxy logs (last 40 lines)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs proxy --tail 40 2>/dev/null || true

  log_step "db-sync logs (last 40 lines)"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" logs db-sync --tail 40 || true
}

wait_for_postgres() {
  local max_attempts=30
  local attempt=1
  log_step "Waiting for Postgres to become healthy (max ${max_attempts}x10s)..."
  while [ "$attempt" -le "$max_attempts" ]; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps postgres 2>/dev/null \
      | grep -q '(healthy)'; then
      echo "Postgres is healthy (attempt $attempt/$max_attempts)"
      return 0
    fi
    echo "  attempt $attempt/$max_attempts — not healthy yet"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps postgres 2>/dev/null || true
    sleep 10
    attempt=$((attempt + 1))
  done
  fail_with_diagnostics "Postgres did not become healthy within $((max_attempts * 10))s"
}

run_migrations() {
  log_step "Running migrations (docker compose run --rm migrate)"
  log_step "Migrate image: noclickmail-api:$(grep '^API_IMAGE_TAG=' "$ENV_FILE" | cut -d= -f2- || echo latest)"

  if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-TTY migrate; then
    fail_with_diagnostics "Database migration exited non-zero"
  fi

  echo "Migrations completed successfully."
}

run_corsair_setup() {
  log_step "Running Corsair setup (docker compose run --rm corsair-setup)"

  if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm --no-TTY corsair-setup; then
    fail_with_diagnostics "Corsair setup exited non-zero"
  fi

  echo "Corsair setup completed successfully."
}

wait_for_api_healthy() {
  local elapsed=0
  log_step "Polling API health (max ${MAX_HEALTH_WAIT_SECONDS}s, every ${HEALTH_POLL_INTERVAL}s)..."

  while [ "$elapsed" -lt "$MAX_HEALTH_WAIT_SECONDS" ]; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps api 2>/dev/null | grep -q '(healthy)'; then
      echo "API is healthy after ${elapsed}s"
      return 0
    fi

    echo "  ${elapsed}s — API not healthy yet"
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps api 2>/dev/null || true
    sleep "$HEALTH_POLL_INTERVAL"
    elapsed=$((elapsed + HEALTH_POLL_INTERVAL))
  done

  fail_with_diagnostics "API did not become healthy within ${MAX_HEALTH_WAIT_SECONDS}s"
}

verify_compose_files() {
  log_step "Required deploy files"
  for f in "$COMPOSE_FILE" "$ENV_FILE" nginx.deploy.conf db-sync-entrypoint.sh; do
    if [ -f "$f" ]; then
      ls -lh "$f"
    else
      echo "MISSING: $f"
      fail_with_diagnostics "Required file missing: $f"
    fi
  done
}

load_images_from_tarball() {
  local tarball="${1:-noclickmail-images.tar.gz}"
  if [ ! -f "$tarball" ]; then
    fail_with_diagnostics "Image tarball not found: $tarball"
  fi

  log_section "Load Docker images from tarball"
  gunzip -c "$tarball" | docker load
  rm -f "$tarball"
  docker images | grep noclickmail || fail_with_diagnostics "noclickmail images not loaded"
}

update_env_image_tags() {
  local tag="${1:?image tag required}"
  if [ ! -f "$ENV_FILE" ]; then
    fail_with_diagnostics "Cannot update image tags — missing $ENV_FILE"
  fi

  log_step "Set API_IMAGE_TAG and WEB_IMAGE_TAG to ${tag} in $ENV_FILE"
  if grep -q '^API_IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s|^API_IMAGE_TAG=.*|API_IMAGE_TAG=${tag}|" "$ENV_FILE"
  else
    printf 'API_IMAGE_TAG=%s\n' "$tag" >> "$ENV_FILE"
  fi

  if grep -q '^WEB_IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s|^WEB_IMAGE_TAG=.*|WEB_IMAGE_TAG=${tag}|" "$ENV_FILE"
  else
    printf 'WEB_IMAGE_TAG=%s\n' "$tag" >> "$ENV_FILE"
  fi
}

build_images_on_server() {
  local repo_root="${REPO_ROOT:?REPO_ROOT is required for on-server builds}"
  local tag="${IMAGE_TAG:-local}"

  log_section "Build Docker images on server (tag=${tag})"
  docker build -f "$repo_root/docker/Dockerfile.api" -t "noclickmail-api:${tag}" "$repo_root"
  docker build -f "$repo_root/docker/Dockerfile.web" \
    --build-arg NEXT_PUBLIC_API_URL=/trpc \
    -t "noclickmail-web:${tag}" \
    "$repo_root"

  update_env_image_tags "$tag"
  docker images | grep noclickmail || true
}

run_stack_deploy() {
  log_section "Start Postgres"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres
  wait_for_postgres

  log_section "Run database migrations"
  run_migrations

  log_section "Run Corsair setup"
  run_corsair_setup

  log_section "Start application stack (api, web, db-sync, proxy)"
  if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans; then
    fail_with_diagnostics "docker compose up failed"
  fi

  docker image prune -f >/dev/null 2>&1 || true

  log_section "Wait for services"
  wait_for_api_healthy

  log_section "Container status"
  docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps

  log_section "HTTP health checks via nginx proxy"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  local port="${EXTERNAL_PORT:-8080}"

  curl -fsS -o /dev/null -w "Web  HTTP %{http_code} (%{time_total}s)\n" \
    --retry 5 --retry-delay 3 --retry-all-errors \
    "http://127.0.0.1:${port}/" \
    || fail_with_diagnostics "Web health check failed on port ${port}"

  curl -fsS -o /dev/null -w "API  HTTP %{http_code} (%{time_total}s)\n" \
    --retry 8 --retry-delay 5 --retry-all-errors \
    "http://127.0.0.1:${port}/health" \
    || fail_with_diagnostics "API health check failed on port ${port}"

  log_section "Deploy succeeded (sha=${DEPLOY_SHA})"
}
