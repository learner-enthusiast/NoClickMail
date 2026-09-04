#!/usr/bin/env bash
# Manual deploy — run ON the VPS at DEPLOY_PATH.
#
# First-time setup:
#   1. Clone repo (or copy source) anywhere on the server
#   2. Create DEPLOY_PATH with a production .env (see .env.example)
#   3. Run:
#        REPO_ROOT=/path/to/NoClickMail \
#        DEPLOY_PATH=/path/to/deploy \
#        ./docker/deploy-manual.sh
#
# DEPLOY_PATH holds runtime files (.env, compose, nginx). Images are built on the
# server from REPO_ROOT — no CI tarball required.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DEPLOY_PATH="${DEPLOY_PATH:-$REPO_ROOT}"
IMAGE_TAG="${IMAGE_TAG:-local}"
DEPLOY_SHA="${DEPLOY_SHA:-manual}"

# shellcheck source=deploy-common.sh
source "$SCRIPT_DIR/deploy-common.sh"

stage_deploy_files() {
  log_section "Stage deploy files into ${DEPLOY_PATH}"
  mkdir -p "$DEPLOY_PATH"

  cp -f "$REPO_ROOT/docker-compose.deploy.yml" "$DEPLOY_PATH/docker-compose.deploy.yml"
  cp -f "$REPO_ROOT/docker/nginx.deploy.conf" "$DEPLOY_PATH/nginx.deploy.conf"
  cp -f "$REPO_ROOT/docker/db-sync-entrypoint.sh" "$DEPLOY_PATH/db-sync-entrypoint.sh"
  cp -f "$REPO_ROOT/docker/deploy-remote.sh" "$DEPLOY_PATH/deploy-remote.sh"
  cp -f "$SCRIPT_DIR/deploy-manual.sh" "$DEPLOY_PATH/deploy-manual.sh"
  cp -f "$SCRIPT_DIR/deploy-common.sh" "$DEPLOY_PATH/deploy-common.sh"
  chmod +x "$DEPLOY_PATH/db-sync-entrypoint.sh" "$DEPLOY_PATH/deploy-remote.sh" "$DEPLOY_PATH/deploy-manual.sh"

  if [ ! -f "$DEPLOY_PATH/.env" ]; then
    echo "Missing $DEPLOY_PATH/.env — copy .env.example and fill in production values first."
    exit 1
  fi
}

main() {
  log_section "Manual deploy preflight (sha=${DEPLOY_SHA})"
  log_step "REPO_ROOT=$REPO_ROOT"
  log_step "DEPLOY_PATH=$DEPLOY_PATH"
  uname -a || true

  stage_deploy_files
  cd "$DEPLOY_PATH"
  verify_compose_files
  build_images_on_server
  run_stack_deploy
}

main "$@"
