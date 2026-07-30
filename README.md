# music-ui

A personal chord-chart reader. Import a song from Ultimate Guitar, and read
it back as lyrics with chords above them and piano diagrams below — in
whatever key suits your voice, not the key the tab happens to be written in.

Much popular material is written in guitar-friendly keys like E, which sit
high for a baritone. Moving a song to C should be one click, and everything
on screen — chord symbols, note spellings, keyboard diagrams, fingerings —
should follow.

## Quick start

Requires **Node 24 or newer** (`node:sqlite` must be available as a stable
standard-library module, and the server runs TypeScript directly under
Node's type stripping).

```bash
# one-time
for p in packages/music-core packages/ug-import apps/server apps/web; do
  (cd "$p" && npm install)
done

# two processes
cd apps/server && npm run dev     # http://127.0.0.1:4173
cd apps/web    && npm run dev     # http://127.0.0.1:5173  (proxies /api)
```

Paste an Ultimate Guitar URL into the import screen, or paste the tab text
directly if fetching is blocked.

For production, `apps/web` builds to `dist/` and the server process serves
both the API and those assets from one port. See [`deploy/`](deploy/) for
the Proxmox LXC script.

## What it does

- **Import** by URL or pasted text, with a distinct message for each failure
  mode — Cloudflare challenge, Pro tab with no chord data, site format change
- **Detect the key** from the chord set, with a confidence score, because
  Ultimate Guitar's own tonality field is frequently empty
- **Transpose to any key**, with correct enharmonic spelling — `Cdim` becomes
  `Abdim` rather than `G#dim`, because C major is a flat-side key
- **Piano diagrams** per chord: highlighted tones, finger numbers, and note
  names spelled to the target key
- **Correct wrong chords** inline, even while reading in a transposed key
- **Pin inversions** where the automatic voice leading disagrees with your hands
- **Stage view** — full screen, large type, auto-scroll with speed control,
  and a screen wake lock
- **Print** at the key currently on screen, with or without diagrams

## Layout

```
packages/music-core    music theory. pure functions, zero dependencies
packages/ug-import     Ultimate Guitar → normalized document
apps/server            SQLite, REST API, static assets
apps/web               React frontend
deploy/                Proxmox LXC provisioning
docs/superpowers/      design spec and the seven implementation plans
```

## The decisions worth knowing

**Transposition is a pure client-side function.** The database stores exactly
one version of each song, in the key it was written in. There is deliberately
no transpose endpoint — changing key touches no network and writes nothing.
Both sides import `music-core` because the server needs it to *detect* a key
and the browser needs it to *apply* one.

**Chords anchor to text positions, never character columns.** Ultimate Guitar
aligns chords by monospace column. Preserving that through transposition
fails, because symbol widths change: `E` → `C#m` grows two characters and
shoves every later chord off its syllable. At import the columns are
discarded and each chord is bound to an index into the lyric string, so the
chart survives transposition, resizing, and line wrapping.

**`music-core` depends on nothing.** All the hard logic lives there, testable
without a browser or a database — which is why a 288-case spelling sweep
across the full chord vocabulary and twelve keys is a standing test rather
than a wish.

**The original text is kept forever.** `raw_body` holds the tab exactly as
imported, so the whole library can be re-parsed after a parser improvement
with no network access. Corrections are a patch layer keyed by position,
each remembering the symbol it was made against — if a re-parse shifts the
tree, the correction is reported as orphaned rather than silently applied to
the wrong chord.

**`node:sqlite`, not `better-sqlite3`.** SQLite is in the Node standard
library from 22 onward, so the dependency tree is pure JavaScript and the
container needs no compiler toolchain. This is the single biggest reason the
deploy is boring.

## Testing

409 tests across four packages, plus 25 assertions on the deploy script.

```bash
for p in packages/music-core packages/ug-import apps/server apps/web; do
  (cd "$p" && npm test && npm run typecheck)
done
./deploy/test-provision.sh
```

The suites do not cover everything, by design:

- **Layout** — auto-scroll and the print stylesheet depend on real layout,
  and jsdom has none. Both are verified in a browser.
- **Proxmox** — the provisioning script is exercised in `--dry-run` and its
  packaging verified by simulating the container locally, but a real
  `pct create` needs the host.

Both gaps are the reason each phase ends by actually running the thing. Two
bugs got through entirely green suites and were caught only that way: the
server passing all 89 of its tests while failing to boot at all, and a
module-resolution failure that would have broken the container while every
one of the 409 tests passed.

## Notes

**No authentication.** This is a single-user app for a trusted network. The
server binds loopback by default; the deploy script opens it to the LAN
explicitly, which is a visible line in the systemd unit rather than an
inherited default. If you ever need it from outside the house, put a reverse
proxy with auth in front rather than adding a login.

**Ultimate Guitar has no public API.** Importing reads the JSON payload
embedded in the page. Their terms prohibit scraping, and the embedded schema
is undocumented and changes without notice — hence defensive accessors
everywhere and a paste path that always works. Import once and cache; don't
hammer them.

**Imported tabs are user transcriptions of copyrighted songs.** Fine for a
personal library on your own machine. Redistributing that content is a
licensing problem, which is part of why this is deliberately single-user and
internal-only.
