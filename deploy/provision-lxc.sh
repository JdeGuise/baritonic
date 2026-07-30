#!/usr/bin/env bash
#
# Provision music-ui into an unprivileged Proxmox LXC container.
#
# Run this ON THE PROXMOX HOST as root. Re-running redeploys the
# application into the existing container rather than recreating it.
#
#   ./provision-lxc.sh --dry-run     # print the plan, change nothing
#   ./provision-lxc.sh               # do it
#
set -Eeuo pipefail

# ── configuration ───────────────────────────────────────────────
# Every value is overridable from the environment and echoed back in the
# summary, so a deployment is reproducible from its own output.

CTID="${CTID:-210}"
CT_HOSTNAME="${CT_HOSTNAME:-music-ui}"
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"
TEMPLATE="${TEMPLATE:-debian-12-standard_12.7-1_amd64.tar.zst}"
ROOTFS_STORAGE="${ROOTFS_STORAGE:-local-lvm}"
DISK_GB="${DISK_GB:-4}"
MEMORY_MB="${MEMORY_MB:-1024}"
SWAP_MB="${SWAP_MB:-512}"
CORES="${CORES:-2}"
BRIDGE="${BRIDGE:-vmbr0}"
IPV4="${IPV4:-dhcp}"
GATEWAY="${GATEWAY:-}"

APP_PORT="${APP_PORT:-4173}"
APP_DIR="${APP_DIR:-/opt/music-ui}"
DATA_DIR="${DATA_DIR:-/var/lib/music-ui}"
SERVICE_USER="${SERVICE_USER:-music-ui}"
SERVICE_NAME="music-ui.service"
NODE_MAJOR="${NODE_MAJOR:-24}"

DRY_RUN=0
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ── plumbing ────────────────────────────────────────────────────

log() { printf '\033[1;35m==\033[0m %s\n' "$*"; }
info() { printf '   %s\n' "$*"; }
die() {
  printf '\033[1;31m!!\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Provision music-ui into a Proxmox LXC container. Run on the Proxmox host.

Usage: $(basename "$0") [--dry-run] [--help]

  --dry-run   Print every command that would run, and change nothing.
  --help      This text.

Configuration (environment variables, current defaults shown):

  CTID=$CTID                       container id
  CT_HOSTNAME=$CT_HOSTNAME
  TEMPLATE_STORAGE=$TEMPLATE_STORAGE
  TEMPLATE=$TEMPLATE
  ROOTFS_STORAGE=$ROOTFS_STORAGE
  DISK_GB=$DISK_GB
  MEMORY_MB=$MEMORY_MB
  SWAP_MB=$SWAP_MB
  CORES=$CORES
  BRIDGE=$BRIDGE
  IPV4=$IPV4                       "dhcp" or CIDR, e.g. 192.168.1.50/24
  GATEWAY=$GATEWAY                 required when IPV4 is a CIDR

  APP_PORT=$APP_PORT
  APP_DIR=$APP_DIR
  DATA_DIR=$DATA_DIR
  SERVICE_USER=$SERVICE_USER
  NODE_MAJOR=$NODE_MAJOR
EOF
}

# Every mutating command goes through here. Nothing bypasses it, or
# --dry-run would misreport what a real run does.
run() {
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '   \033[2m$\033[0m %s\n' "$*"
  else
    "$@"
  fi
}

# Run a shell command inside the container.
in_ct() {
  run pct exec "$CTID" -- bash -lc "$*"
}

# Write a file inside the container from a string.
write_in_ct() {
  local path="$1" content="$2"
  if [[ $DRY_RUN -eq 1 ]]; then
    printf '   \033[2m$\033[0m write %s in ct %s:\n' "$path" "$CTID"
    sed 's/^/       | /' <<<"$content"
  else
    local tmp
    tmp="$(mktemp)"
    printf '%s\n' "$content" >"$tmp"
    pct push "$CTID" "$tmp" "$path"
    rm -f "$tmp"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --dry-run)
    DRY_RUN=1
    shift
    ;;
  --help | -h)
    usage
    exit 0
    ;;
  *) die "Unknown argument: $1 (try --help)" ;;
  esac
done

# ── stages (filled in by later tasks) ───────────────────────────

preflight() {
  log "Preflight"

  if [[ $DRY_RUN -eq 0 ]]; then
    [[ $EUID -eq 0 ]] || die "Run as root on the Proxmox host."
    command -v pct >/dev/null || die "pct not found — is this a Proxmox host?"
  fi

  if [[ "$IPV4" != "dhcp" && -z "$GATEWAY" ]]; then
    die "GATEWAY is required when IPV4 is a static CIDR ($IPV4)."
  fi

  [[ -d "$REPO_ROOT/apps/server/src" ]] || die "Cannot find the project at $REPO_ROOT"

  info "host:      $(hostname 2>/dev/null || echo unknown)"
  info "container: $CTID ($CT_HOSTNAME)"
  info "network:   $IPV4 on $BRIDGE${GATEWAY:+ via $GATEWAY}"
}

container_exists() {
  [[ $DRY_RUN -eq 1 ]] && return 1
  pct status "$CTID" >/dev/null 2>&1
}

ensure_container() {
  if container_exists; then
    log "Container $CTID exists — redeploying into it"
  else
    log "Creating container $CTID"

    local net="name=eth0,bridge=$BRIDGE,ip=$IPV4"
    [[ -n "$GATEWAY" ]] && net="$net,gw=$GATEWAY"

    run pct create "$CTID" "$TEMPLATE_STORAGE:vztmpl/$TEMPLATE" \
      --hostname "$CT_HOSTNAME" \
      --unprivileged 1 \
      --features nesting=1 \
      --cores "$CORES" \
      --memory "$MEMORY_MB" \
      --swap "$SWAP_MB" \
      --rootfs "$ROOTFS_STORAGE:$DISK_GB" \
      --net0 "$net" \
      --onboot 1 \
      --description "music-ui — personal chord chart reader"
  fi

  log "Starting container"
  run pct start "$CTID" || true

  # pct exec fails until the container's init has come up.
  if [[ $DRY_RUN -eq 0 ]]; then
    local tries=0
    until pct exec "$CTID" -- true 2>/dev/null; do
      tries=$((tries + 1))
      [[ $tries -gt 30 ]] && die "Container $CTID did not become ready."
      sleep 1
    done
  else
    info "(would wait for the container to accept commands)"
  fi
}
provision_base() {
  log "Installing base packages and Node $NODE_MAJOR"

  in_ct "export DEBIAN_FRONTEND=noninteractive && apt-get update -qq"
  in_ct "export DEBIAN_FRONTEND=noninteractive && apt-get install -y -qq ca-certificates curl gnupg tar"

  # NodeSource: Debian's own node is far too old for node:sqlite, which
  # the database layer depends on being in the standard library.
  in_ct "if ! command -v node >/dev/null || [ \"\$(node -p 'process.versions.node.split(\".\")[0]')\" -lt $NODE_MAJOR ]; then
           curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - &&
           export DEBIAN_FRONTEND=noninteractive && apt-get install -y -qq nodejs;
         fi"
  in_ct "node --version && npm --version"

  log "Creating service user and directories"
  in_ct "id -u $SERVICE_USER >/dev/null 2>&1 || useradd --system --create-home --home-dir /var/lib/$SERVICE_USER --shell /usr/sbin/nologin $SERVICE_USER"
  in_ct "mkdir -p $APP_DIR $DATA_DIR"
  in_ct "chown -R $SERVICE_USER:$SERVICE_USER $DATA_DIR"
}
deploy_release() {
  log "Building the web app"
  run bash -c "cd '$REPO_ROOT/apps/web' && npm ci --silent && npm run build --silent"

  log "Packaging the release"
  # Exactly the paths apps/server resolves: its own source, the two
  # workspace packages it imports through file:, and the web build.
  local tarball="/tmp/music-ui-release.tar.gz"
  run bash -c "cd '$REPO_ROOT' && tar czf '$tarball' \
    packages/music-core/src packages/music-core/package.json \
    packages/ug-import/src packages/ug-import/package.json \
    apps/server/src apps/server/package.json apps/server/package-lock.json \
    apps/web/dist"

  log "Pushing the release into the container"
  in_ct "rm -rf $APP_DIR/packages $APP_DIR/apps && mkdir -p $APP_DIR"
  run pct push "$CTID" "$tarball" "/tmp/music-ui-release.tar.gz"
  in_ct "tar xzf /tmp/music-ui-release.tar.gz -C $APP_DIR && rm -f /tmp/music-ui-release.tar.gz"

  log "Installing production dependencies"
  # A pure-JavaScript tree: node:sqlite is in the standard library, so
  # there is nothing here to compile.
  in_ct "cd $APP_DIR/apps/server && npm ci --omit=dev --silent"

  # npm links the workspace packages into apps/server/node_modules, which
  # resolves them for the server itself — but ug-import's own source also
  # imports music-core, and Node resolves that from the package's real
  # path, walking up from packages/ug-import/. A link directory at the
  # app root is on that upward path, so it resolves from anywhere.
  in_ct "mkdir -p $APP_DIR/node_modules/@music-ui &&
         ln -sfn $APP_DIR/packages/music-core $APP_DIR/node_modules/@music-ui/music-core &&
         ln -sfn $APP_DIR/packages/ug-import  $APP_DIR/node_modules/@music-ui/ug-import"

  in_ct "chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR"

  run rm -f "$tarball"
}
install_service() {
  log "Installing $SERVICE_NAME"

  local unit
  unit="$(
    cat <<EOF
[Unit]
Description=music-ui — personal chord chart reader
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR/apps/server
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
Environment=BIND_ADDR=0.0.0.0
Environment=DATA_DIR=$DATA_DIR
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning --experimental-strip-types src/server.ts
Restart=on-failure
RestartSec=3

# The service needs nothing beyond its own data directory.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF
  )"

  write_in_ct "/etc/systemd/system/$SERVICE_NAME" "$unit"
  in_ct "systemctl daemon-reload"
  in_ct "systemctl enable $SERVICE_NAME"
  in_ct "systemctl restart $SERVICE_NAME"
}

container_ip() {
  if [[ $DRY_RUN -eq 1 ]]; then
    echo "<container-ip>"
  else
    pct exec "$CTID" -- hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

wait_healthy() {
  log "Waiting for /healthz"

  if [[ $DRY_RUN -eq 1 ]]; then
    info "\$ curl -fsS http://<container-ip>:$APP_PORT/healthz"
    return 0
  fi

  local ip tries=0
  ip="$(container_ip)"
  [[ -n "$ip" ]] || die "Could not determine the container's IP address."

  until curl -fsS "http://$ip:$APP_PORT/healthz" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [[ $tries -gt 45 ]]; then
      printf '\n'
      pct exec "$CTID" -- journalctl -u "$SERVICE_NAME" -n 40 --no-pager || true
      die "$SERVICE_NAME did not become healthy. Recent log above."
    fi
    sleep 1
  done
  info "healthy after ${tries}s"
}

summary() {
  local ip
  ip="$(container_ip)"

  log "Done"
  cat <<EOF

   music-ui is running at   http://${ip}:${APP_PORT}

   container   $CTID ($CT_HOSTNAME)
   app         $APP_DIR
   database    $DATA_DIR/music-ui.db
   service     $SERVICE_NAME as $SERVICE_USER

   Logs        pct exec $CTID -- journalctl -u $SERVICE_NAME -f
   Restart     pct exec $CTID -- systemctl restart $SERVICE_NAME
   Back up     pct pull $CTID $DATA_DIR/music-ui.db ./music-ui-backup.db
   Redeploy    re-run this script

   There is no authentication. Keep this on a trusted network.

EOF
}

main() {
  preflight
  ensure_container
  provision_base
  deploy_release
  install_service
  wait_healthy
  summary
}

main "$@"
