import { describe, it, expect } from "vitest";
import type { Song } from "@music-ui/music-core";
import { applyOverrides, type ChordOverride } from "../src/overlay";

const doc = (): Song => ({
  sections: [
    {
      label: "Verse",
      lines: [
        { kind: "lyric", text: "placeholder words here", chords: [{ sym: "C", at: 0 }, { sym: "G", at: 12 }] },
        { kind: "text", text: "a performance note" },
        { kind: "chords", chords: [{ sym: "Am", at: 0 }] },
      ],
    },
  ],
});

const ov = (o: Partial<ChordOverride>): ChordOverride => ({
  sectionIdx: 0, lineIdx: 0, chordIdx: 0,
  originalSym: "C", correctedSym: null, inversion: null,
  ...o,
});

describe("applyOverrides", () => {
  it("returns the document unchanged when there are no overrides", () => {
    const r = applyOverrides(doc(), []);
    expect(r.document).toEqual(doc());
    expect(r.orphaned).toEqual([]);
  });

  it("applies a symbol correction", () => {
    const r = applyOverrides(doc(), [ov({ correctedSym: "Cmaj7" })]);
    const line = r.document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords[0]!.sym).toBe("Cmaj7");
    expect(r.orphaned).toEqual([]);
  });

  it("leaves the anchor untouched when correcting a symbol", () => {
    const r = applyOverrides(doc(), [ov({ correctedSym: "Cmaj7" })]);
    const line = r.document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords[0]!.at).toBe(0);
  });

  it("corrects a chord on an instrumental line", () => {
    const r = applyOverrides(doc(), [
      ov({ lineIdx: 2, chordIdx: 0, originalSym: "Am", correctedSym: "Am7" }),
    ]);
    const line = r.document.sections[0]!.lines[2]!;
    if (line.kind !== "chords") throw new Error("expected a chord line");
    expect(line.chords[0]!.sym).toBe("Am7");
  });

  it("does not mutate the input document", () => {
    const input = doc();
    applyOverrides(input, [ov({ correctedSym: "Cmaj7" })]);
    const line = input.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords[0]!.sym).toBe("C");
  });

  it("orphans an override whose original symbol no longer matches", () => {
    const r = applyOverrides(doc(), [ov({ originalSym: "D", correctedSym: "Dm" })]);
    expect(r.orphaned).toHaveLength(1);
    expect(r.orphaned[0]!.reason).toBe("symbol-changed");
    expect(r.orphaned[0]!.foundSym).toBe("C");
    const line = r.document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords[0]!.sym).toBe("C"); // not applied
  });

  it("orphans an override pointing past the end of the document", () => {
    for (const bad of [ov({ sectionIdx: 9 }), ov({ lineIdx: 9 }), ov({ chordIdx: 9 })]) {
      const r = applyOverrides(doc(), [bad]);
      expect(r.orphaned).toHaveLength(1);
      expect(r.orphaned[0]!.reason).toBe("position-missing");
    }
  });

  it("orphans an override pointing at a text line", () => {
    const r = applyOverrides(doc(), [ov({ lineIdx: 1 })]);
    expect(r.orphaned).toHaveLength(1);
    expect(r.orphaned[0]!.reason).toBe("position-missing");
  });

  it("passes inversion pins through without touching the document", () => {
    const r = applyOverrides(doc(), [ov({ inversion: 2 })]);
    expect(r.inversions).toEqual([{ sectionIdx: 0, lineIdx: 0, chordIdx: 0, inversion: 2 }]);
    expect(r.document).toEqual(doc());
  });

  it("applies a correction and an inversion from one override", () => {
    const r = applyOverrides(doc(), [ov({ correctedSym: "Cmaj7", inversion: 1 })]);
    const line = r.document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords[0]!.sym).toBe("Cmaj7");
    expect(r.inversions[0]!.inversion).toBe(1);
  });

  it("does not emit an inversion pin for an orphaned override", () => {
    const r = applyOverrides(doc(), [ov({ originalSym: "D", inversion: 2 })]);
    expect(r.inversions).toEqual([]);
    expect(r.orphaned).toHaveLength(1);
  });

  it("applies several overrides independently", () => {
    const r = applyOverrides(doc(), [
      ov({ chordIdx: 0, originalSym: "C", correctedSym: "Cmaj7" }),
      ov({ chordIdx: 1, originalSym: "G", correctedSym: "G7" }),
    ]);
    const line = r.document.sections[0]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords.map((c) => c.sym)).toEqual(["Cmaj7", "G7"]);
    expect(r.orphaned).toEqual([]);
  });
});
