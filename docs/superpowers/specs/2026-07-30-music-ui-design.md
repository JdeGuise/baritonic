# music-ui — design

**Date:** 2026-07-30
**Status:** Approved, ready for implementation planning

## Goal

A personal chord-chart reader. Import a song from Ultimate Guitar by URL, store it locally,
and read it back as lyrics with chords above them and piano diagrams below — in whatever key
suits the singer, not the key the tab happens to be written in.

The driving need: much popular material is written in guitar-friendly keys like E, which sit
too high for a baritone. Moving a song to C should be one click, and everything on screen —
chord symbols, note spellings, keyboard diagrams, fingerings — should follow.

## Non-goals

- Guitar chord diagrams. Piano only for v1. A guitar mode may come later.
- Playback, audio, or MIDI.
- Multi-user accounts, sharing, or public hosting. Single user, internal network only.
- Melody-aware vocal range analysis. Chord tabs carry no melody data. Deferred.
- Re-hosting or redistributing imported content. The library is personal.

## Architecture

```
packages/
  music-core/     pure TypeScript. No React, no HTTP, no database.
  ug-import/      fetch + parse Ultimate Guitar into the normalized document
apps/
  server/         Express + SQLite. Thin.
  web/            React + Vite
deploy/
  provision-lxc.sh
```

The load-bearing decision is that `music-core` depends on nothing. It holds all the music
theory, which is the only genuinely difficult logic in the project, and it can be tested
exhaustively without a browser or a database in the way.

### Transposition is a pure function applied at render time

The database stores **exactly one** version of each song: the original, as imported. The
target key is a view parameter, not stored content. Your preferred key is a stored string, not
a stored document.

Consequences:

- Changing key touches no network and writes nothing.
- There is no cache to invalidate and no copies to drift apart.
- There is deliberately **no transpose endpoint**.

Both sides need the theory: the server detects the source key at import time, the client
applies the target key at render time. Hence the shared package.

### Transposition is never chained

Every transposition is computed from the stored original. Chaining (E → Db → E) is lossy,
because enharmonic normalization discards the original letter and cannot restore it. This is
verified behavior, not an assumption — see Testing.

## The normalized document

Ultimate Guitar stores chords on a monospace line above the lyric line, aligned by character
column. Preserving those columns through transposition does not work: symbol widths change
(`E` → `C#m` grows two characters), so re-padding pushes every later chord off its syllable,
and down-transposing makes them collide.

**Chords are therefore stored as anchors into the lyric string, and character columns are
discarded at import.**

```ts
type Song    = { sections: Section[] }
type Section = { label: string; lines: Line[] }

type Line =
  | { kind: "lyric";  text: string; chords: ChordRef[] }
  | { kind: "chords"; chords: ChordRef[] }   // instrumental, nothing to anchor to
  | { kind: "text";   text: string }         // performance notes from the contributor

type ChordRef = { sym: string; at: number }  // `at` indexes into the lyric text
```

Because `at` is an index into text rather than a column, the rendered chart survives
transposition, font-size changes, window resizing, and line wrapping. The renderer emits one
inline-block unit per anchor: chord on top, lyric fragment beneath.

Everything downstream — transposition, diagrams, stage view, print — is a function over this
tree.

## music-core

### Chord symbols

Grammar, in order: `ROOT · ACCIDENTAL? · QUALITY? · EXTENSIONS* · (/BASS)?`

Parsed into a struct, never manipulated as a string:

```ts
type Chord = { root: Note; quality: string; bass: Note | null }
type Note  = { letter: "A".."G"; acc: -2..2 }
```

The root and bass move under transposition. **Quality and extensions are never touched.**

The accidental pattern must accept one *or two* characters (`#`, `##`, `b`, `bb`). A
single-character pattern silently mis-parses `Bbb` as root `Bb` + quality `bdim`. This was a
real bug found during mockup verification.

Reference vocabulary, taken from a real imported tab and used as the parser's baseline test
set:

```
E  Emaj7  Esus2  B  Bsus2  Bsus4  C#m  C#  C  A#  Am  A
Cdim  Eaug  F#m  F#m6  F#m7  F#7/A#  F#/A#  C#/B  C#/A  C#/G#  C#maj7/C  E/B
```

Unparseable symbols are preserved verbatim and rendered dimmed with a tooltip. Never dropped,
never guessed at.

### Transposition and enharmonic spelling

Naive semitone arithmetic emits sharps unconditionally and produces wrong spellings in flat
keys. The correct approach moves the **letter** and the **semitone** independently.

E → C is down a major third: **letter −2, semitone −4**. Applying that pair to each note
yields correct spelling as a by-product:

| Source (E) | Result (C) |
|---|---|
| `B` | `G` |
| `C#m` | `Am` |
| `A#` | `F#` |
| `F#/A#` | `D/F#` |
| `Cdim` | `Abdim` |
| `C#maj7/C` | `Amaj7/Ab` |
| `C#/G#` | `A/E` |

`Cdim` becomes `Abdim` rather than `G#dim` because C major is a flat-side key and the letter
arithmetic lands there on its own.

Two normalization passes follow, in order:

1. **Double-accidental removal.** A letter shift can legitimately produce `Bbb`. Respell as
   the nearest single-accidental name, preferring the direction the target key leans (flat
   keys: `F Bb Eb Ab Db Gb`).
2. **Readability.** `Cb`, `Fb`, `B#` and `E#` are correct only in keys whose signature
   contains them. Keep them in `Gb`, `Cb`, `B`, `F#`, `C#`; elsewhere fall back to the natural
   spelling. Without this, transposing to Ab yields `Fb` — theoretically the flat-VI, and
   something no one writes on a chart they intend to read while playing.

### Key detection

Ultimate Guitar's `tonality_name` field is frequently empty, so detection is required rather
than optional.

Score all 24 candidate keys (12 major, 12 minor) on:

- count of distinct chords diatonic to the key
- the first chord of the song
- the last chord of the song, weighted highest — cadences resolve to the tonic
- the most frequent chord
- whether the tonic triad quality matches the candidate's mode

Return the best key with a confidence value. Confidence is surfaced in the UI as a chip, and
the detected key renders as an **editable badge** — modal or chromatic material will fool
this, and one click must be enough to correct it. A user correction is stored in
`key_override` and always wins.

### Voicings and voice leading

Every chord gets an inversion chosen to minimize hand movement across the progression.

**Candidates.** For an *n*-note chord, the *n* inversions, each realized as an ascending pitch
set from a base octave. For slash chords the bass note is fixed by the notation; only the
upper structure's inversion is free.

**Cost.** Between consecutive voicings, the sum over each note in the successor of its
distance to the nearest note in the predecessor, plus a penalty on large bass leaps.

**Selection.** Dynamic programming over the chord sequence — for each chord and each candidate,
the best cumulative cost from any predecessor candidate — then backtrack. Candidate counts are
tiny (3–5 per chord) and sequences are short, so this is cheap and optimal, not greedy.

**Scope.** Computed **per section**, not across the whole song, so a chorus voices identically
every time it appears rather than drifting based on what preceded it.

**Overrides.** A manual inversion choice pins that chord to a single candidate. The DP then
runs around it, so neighbouring chords adapt to your choice rather than fighting it.

### Fingering

Right hand, a lookup on note count and inversion:

| Notes | Inversion | Fingering |
|---|---|---|
| 3 | root | 1‑3‑5 |
| 3 | 1st | 1‑2‑5 |
| 3 | 2nd | 1‑3‑5 |
| 4 | any | 1‑2‑3‑5 |
| 5 | any | 1‑2‑3‑4‑5 |

Slash chords assign the bass to the left hand, rendered as an outlined key.

## ug-import

### Fetch and parse

The page is server-rendered with the entire payload in a single embedded JSON blob:
`<div class="js-store" data-content="...">`, HTML-escaped. Unescape, `JSON.parse`, then read
`store.page.data`. No JavaScript execution, no headless browser, no API key.

Fields consumed: `tab.song_name`, `tab.artist_name`, `tab.id`, `tab.version`, `tab.type`,
`tab.rating`, `tab.votes`, `tab.username`, `tab.date`, `tab_view.meta.tuning`,
`tab_view.stats`, and the body at `tab_view.wiki_tab.content`.

The body uses exactly four markup tokens: `[ch]…[/ch]` around a chord symbol and `[tab]…[/tab]`
around a chord-line/lyric-line pair. Section headers appear as bare bracketed words
(`[Intro]`, `[Chorus]`) with no closing tag — so match the two real tag pairs specifically
rather than regexing all brackets. Line endings are `\r\n`.

Parsing converts column-aligned chord lines into anchored `ChordRef`s and discards the
columns.

### Capo

Where a tab specifies a capo, fold the offset into the detected source key at import and never
surface it. Capo is a guitar affordance and meaningless on piano. If a guitar mode is added
later, the raw value remains recoverable from `raw_body`.

### Failure modes

Server-side fetching is the fragile part, and more so from a container than from a laptop.
Each failure gets a distinct message naming its cause and remedy:

| Condition | Message |
|---|---|
| Cloudflare challenge / non-200 | UG returned a challenge page — try pasting the text instead |
| `js-store` missing or schema changed | Couldn't read this page's data — the site format may have changed |
| Pro / official tab, no body in payload | This looks like a Pro tab, which has no readable chord data |
| Body present but unparseable | Imported, but *n* chords couldn't be read — they're marked in the chart |

**Paste is a peer tab in the import UI, not a buried fallback.** If the container is ever
blocked outright, the app keeps working. All extraction is wrapped in defensive accessors; the
embedded schema is undocumented and changes without notice.

Import is a one-time act. Nothing is re-fetched automatically.

## Data model

```sql
song (
  id INTEGER PRIMARY KEY,
  source_url TEXT UNIQUE,          -- null for pasted imports
  ug_tab_id INTEGER, ug_version INTEGER,
  artist TEXT NOT NULL, title TEXT NOT NULL, tab_type TEXT,
  detected_key TEXT, detected_key_confidence REAL,
  key_override TEXT,               -- user correction; wins over detection
  preferred_key TEXT,              -- the key this song opens in
  tuning TEXT,
  raw_body TEXT NOT NULL,          -- verbatim UG content
  document JSON NOT NULL,          -- normalized document
  ug_meta JSON,                    -- rating, votes, contributor, view count
  imported_at TEXT, updated_at TEXT
)

chord_override (
  id INTEGER PRIMARY KEY,
  song_id INTEGER NOT NULL REFERENCES song(id) ON DELETE CASCADE,
  section_idx INTEGER, line_idx INTEGER, chord_idx INTEGER,
  original_sym TEXT NOT NULL,      -- what was there when the override was made
  corrected_sym TEXT,              -- null if this override only sets an inversion
  inversion INTEGER,               -- null if this override only corrects the symbol
  created_at TEXT,
  UNIQUE (song_id, section_idx, line_idx, chord_idx)
)
```

**`raw_body` is kept permanently.** The parser will improve and UG's chord vocabulary will
surprise it. Keeping the original text means the whole library can be re-parsed after a fix,
with no network access and no dependency on the tab still existing. A few KB per song.

**`document` stays a JSON blob.** A song's structure is never queried into — it is always
loaded whole and handed to the renderer. Shredding it into `section`/`line`/`chord` tables
would buy nothing and cost joins. If chord search across the library is wanted later, that is
an index built alongside, not a reason to normalize.

**Overrides are a patch layer, not a mutation.** They are applied over the parsed document at
load time, which is what allows re-parsing without destroying corrections. `original_sym` is
the safety check: on re-parse, if the symbol at those indices no longer matches, the override
is marked **orphaned** and surfaced for review rather than silently applied to the wrong chord
or silently discarded.

No `user` table. A nullable `user_id` is an additive migration if it is ever needed.

## Server

```
GET    /api/songs                list
POST   /api/songs                import — accepts { url } or { artist, title, rawBody }
GET    /api/songs/:id            song + overrides
PATCH  /api/songs/:id            key_override, preferred_key, title, artist
DELETE /api/songs/:id
PUT    /api/songs/:id/overrides/:sectionIdx/:lineIdx/:chordIdx
DELETE /api/songs/:id/overrides/:sectionIdx/:lineIdx/:chordIdx
GET    /healthz
```

One Node process serves both the API and the built React assets from a single port. No nginx
inside the container, nothing to keep in sync. Configuration entirely by environment:
`PORT`, `DATA_DIR`, `BIND_ADDR`.

No authentication. The app is internal-only and not reachable from the internet; the network
boundary does that work. If it is ever exposed, the answer is a reverse proxy with auth in
front, not a login screen bolted into the app.

## Web app

### Screens

**Library** — one row per song. Source key and preferred key are the primary column, with the
arrow between them, because that gap is the point of the application. Low-confidence
detections are flagged at rest so they invite confirmation rather than hiding. Search covers
title, artist, and chord symbols.

**Import** — URL and paste as sibling tabs. Detected metadata (artist, title, type, tuning,
key, confidence) is shown before the song is committed to the library.

**Song** — the chart. A written-key badge (editable), a target-key selector, the semitone
delta, and a reset control. Below the chart, one card per distinct chord: keyboard diagram
with chord tones highlighted, finger numbers on the highlighted keys, and note names spelled
to the target key.

**Stage** — a separate full-screen route. Large type, no navigation or controls at rest,
continuous auto-scroll with a speed slider and play/pause, and a Wake Lock so the display does
not sleep mid-song. Escape exits. Chord tabs carry no reliable tempo data, so scroll speed is
set by feel.

### Inline correction

Chord symbols only in v1 — that is where Ultimate Guitar is actually wrong. Click a chord,
type a replacement; it re-parses immediately, and an invalid symbol is rejected in place with
the reason. Saved as a `chord_override` row.

Lyrics, section labels, and chord re-anchoring are explicitly out of scope for v1.

### Print

A print stylesheet renders the chart at the currently selected key, avoids page breaks inside
sections, and offers a toggle for including or suppressing the piano diagrams.

## Testing

`music-core` is pure functions and gets real coverage:

- **Unit** — chord parsing across the reference vocabulary; each transposition in the E → C
  table above.
- **Property, over the full chord vocabulary × 12 target keys (288 cases).** Asserted:
  no output contains a double accidental; every output re-parses; `Cb`/`Fb`/`B#`/`E#` appear
  only in keys whose signature contains them. This sweep was run during design and all three
  properties hold; it becomes a standing test.
- **Voice leading** — total hand movement is no worse than the all-root-position baseline; a
  pinned override is always honoured; a section voices identically on each repeat.
- **Key detection** — a fixture set of tabs with known keys.

`ug-import` is tested against **saved HTML fixtures**, not the live site, so the suite is
deterministic and offline. At least one fixture per failure mode.

Server gets integration tests against a temporary SQLite file, including override
orphan-detection on re-parse. Web gets component tests for the anchored-chord renderer,
specifically that anchors hold when symbol widths change.

## Deployment

`deploy/provision-lxc.sh` runs **on the Proxmox host** and is re-runnable:

1. `pct create` an unprivileged Debian container with configured ID, hostname, storage,
   network
2. install Node inside it
3. create a non-root service user and `DATA_DIR`
4. copy in a built release, `npm ci --omit=dev`
5. install and enable a systemd unit with the environment configured, restart-on-failure
6. wait on `/healthz` and print the reachable URL

Backup is copying one `.db` file out of `DATA_DIR`.

**Prerequisite:** the development machine currently has no Node, npm, bun, or deno installed.
Node must be installed before any build step.

## Implementation sequence

Each phase is independently verifiable, and the risky logic comes first.

1. `music-core` — chord parsing, transposition, spelling, key detection, voicings, fingering.
   No UI. Complete test suite.
2. `ug-import` — fetch, parse, capo folding, failure modes, HTML fixtures.
3. `server` — schema, migrations, API, override patch/orphan logic.
4. `web` — library, import, song view with live transposition and diagrams.
5. Inline chord correction and manual inversion overrides.
6. Stage view and print stylesheet.
7. `provision-lxc.sh`.

## Deferred to v2

- Vocal range input and key suggestion. Requires melody data that chord tabs do not carry.
- Guitar mode: fretboard diagrams and capo handling.
- Lyric, section-label, and chord re-anchoring edits.
- Chord search index across the library.
- Setlists and song ordering.
