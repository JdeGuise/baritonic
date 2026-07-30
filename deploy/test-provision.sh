#!/usr/bin/env bash
# Drives provision-lxc.sh in --dry-run and asserts on the emitted plan.
# Runs anywhere: no Proxmox, no root, no side effects.
set -Eeuo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$HERE/provision-lxc.sh"

pass=0
fail=0

check() {
  local label="$1" expected="$2" haystack="$3"
  if grep -Fq -- "$expected" <<<"$haystack"; then
    printf '  ok   %s\n' "$label"
    pass=$((pass + 1))
  else
    printf '  FAIL %s\n       expected to find: %s\n' "$label" "$expected"
    fail=$((fail + 1))
  fi
}

refute() {
  local label="$1" unexpected="$2" haystack="$3"
  if grep -Fq -- "$unexpected" <<<"$haystack"; then
    printf '  FAIL %s\n       should NOT contain: %s\n' "$label" "$unexpected"
    fail=$((fail + 1))
  else
    printf '  ok   %s\n' "$label"
    pass=$((pass + 1))
  fi
}

echo "== syntax =="
if bash -n "$SCRIPT"; then
  echo "  ok   provision-lxc.sh parses"
  pass=$((pass + 1))
else
  echo "  FAIL provision-lxc.sh has a syntax error"
  fail=$((fail + 1))
fi

echo "== help =="
help_out="$("$SCRIPT" --help 2>&1 || true)"
check "help mentions CTID" "CTID" "$help_out"
check "help mentions dry-run" "--dry-run" "$help_out"

echo "== defaults =="
plan="$("$SCRIPT" --dry-run 2>&1)"
check "creates a container" "pct create" "$plan"
check "unprivileged" "--unprivileged 1" "$plan"
check "installs node" "nodesource" "$plan"
check "runs npm ci without devDeps" "npm ci --omit=dev" "$plan"
# Without this, ug-import cannot resolve music-core from its own source:
# npm only links the packages into apps/server/node_modules, which is not
# on the upward resolution path from packages/ug-import/.
check "links workspace packages at the app root" "node_modules/@music-ui" "$plan"
check "installs a systemd unit" "music-ui.service" "$plan"
check "enables the service" "systemctl enable" "$plan"
check "binds to all interfaces" "BIND_ADDR=0.0.0.0" "$plan"
check "sets the data dir" "DATA_DIR=/var/lib/music-ui" "$plan"
check "runs as a non-root user" "User=music-ui" "$plan"
check "hardens the unit" "ProtectSystem=strict" "$plan"
check "permits writes to the data dir" "ReadWritePaths=/var/lib/music-ui" "$plan"
check "checks health" "/healthz" "$plan"
refute "never destroys by default" "pct destroy" "$plan"

echo "== overrides are honoured =="
plan2="$(CTID=999 APP_PORT=8080 DATA_DIR=/srv/music SERVICE_USER=muser "$SCRIPT" --dry-run 2>&1)"
check "custom ctid" "pct create 999" "$plan2"
check "custom port" "PORT=8080" "$plan2"
check "custom data dir" "DATA_DIR=/srv/music" "$plan2"
check "custom user" "User=muser" "$plan2"
check "data dir writable" "ReadWritePaths=/srv/music" "$plan2"

echo "== static networking =="
plan3="$(IPV4=192.168.1.50/24 GATEWAY=192.168.1.1 "$SCRIPT" --dry-run 2>&1)"
check "static ip" "ip=192.168.1.50/24" "$plan3"
check "gateway" "gw=192.168.1.1" "$plan3"

echo "== dhcp by default =="
check "dhcp" "ip=dhcp" "$plan"

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
