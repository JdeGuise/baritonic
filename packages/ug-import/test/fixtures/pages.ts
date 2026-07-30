/** Synthetic pages shaped like Ultimate Guitar's, with placeholder
 *  content. Hand-authored so each fixture exercises one condition. */

function page(payload: unknown): string {
  const json = JSON.stringify(payload)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  return `<!doctype html><html><body>
<div class="js-store" data-content="${json}"></div>
</body></html>`;
}

export const SIMPLE_BODY = [
  "[Intro]",
  "[ch]C[/ch] [ch]G[/ch]",
  "",
  "[Verse]",
  "[tab][ch]C[/ch]          [ch]Am[/ch]",
  "placeholder words go here[/tab]",
].join("\r\n");

export const GOOD_PAGE = page({
  store: {
    page: {
      data: {
        tab: {
          id: 12345,
          version: 2,
          song_name: "Placeholder Song",
          artist_name: "Demo Artist",
          type: "Chords",
          rating: 4.88,
          votes: 2232,
          username: "demo_user",
        },
        tab_view: {
          wiki_tab: { content: SIMPLE_BODY },
          meta: { tuning: { name: "Standard", value: "E A D G B E" } },
          stats: { view_total: 911997 },
        },
      },
    },
  },
});

/** A Pro tab: metadata present, no readable body. */
export const PRO_PAGE = page({
  store: {
    page: {
      data: {
        tab: { id: 999, song_name: "Pro Song", artist_name: "Demo Artist", type: "Pro" },
        tab_view: { meta: {} },
      },
    },
  },
});

/** The site changed shape: the store is there but page.data is not. */
export const SCHEMA_DRIFT_PAGE = page({ store: { something_else: true } });

/** A Cloudflare-style interstitial with no store at all. */
export const CHALLENGE_PAGE =
  "<!doctype html><html><body><h1>Checking your browser…</h1></body></html>";
