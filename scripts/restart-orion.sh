#!/usr/bin/env bash
set -euo pipefail

SERVICE="${ORION_SERVICE_NAME:-orion}"

print_sudo_help() {
  cat >&2 <<EOF
Failed to restart ${SERVICE}.service without a password.

GitHub Actions / SSH deploy cannot enter an interactive sudo password.

Fix once on the home server (SSH in as a user that already has sudo):

  sudo visudo -f /etc/sudoers.d/orion-deploy

Add this line (replace YOUR_DEPLOY_USER with the GitHub SSH_USER secret):

  YOUR_DEPLOY_USER ALL=(ALL) NOPASSWD: /bin/systemctl restart ${SERVICE}, /bin/systemctl is-active ${SERVICE}, /bin/systemctl status ${SERVICE}

Or copy the example file from the repo:

  sudo cp deploy/orion-deploy.sudoers.example /etc/sudoers.d/orion-deploy
  # edit YOUR_DEPLOY_USER, then:
  sudo chmod 440 /etc/sudoers.d/orion-deploy
  sudo visudo -c

Verify:

  sudo -n systemctl restart ${SERVICE}
  sudo -n systemctl is-active ${SERVICE}
EOF
}

restart_user_unit() {
  systemctl --user restart "${SERVICE}"
  systemctl --user is-active "${SERVICE}"
  systemctl --user status "${SERVICE}" --no-pager -l | head -20
}

restart_system_unit() {
  sudo -n systemctl restart "${SERVICE}"
  sudo -n systemctl is-active "${SERVICE}"
  sudo -n systemctl status "${SERVICE}" --no-pager -l | head -20
}

system_unit_exists() {
  systemctl list-unit-files "${SERVICE}.service" --no-pager 2>/dev/null \
    | awk '{print $1}' | grep -qx "${SERVICE}.service"
}

if systemctl --user cat "${SERVICE}.service" &>/dev/null; then
  restart_user_unit
elif system_unit_exists; then
  if ! restart_system_unit 2>/dev/null; then
    print_sudo_help
    exit 1
  fi
else
  echo "Service unit ${SERVICE}.service not found (user or system)." >&2
  exit 1
fi
