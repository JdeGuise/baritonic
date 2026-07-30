import { describe, it, expect } from "vitest";
import type { Song } from "../src/document";
import { collectSymbols } from "../src/document";
import { transposeDocument } from "../src/transpose";

const doc: Song = {
  sections: [
    { label: "Intro", lines: [{ kind: "chords", chords: [{ sym: "E", at: 0 }, { sym: "Emaj7", at: 1 }] }] },
    {
      label: "Verse",
      lines: [
        { kind: "lyric", text: "placeholder words here", chords: [{ sym: "E", at: 0 }, { sym: "C#m", at: 12 }] },
        { kind: "text", text: "Note: played with a piano." },
      ],
    },
  ],
};

describe("collectSymbols", () => {
  it("returns every symbol in document order", () => {
    expect(collectSymbols(doc)).toEqual(["E", "Emaj7", "E", "C#m"]);
  });
});

describe("transposeDocument", () => {
  const out = transposeDocument(doc, "E", "C");

  it("transposes every chord symbol", () => {
    expect(collectSymbols(out)).toEqual(["C", "Cmaj7", "C", "Am"]);
  });

  it("leaves anchors untouched", () => {
    const line = out.sections[1]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords.map((c) => c.at)).toEqual([0, 12]);
    expect(line.text).toBe("placeholder words here");
  });

  it("leaves section labels and text lines untouched", () => {
    expect(out.sections.map((s) => s.label)).toEqual(["Intro", "Verse"]);
    const note = out.sections[1]!.lines[1]!;
    expect(note).toEqual({ kind: "text", text: "Note: played with a piano." });
  });

  it("does not mutate the input", () => {
    expect(collectSymbols(doc)).toEqual(["E", "Emaj7", "E", "C#m"]);
  });
});
