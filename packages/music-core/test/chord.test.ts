import { describe, it, expect } from "vitest";
import { parseChord, chordToString } from "../src/chord";
import { REFERENCE_VOCABULARY } from "./fixtures";

describe("parseChord", () => {
  it("parses a bare triad", () => {
    expect(parseChord("E")).toEqual({
      root: { letter: "E", acc: 0 }, quality: "", bass: null,
    });
  });

  it("parses quality and extensions", () => {
    expect(parseChord("C#m7")).toEqual({
      root: { letter: "C", acc: 1 }, quality: "m7", bass: null,
    });
  });

  it("parses a slash chord", () => {
    expect(parseChord("F#/A#")).toEqual({
      root: { letter: "F", acc: 1 }, quality: "", bass: { letter: "A", acc: 1 },
    });
  });

  it("parses a seventh with a non-chord bass", () => {
    expect(parseChord("C#maj7/C")).toEqual({
      root: { letter: "C", acc: 1 }, quality: "maj7", bass: { letter: "C", acc: 0 },
    });
  });

  it("accepts double accidentals in root and bass", () => {
    expect(parseChord("Bbb")).toEqual({
      root: { letter: "B", acc: -2 }, quality: "", bass: null,
    });
    expect(parseChord("Ebb/Cbb")).toEqual({
      root: { letter: "E", acc: -2 }, quality: "", bass: { letter: "C", acc: -2 },
    });
  });

  it("returns null for unparseable symbols", () => {
    expect(parseChord("N.C.")).toBeNull();
    expect(parseChord("")).toBeNull();
    expect(parseChord("Hm")).toBeNull();
  });
});

describe("chordToString", () => {
  it("round-trips the whole reference vocabulary", () => {
    for (const sym of REFERENCE_VOCABULARY) {
      expect(chordToString(parseChord(sym)!)).toBe(sym);
    }
  });
});
