# Deploying music-ui to Proxmox

Copy **one file** to the Proxmox host and run it. Nothing else needs to be
there — the container clones and builds the project itself, so the
hypervisor never needs Node or a checkout.

## Prerequisite

The container clones over plain HTTPS with no credentials, so **the repo
must be public**. If it is private, either make it public or set `REPO` to a
URL the container can reach.

## First run

    scp deploy/provision-lxc.sh root@proxmox:/root/
    ssh root@proxmox
    chmod +x provision-lxc.sh
    ./provision-lxc.sh --dry-run    # read the plan first
    ./provision-lxc.sh

It prints the URL once the service answers `/healthz`.

## Updating

Re-run the provision script **inside the container**:

    pct exec 210 -- bash /root/provision.sh

That fetches the latest `main`, rebuilds the web app, reinstalls
dependencies, and restarts the service. It is the same code path as the
initial install, so there is no second script to drift out of date.

**Your library is never touched.** The database lives in
`/var/lib/music-ui`, outside the application directory, and nothing in the
update path writes there.

Worth doing first, since there is no rollback mechanism:

    pct pull 210 /var/lib/music-ui/music-ui.db ./music-ui-backup-$(date +%F).db

To roll back, set `BRANCH` to a tag or commit and re-run the provision
script.

## Configuration

Everything is an environment variable; `--help` lists them. Set them inline:

    CT_HOSTNAME=music STORAGE=local-zfs MEMORY_MB=2048 ./provision-lxc.sh

    CTID=<next free>          container id, auto-picked if unset
    CT_HOSTNAME=music-ui
    STORAGE=local-lvm         storage for the container rootfs
    TEMPLATE_STORAGE=local    storage holding LXC templates
    BRIDGE=vmbr0
    DISK_GB=6                 the web build's node_modules is ~300MB
    MEMORY_MB=1024
    CORES=2
    APP_PORT=4173
    NODE_MAJOR=24             below this, node:sqlite is unavailable
    REPO=https://github.com/JdeGuise/music-ui
    BRANCH=main

The Debian 12 template is resolved and downloaded automatically — the newest
`debian-12-standard` in the Proxmox index — so there is no filename to keep
current.

## Operating it

    pct exec 210 -- systemctl status music-ui
    pct exec 210 -- journalctl -u music-ui -f
    pct exec 210 -- systemctl restart music-ui

## Notes

**No authentication.** The service binds `0.0.0.0` so it is reachable on your
LAN, set explicitly in the unit rather than inherited — the app itself
defaults to loopback. Keep it on a trusted network. If you ever need it from
outside, put a reverse proxy with auth in front rather than adding a login to
the app.

**The build happens in the container.** `apps/web` needs devDependencies to
build, so the container installs them; `apps/server` gets `--omit=dev` only.
Server dependencies are a pure-JavaScript tree — `node:sqlite` is in the Node
standard library, so no compiler toolchain is required anywhere.

**The server runs from TypeScript source** under Node's type stripping, so
only the web app has a build step. Type *checking* happens on your machine
and in CI, never at runtime. This is also why `NODE_MAJOR` defaults to 24.

**Workspace packages are linked at the repo root.** `npm` links them into
`apps/server/node_modules`, which resolves them for the server — but
`ug-import`'s own source imports `music-core`, and Node resolves that from
the package's real path, walking up from `packages/ug-import/`. The
provision script creates `node_modules/@music-ui/*` at the repo root, which
is on that upward path. Without it the service does not start.

## Testing the script

    ./deploy/test-provision.sh

36 assertions. Drives `provision-lxc.sh --dry-run`, extracts the generated
systemd unit and provision script back out of the output, parses the
provision script with `bash -n`, and checks both for the things that matter.
Needs no Proxmox host, no root, and has no side effects.

That proves the generated artifacts are correct — not that `pct create`
succeeds on your hardware. The first live run is worth watching.
