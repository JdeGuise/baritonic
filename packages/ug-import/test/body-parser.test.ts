import { describe, it, expect } from "vitest";
import { parseBody } from "../src/body-parser";
import { SIMPLE_BODY } from "./fixtures/pages";

const crlf = (lines: string[]) => lines.join("\r\n");

describe("parseBody", () => {
  it("splits sections on bracketed headers", () => {
    const { document } = parseBody(SIMPLE_BODY);
    expect(document.sections.map((s) => s.label)).toEqual(["Intro", "Verse"]);
  });

  it("anchors chords to positions in the lyric text", () => {
    const { document } = parseBody(SIMPLE_BODY);
    const verse = document.sections[1]!;
    const line = verse.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.text).toBe("placeholder words go here");
    expect(line.chords).toEqual([
      { sym: "C", at: 0 },
      { sym: "Am", at: 11 },
    ]);
  });

  it("treats an unpaired chord line as instrumental", () => {
    const { document } = parseBody(SIMPLE_BODY);
    const intro = document.sections[0]!;
    expect(intro.lines).toHaveLength(1);
    expect(intro.lines[0]!.kind).toBe("chords");
  });

  it("clamps an anchor that runs past the end of its lyric", () => {
    const body = crlf(["[Verse]", "[ch]C[/ch]                    [ch]G[/ch]", "short"]);
    const { document } = parseBody(body);
    const line = document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.text).toBe("short");
    expect(line.chords[1]!.at).toBe(5); // clamped to text length
  });

  it("keeps two chords landing on the same syllable", () => {
    const body = crlf(["[Verse]", "[ch]C[/ch][ch]G[/ch]", "word"]);
    const { document } = parseBody(body);
    const line = document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords.map((c) => c.sym)).toEqual(["C", "G"]);
  });

  it("keeps performance notes as text lines", () => {
    const body = crlf(["Note: played on a piano.", "", "[Verse]", "[ch]C[/ch]"]);
    const { document } = parseBody(body);
    expect(document.sections[0]!.label).toBe("");
    expect(document.sections[0]!.lines[0]).toEqual({
      kind: "text",
      text: "Note: played on a piano.",
    });
  });

  it("reports unparseable chords but keeps them in the document", () => {
    const body = crlf(["[Verse]", "[ch]C[/ch] [ch]N.C.[/ch]", "words here"]);
    const { document, unparseableChords } = parseBody(body);
    expect(unparseableChords).toEqual(["N.C."]);
    const line = document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords.map((c) => c.sym)).toEqual(["C", "N.C."]);
  });

  it("does not report the same unparseable symbol twice", () => {
    const body = crlf(["[Verse]", "[ch]N.C.[/ch] [ch]N.C.[/ch]", "words"]);
    expect(parseBody(body).unparseableChords).toEqual(["N.C."]);
  });

  it("handles bare newlines as well as CRLF", () => {
    const { document } = parseBody("[Verse]\n[ch]C[/ch]\nwords");
    expect(document.sections[0]!.lines[0]!.kind).toBe("lyric");
  });

  it("drops empty sections", () => {
    const { document } = parseBody(crlf(["[Intro]", "", "[Verse]", "[ch]C[/ch]"]));
    expect(document.sections.map((s) => s.label)).toEqual(["Verse"]);
  });

  it("handles an empty body", () => {
    expect(parseBody("").document.sections).toEqual([]);
  });
});
