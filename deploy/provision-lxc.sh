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
provision_base() { :; }
deploy_release() { :; }
install_service() { :; }
wait_healthy() { :; }
summary() { :; }

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
