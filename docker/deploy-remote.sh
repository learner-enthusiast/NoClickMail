#!/usr/bin/env bash
# Remote deploy — run ON the VPS (via SSH from CI or manually).
#
# Modes (pick one):
#   BUILD_ON_SERVER=1   Build images from REPO_ROOT on the server (default for manual/auto SSH)
#   LOAD_IMAGES=1       Load noclickmail-images.tar.gz (legacy CI tarball flow)
#
# Examples:
#   # Manual / SSH auto-deploy (build on server):
#   REPO_ROOT=/home/user/NoClickMail DEPLOY_PATH=/home/user/orion \
#     BUILD_ON_SERVER=1 ./deploy-remote.sh
#
#   # Legacy tarball load (optional):
#   DEPLOY_PATH=/home/user/orion LOAD_IMAGES=1 ./deploy-remote.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH is required}"
BUILD_ON_SERVER="${BUILD_ON_SERVER:-1}"
LOAD_IMAGES="${LOAD_IMAGES:-0}"

# shellcheck source=deploy-common.sh
source "$SCRIPT_DIR/deploy-common.sh"

cd "$DEPLOY_PATH"

log_section "Remote deploy preflight (sha=${DEPLOY_SHA})"
log_step "Host info"
uname -a || true
verify_compose_files

if [ "$LOAD_IMAGES" = "1" ]; then
  load_images_from_tarball "noclickmail-images.tar.gz"
elif [ "$BUILD_ON_SERVER" = "1" ]; then
  build_images_on_server
else
  log_step "Using existing images (API_IMAGE_TAG / WEB_IMAGE_TAG from .env)"
  docker images | grep noclickmail || fail_with_diagnostics "No noclickmail images found"
fi

run_stack_deploy
