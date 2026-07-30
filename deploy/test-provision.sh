#!/usr/bin/env bash
# Drives provision-lxc.sh in --dry-run and asserts on what it would do and
# on the files it generates. Runs anywhere: no Proxmox, no root, no side
# effects.
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

plan="$("$SCRIPT" --dry-run 2>&1)"

# The generated provision script must itself be valid bash. Extract it back
# out of the dry-run output and parse it — this is the piece that actually
# runs inside the container, so a syntax error here is a failed deploy.
provision="$(sed -n '/--- \/root\/provision.sh ---/,$p' <<<"$plan" | sed -n 's/^   | //p')"
if [ -n "$provision" ] && bash -n <(printf '%s\n' "$provision"); then
  echo "  ok   generated provision.sh parses"
  pass=$((pass + 1))
else
  echo "  FAIL generated provision.sh has a syntax error"
  fail=$((fail + 1))
fi

echo "== help =="
help_out="$("$SCRIPT" --help 2>&1 || true)"
check "help mentions CTID" "CTID" "$help_out"
check "help mentions the repo" "REPO=" "$help_out"

echo "== host side =="
check "resolves the template dynamically" "debian-12-standard" "$plan"
check "creates a container" "pct create" "$plan"
check "unprivileged" "--unprivileged 1" "$plan"
check "starts on boot" "--onboot 1" "$plan"
check "pushes the provision script" "/root/provision.sh" "$plan"
check "runs the provision script" "bash /root/provision.sh" "$plan"
check "checks health" "/healthz" "$plan"
check "prints the update command" "Update:" "$plan"
refute "never destroys" "pct destroy" "$plan"
refute "never builds on the host" "cd '/" "$plan"

echo "== provision script =="
check "installs git" "git" "$provision"
check "installs node from nodesource" "nodesource" "$provision"
check "requires node 24+" "setup_24.x" "$provision"
check "creates the service user" "useradd" "$provision"
check "clones the repo" "git clone" "$provision"
check "fast-forwards an existing checkout" "git -C \"/opt/baritonic\" fetch" "$provision"
check "builds the web app in the container" "npm run build" "$provision"
check "installs server deps without devDeps" "npm ci --omit=dev" "$provision"
# Without this, ug-import cannot resolve music-core from its own source:
# npm only links the packages into apps/server/node_modules, which is not
# on the upward resolution path from packages/ug-import/.
check "links workspace packages at the repo root" "node_modules/@baritonic" "$provision"
check "creates the data dir" "mkdir -p \"/var/lib/baritonic\"" "$provision"
check "restarts the service" "systemctl restart baritonic" "$provision"
refute "never removes the data dir" "rm -rf /var/lib/baritonic" "$provision"

echo "== systemd unit =="
unit="$(sed -n '/--- \/etc\/systemd\/system\/baritonic.service ---/,/--- \/root/p' <<<"$plan" | sed -n 's/^   | //p')"
check "runs as a non-root user" "User=baritonic" "$unit"
check "binds to all interfaces" "BIND_ADDR=0.0.0.0" "$unit"
check "sets the data dir" "DATA_DIR=/var/lib/baritonic" "$unit"
check "hardens the unit" "ProtectSystem=strict" "$unit"
check "permits writes to the data dir" "ReadWritePaths=/var/lib/baritonic" "$unit"
check "restarts on failure" "Restart=on-failure" "$unit"

echo "== overrides are honoured =="
plan2="$(CTID=999 APP_PORT=8080 CT_HOSTNAME=music BRANCH=dev "$SCRIPT" --dry-run 2>&1)"
check "custom ctid" "pct create 999" "$plan2"
check "custom hostname" "--hostname music" "$plan2"
check "custom port" "PORT=8080" "$plan2"
check "custom branch" "--branch dev" "$plan2"

echo
printf '%d passed, %d failed\n' "$pass" "$fail"
[[ $fail -eq 0 ]]
