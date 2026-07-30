import { describe, it, expect } from "vitest";
import type { Song } from "@baritonic/music-core";
import { toWrittenKey, originalSymAt, findOverride } from "../src/music/editing.ts";
import type { ChordOverride } from "../src/api/types.ts";

const doc: Song = {
  sections: [
    {
      label: "Verse",
      lines: [
        {
          kind: "lyric",
          text: "placeholder words here",
          chords: [
            { sym: "E", at: 0 },
            { sym: "C#m", at: 12 },
          ],
        },
        { kind: "text", text: "a note" },
        { kind: "chords", chords: [{ sym: "A", at: 0 }] },
      ],
    },
  ],
};

const at = (sectionIdx: number, lineIdx: number, chordIdx: number) => ({
  sectionIdx,
  lineIdx,
  chordIdx,
});

const override = (o: Partial<ChordOverride>): ChordOverride => ({
  sectionIdx: 0,
  lineIdx: 0,
  chordIdx: 0,
  originalSym: "E",
  correctedSym: null,
  inversion: null,
  ...o,
});

describe("toWrittenKey", () => {
  it("is identity when the view is already the written key", () => {
    expect(toWrittenKey("Am7", "E", "E")).toBe("Am7");
  });

  it("translates a correction typed in the transposed view", () => {
    // Reading in C a song written in E: Am7 on screen is C#m7 on disk.
    expect(toWrittenKey("Am7", "C", "E")).toBe("C#m7");
  });

  it("translates back the way it came", () => {
    expect(toWrittenKey("C", "C", "E")).toBe("E");
    expect(toWrittenKey("F", "C", "E")).toBe("A");
    expect(toWrittenKey("G", "C", "E")).toBe("B");
  });

  it("preserves quality and extensions", () => {
    expect(toWrittenKey("Fmaj7", "C", "E")).toBe("Amaj7");
    expect(toWrittenKey("Dsus4", "C", "E")).toBe("F#sus4");
  });

  it("translates a slash chord's bass too", () => {
    expect(toWrittenKey("C/G", "C", "E")).toBe("E/B");
  });

  it("returns null for an unreadable symbol", () => {
    expect(toWrittenKey("H7", "C", "E")).toBeNull();
    expect(toWrittenKey("", "C", "E")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(toWrittenKey("  Am7  ", "C", "E")).toBe("C#m7");
  });
});

describe("findOverride", () => {
  const overrides = [override({ chordIdx: 0 }), override({ chordIdx: 1, originalSym: "C#m" })];

  it("finds by exact position", () => {
    expect(findOverride(overrides, at(0, 0, 1))?.originalSym).toBe("C#m");
  });

  it("returns undefined when there is none", () => {
    expect(findOverride(overrides, at(0, 2, 0))).toBeUndefined();
  });
});

describe("originalSymAt", () => {
  it("reads the document when no override exists", () => {
    expect(originalSymAt([], doc, at(0, 0, 0))).toBe("E");
    expect(originalSymAt([], doc, at(0, 2, 0))).toBe("A");
  });

  it("prefers a stored override's originalSym over the visible symbol", () => {
    // The document shows Emaj7 because a correction was applied over it;
    // the raw symbol is still E and that is what must be sent.
    const corrected: Song = {
      sections: [
        {
          label: "Verse",
          lines: [{ kind: "lyric", text: "words", chords: [{ sym: "Emaj7", at: 0 }] }],
        },
      ],
    };
    const stored = [override({ originalSym: "E", correctedSym: "Emaj7" })];
    expect(originalSymAt(stored, corrected, at(0, 0, 0))).toBe("E");
  });

  it("returns null for a position that does not exist", () => {
    expect(originalSymAt([], doc, at(9, 0, 0))).toBeNull();
    expect(originalSymAt([], doc, at(0, 9, 0))).toBeNull();
    expect(originalSymAt([], doc, at(0, 0, 9))).toBeNull();
  });

  it("returns null for a text line", () => {
    expect(originalSymAt([], doc, at(0, 1, 0))).toBeNull();
  });
});
