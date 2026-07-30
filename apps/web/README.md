# @baritonic/web

React frontend for baritonic.

## Development

Two processes. The API first:

    cd apps/server && npm run dev        # http://127.0.0.1:4173

Then the web dev server, which proxies `/api` to it:

    cd apps/web && npm run dev           # http://127.0.0.1:5173

## Production

    cd apps/web && npm run build

The server serves `apps/web/dist` from its own origin, so there is one
process and one port in the container. With no build present the API still
runs and says so at boot.

## Design

Palette and typography follow the approved mockups: damper-felt crimson as
the single accent against ivory and ebony, monospace for chords and data,
system sans for lyrics. Tokens live in `src/styles/tokens.css` and both
themes are defined there — style through the tokens, never inside a media
query.

## Two things worth knowing before changing this code

**Changing key performs no network request.** `transposeDocument` runs in
the browser over the stored document, in a `useMemo`. The server stores one
version of each song and has no transpose endpoint. A test asserts that
switching keys calls no API method.

**Chords are anchored to positions in the lyric text, never to character
columns.** `src/music/units.ts` converts a line plus its anchors into
independently laid out units, each owning one anchor and the text after it.
That is why a symbol growing from `E` to `C#m` widens its own unit instead
of pushing every later chord off its syllable. Two tests cover it directly,
asserting that transposing a document leaves every chord above the same
lyric fragment.
