import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import type { Line } from "@music-ui/music-core";
import { importFromHtml } from "../src/import";

/** A real saved tab page, kept out of the repository. This suite skips
 *  when the file is absent, so it is a local smoke check rather than a
 *  dependency. Everything it reports is structural — counts, labels,
 *  detected key — never tab content. */
const PATH = "test/fixtures/local/real-page.html";

type LyricLine = Extract<Line, { kind: "lyric" }>;

describe.skipIf(!existsSync(PATH))("real page smoke check", () => {
  it("imports a genuine Ultimate Guitar page", () => {
    const r = importFromHtml(readFileSync(PATH, "utf8"));

    const lines: Line[] = r.document.sections.flatMap((s) => s.lines);
    const lyricLines = lines.filter((l): l is LyricLine => l.kind === "lyric");
    const chordCount = lines.reduce(
      (n: number, l: Line) => n + (l.kind === "text" ? 0 : l.chords.length),
      0,
    );

    console.log("  artist/title :", r.meta.artist, "—", r.meta.title);
    console.log("  type/version :", r.meta.tabType, "v" + r.meta.ugVersion);
    console.log("  tuning       :", r.meta.tuning);
    console.log(
      "  detected key :",
      r.detectedKey,
      r.detectedMode,
      "(confidence " + r.keyConfidence.toFixed(2) + ")",
    );
    console.log(
      "  sections     :",
      r.document.sections.length,
      "→",
      r.document.sections.map((s) => s.label || "(preamble)").join(", "),
    );
    console.log("  lines        :", lines.length, "(" + lyricLines.length + " with lyrics)");
    console.log("  chords       :", chordCount);
    console.log(
      "  unparseable  :",
      r.unparseableChords.length === 0 ? "none" : r.unparseableChords.join(", "),
    );

    expect(r.meta.artist.length).toBeGreaterThan(0);
    expect(r.meta.title.length).toBeGreaterThan(0);
    expect(r.document.sections.length).toBeGreaterThan(0);
    expect(chordCount).toBeGreaterThan(0);

    // Every anchor must land inside the lyric it belongs to.
    for (const l of lyricLines) {
      for (const c of l.chords) {
        expect(c.at).toBeGreaterThanOrEqual(0);
        expect(c.at).toBeLessThanOrEqual(l.text.length);
      }
    }
  });
});
