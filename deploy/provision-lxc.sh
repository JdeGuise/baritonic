#!/usr/bin/env bash
#
# Create a dedicated Debian 12 LXC on Proxmox and deploy baritonic into it.
# Run this on the Proxmox VE host as root. Nothing else needs to be on the
# host — the container clones and builds the project itself.
#
#   chmod +x provision-lxc.sh
#   ./provision-lxc.sh
#
# Override any default inline, e.g.:
#   CT_HOSTNAME=music STORAGE=local-zfs MEMORY_MB=2048 ./provision-lxc.sh
#
# Re-running the provision step is the supported update path:
#   pct exec <CTID> -- bash /root/provision.sh
#
set -euo pipefail

# ---- Settings (override via environment) -----------------------------------
CTID="${CTID:-}"                                 # blank = auto-pick next free VMID
CT_HOSTNAME="${CT_HOSTNAME:-baritonic}"           # container name shown in Proxmox
STORAGE="${STORAGE:-local-lvm}"                  # storage for the container rootfs
TEMPLATE_STORAGE="${TEMPLATE_STORAGE:-local}"    # storage holding LXC templates
BRIDGE="${BRIDGE:-vmbr0}"
DISK_GB="${DISK_GB:-6}"                          # the web build's node_modules is ~300MB
MEMORY_MB="${MEMORY_MB:-1024}"
SWAP_MB="${SWAP_MB:-512}"
CORES="${CORES:-2}"
APP_PORT="${APP_PORT:-4173}"
NODE_MAJOR="${NODE_MAJOR:-24}"                   # node:sqlite is stable from 24
REPO="${REPO:-https://github.com/JdeGuise/baritonic}"
BRANCH="${BRANCH:-main}"
APP_DIR="/opt/baritonic"
DATA_DIR="/var/lib/baritonic"
SERVICE_USER="baritonic"

# There is no authentication: the app is single-user and internal-only. It
# binds 0.0.0.0 so it is reachable on the LAN, which is stated here rather
# than inherited — the app itself defaults to loopback.
BIND_ADDR="${BIND_ADDR:-0.0.0.0}"

DRY_RUN=0
# ----------------------------------------------------------------------------

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --help|-h)
      sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'
      echo
      echo "Settings (current defaults):"
      echo "  CTID=${CTID:-<next free>}  CT_HOSTNAME=$CT_HOSTNAME  STORAGE=$STORAGE"
      echo "  BRIDGE=$BRIDGE  DISK_GB=$DISK_GB  MEMORY_MB=$MEMORY_MB  CORES=$CORES"
      echo "  APP_PORT=$APP_PORT  NODE_MAJOR=$NODE_MAJOR  BRANCH=$BRANCH"
      echo "  REPO=$REPO"
      exit 0 ;;
    *) echo "Unknown argument: $1 (try --help)" >&2; exit 1 ;;
  esac
done

# Every command that changes the host or container goes through here, so
# --dry-run reports exactly what a real run would do.
run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '   $ %s\n' "$*"
  else
    "$@"
  fi
}

say() { printf '>> %s\n' "$*"; }

# ---- Resolve the template --------------------------------------------------
say "Resolving template..."
if [ "$DRY_RUN" -eq 1 ]; then
  TEMPLATE_FILE="debian-12-standard_<latest>_amd64.tar.zst"
  printf '   $ pveam update\n'
  printf '   $ pveam available --section system | latest debian-12-standard\n'
  printf '   $ pveam download %s %s   (if absent)\n' "$TEMPLATE_STORAGE" "$TEMPLATE_FILE"
else
  pveam update >/dev/null
  TEMPLATE_FILE="$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | sort -V | tail -n1)"
  [ -n "$TEMPLATE_FILE" ] || { echo "No debian-12-standard template found."; exit 1; }
  if ! pveam list "$TEMPLATE_STORAGE" | grep -q "$TEMPLATE_FILE"; then
    say "Downloading $TEMPLATE_FILE to $TEMPLATE_STORAGE..."
    pveam download "$TEMPLATE_STORAGE" "$TEMPLATE_FILE"
  fi
fi
TEMPLATE_REF="${TEMPLATE_STORAGE}:vztmpl/${TEMPLATE_FILE}"

# ---- Create the container --------------------------------------------------
if [ -z "$CTID" ]; then
  if [ "$DRY_RUN" -eq 1 ]; then
    CTID="<next free vmid>"
  else
    CTID="$(pvesh get /cluster/nextid)"
  fi
fi

say "Creating LXC $CTID ($CT_HOSTNAME)..."
run pct create "$CTID" "$TEMPLATE_REF" \
  --hostname "$CT_HOSTNAME" \
  --cores "$CORES" --memory "$MEMORY_MB" --swap "$SWAP_MB" \
  --rootfs "${STORAGE}:${DISK_GB}" \
  --net0 "name=eth0,bridge=${BRIDGE},ip=dhcp" \
  --unprivileged 1 --onboot 1 --start 1

say "Waiting for the container to boot and get an IP..."
if [ "$DRY_RUN" -eq 1 ]; then
  IP="<container-ip>"
  printf '   $ wait for pct status running, then hostname -I\n'
else
  until [ "$(pct status "$CTID")" = "status: running" ]; do sleep 1; done
  IP=""
  for _ in $(seq 1 30); do
    IP="$(pct exec "$CTID" -- bash -c "hostname -I 2>/dev/null | awk '{print \$1}'" || true)"
    [ -n "$IP" ] && break
    sleep 2
  done
  [ -n "$IP" ] || { echo "Container did not get an IP; check your bridge/DHCP."; exit 1; }
  say "Container IP: $IP"
fi

# ---- Files staged on the host, pushed into the container -------------------

read -r -d '' UNIT <<UNITEOF || true
[Unit]
Description=baritonic — personal chord chart reader
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
WorkingDirectory=${APP_DIR}/apps/server
Environment=NODE_ENV=production
Environment=PORT=${APP_PORT}
Environment=BIND_ADDR=${BIND_ADDR}
Environment=DATA_DIR=${DATA_DIR}
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning --experimental-strip-types src/server.ts
Restart=on-failure
RestartSec=5

# The service needs nothing beyond its own data directory.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
UNITEOF

read -r -d '' PROVISION <<PROVEOF || true
#!/usr/bin/env bash
#
# Installs and updates baritonic inside the container. Idempotent: re-run it
# to deploy a new release. The database in ${DATA_DIR} is never touched.
#
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq curl ca-certificates git gnupg

# NodeSource: Debian's own node is far too old. baritonic needs node:sqlite
# from the standard library, which is stable from ${NODE_MAJOR}.
if ! command -v node >/dev/null || [ "\$(node -p 'process.versions.node.split(".")[0]')" -lt ${NODE_MAJOR} ]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
fi

id -u ${SERVICE_USER} >/dev/null 2>&1 || \\
  useradd --system --create-home --home-dir /var/lib/${SERVICE_USER} --shell /usr/sbin/nologin ${SERVICE_USER}

# Clone, or fast-forward an existing checkout.
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" fetch --depth 1 origin ${BRANCH}
  git -C "${APP_DIR}" reset --hard origin/${BRANCH}
else
  rm -rf "${APP_DIR}"
  git clone --depth 1 --branch ${BRANCH} "${REPO}" "${APP_DIR}"
fi

# The web app is built here rather than on the Proxmox host, so the
# hypervisor needs no toolchain. devDependencies are required to build.
cd "${APP_DIR}/apps/web"
npm ci --no-audit --no-fund --silent
npm run build --silent

# Server dependencies only. node:sqlite is in the standard library, so this
# tree is pure JavaScript and there is nothing to compile.
cd "${APP_DIR}/apps/server"
npm ci --omit=dev --no-audit --no-fund --silent

# npm links the workspace packages into apps/server/node_modules, which
# resolves them for the server itself — but ug-import's own source imports
# music-core, and Node resolves that from the package's real path, walking
# up from packages/ug-import/. A link directory at the repo root sits on
# that path, so it resolves from anywhere in the tree.
mkdir -p "${APP_DIR}/node_modules/@baritonic"
ln -sfn "${APP_DIR}/packages/music-core" "${APP_DIR}/node_modules/@baritonic/music-core"
ln -sfn "${APP_DIR}/packages/ug-import"  "${APP_DIR}/node_modules/@baritonic/ug-import"

mkdir -p "${DATA_DIR}"
chown -R ${SERVICE_USER}:${SERVICE_USER} "${APP_DIR}" "${DATA_DIR}"

install -m 644 /root/baritonic.service /etc/systemd/system/baritonic.service
systemctl daemon-reload
systemctl enable baritonic >/dev/null 2>&1 || true
systemctl restart baritonic
PROVEOF

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "--- /etc/systemd/system/baritonic.service ---"
  printf '%s\n' "$UNIT" | sed 's/^/   | /'
  echo
  echo "--- /root/provision.sh ---"
  printf '%s\n' "$PROVISION" | sed 's/^/   | /'
  echo
else
  printf '%s\n' "$UNIT" > /tmp/baritonic.service
  printf '%s\n' "$PROVISION" > /tmp/baritonic-provision.sh
fi

say "Pushing files into the container..."
run pct push "$CTID" /tmp/baritonic.service        /root/baritonic.service
run pct push "$CTID" /tmp/baritonic-provision.sh   /root/provision.sh

say "Provisioning (Node ${NODE_MAJOR}, clone, build, systemd)..."
run pct exec "$CTID" -- bash /root/provision.sh

if [ "$DRY_RUN" -eq 0 ]; then
  rm -f /tmp/baritonic.service /tmp/baritonic-provision.sh
fi

# ---- Wait for the service to answer ----------------------------------------
say "Waiting for /healthz..."
if [ "$DRY_RUN" -eq 1 ]; then
  printf '   $ curl -fsS http://<container-ip>:%s/healthz\n' "$APP_PORT"
else
  tries=0
  until curl -fsS "http://${IP}:${APP_PORT}/healthz" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 60 ]; then
      echo
      pct exec "$CTID" -- journalctl -u baritonic -n 40 --no-pager || true
      echo "baritonic did not become healthy. Recent log above."
      exit 1
    fi
    sleep 1
  done
  say "healthy after ${tries}s"
fi

cat <<DONE

============================================================
 baritonic deployed in LXC ${CTID} (${CT_HOSTNAME})

   Web UI:   http://${IP}:${APP_PORT}

   No login: the app is single-user and has no authentication.
   Keep it on a trusted network.

 Useful commands (on the Proxmox host):
   Logs:     pct exec ${CTID} -- journalctl -u baritonic -f
   Restart:  pct exec ${CTID} -- systemctl restart baritonic
   Update:   pct exec ${CTID} -- bash /root/provision.sh
   Back up:  pct pull ${CTID} ${DATA_DIR}/baritonic.db ./baritonic-backup.db

 Update pulls the latest ${BRANCH}, rebuilds, and restarts.
 Your library in ${DATA_DIR} is never touched.
============================================================
DONE
