#!/usr/bin/env bash
set -euo pipefail

SERVICE="${ORION_SERVICE_NAME:-orion}"

print_sudo_help() {
  cat >&2 <<EOF
Failed to restart ${SERVICE}.service without a password.

Current user: $(whoami)

Verify as this user:

  sudo -n systemctl restart ${SERVICE}
  sudo -n systemctl is-active ${SERVICE}
EOF
}

show_status() {
  # Optional log line — must not fail the deploy (pipefail + head closes early → SIGPIPE).
  sudo -n systemctl status "${SERVICE}" --no-pager -l 2>/dev/null | head -20 || true
}

restart_user_unit() {
  systemctl --user restart "${SERVICE}"
  systemctl --user is-active "${SERVICE}"
  systemctl --user status "${SERVICE}" --no-pager -l 2>/dev/null | head -20 || true
}

restart_system_unit() {
  sudo -n systemctl restart "${SERVICE}"
  sudo -n systemctl is-active "${SERVICE}"
  show_status
}

system_unit_exists() {
  systemctl list-unit-files "${SERVICE}.service" --no-pager 2>/dev/null \
    | awk '{print $1}' | grep -qx "${SERVICE}.service"
}

echo "restart-orion: user=$(whoami) systemctl=$(command -v systemctl)"

if system_unit_exists; then
  restart_system_unit
elif systemctl --user cat "${SERVICE}.service" &>/dev/null; then
  restart_user_unit
else
  echo "Service unit ${SERVICE}.service not found (user or system)." >&2
  exit 1
fi

echo "restart-orion: ok"
