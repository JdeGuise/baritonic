# Deploying music-ui to Proxmox

One script, run on the Proxmox host as root, creates an unprivileged
Debian container and installs music-ui as a systemd service.

## First run

Copy the repository to the Proxmox host, then:

    cd music-ui
    ./deploy/provision-lxc.sh --dry-run    # read the plan first
    ./deploy/provision-lxc.sh

It prints the URL when the service answers `/healthz`.

## Configuration

Everything is an environment variable. `--help` lists them with their
current defaults. The ones you are most likely to set:

    CTID=210                     container id
    IPV4=192.168.1.50/24         static address instead of dhcp
    GATEWAY=192.168.1.1          required with a static address
    ROOTFS_STORAGE=local-lvm     Proxmox storage for the root disk
    TEMPLATE=debian-12-standard_12.7-1_amd64.tar.zst
    APP_PORT=4173

If the template is missing, fetch it on the host first:

    pveam update
    pveam available --section system
    pveam download local debian-12-standard_12.7-1_amd64.tar.zst

## Re-running

Safe and expected. An existing container is redeployed into, not
recreated: the web app is rebuilt, the release is pushed, dependencies
are reinstalled, and the service restarts. **The database is untouched.**

## Operating it

    pct exec 210 -- systemctl status music-ui
    pct exec 210 -- journalctl -u music-ui -f
    pct exec 210 -- systemctl restart music-ui

Back up by copying the one SQLite file out:

    pct pull 210 /var/lib/music-ui/music-ui.db ./music-ui-backup.db

## Notes

**No authentication.** The service binds `0.0.0.0` so it is reachable on
your LAN, and that is set explicitly in the unit rather than inherited —
the app itself defaults to loopback. Keep it on a trusted network. If you
ever need it from outside, put a reverse proxy with auth in front rather
than adding a login to the app.

**No compiler in the container.** The project uses `node:sqlite` from the
Node standard library instead of a native SQLite binding, so
`npm ci --omit=dev` installs a pure-JavaScript tree. This is the single
biggest reason the deploy is boring.

**The server runs from TypeScript source** under Node's type stripping,
so only the web app has a build step. Type *checking* happens on your
machine and in CI, never at runtime. This is also why `NODE_MAJOR`
defaults to 24: below that, `node:sqlite` is not available as a stable
standard-library module and the database layer will not start.

## Testing the script

`./deploy/test-provision.sh` drives the script in `--dry-run` and asserts
on the emitted command plan. It needs no Proxmox host, no root, and has
no side effects.

Note that dry-run coverage is exactly that — it proves the plan is
correct, not that a real `pct create` succeeds on your host. The first
live run is worth watching.
