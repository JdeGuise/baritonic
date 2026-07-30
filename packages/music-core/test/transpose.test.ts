import { describe, it, expect } from "vitest";
import { keyDelta } from "../src/interval";
import { transposeChordSymbol } from "../src/transpose";

const toKey = (sym: string, from: string, to: string) =>
  transposeChordSymbol(sym, keyDelta(from, to), to);

describe("transposeChordSymbol E to C", () => {
  const cases: Array<[string, string]> = [
    ["E", "C"], ["Emaj7", "Cmaj7"], ["Esus2", "Csus2"],
    ["B", "G"], ["Bsus2", "Gsus2"], ["Bsus4", "Gsus4"],
    ["C#m", "Am"], ["A#", "F#"], ["A", "F"],
    ["Cdim", "Abdim"], ["Eaug", "Caug"],
    ["F#m", "Dm"], ["F#m7", "Dm7"],
    ["F#/A#", "D/F#"], ["C#/G#", "A/E"],
    ["C#maj7/C", "Amaj7/Ab"], ["E/B", "C/G"],
  ];

  for (const [from, expected] of cases) {
    it(`${from} -> ${expected}`, () => {
      expect(toKey(from, "E", "C")).toBe(expected);
    });
  }
});

describe("transposeChordSymbol", () => {
  it("is identity for the same key", () => {
    expect(toKey("C#maj7/C", "E", "E")).toBe("C#maj7/C");
  });

  it("never alters quality or extensions", () => {
    expect(toKey("F#m7", "E", "Bb")).toBe("Cm7");
    expect(toKey("Esus4", "E", "Ab")).toBe("Absus4");
  });

  it("preserves unparseable symbols verbatim", () => {
    expect(toKey("N.C.", "E", "C")).toBe("N.C.");
    expect(toKey("%", "E", "C")).toBe("%");
  });

  it("prefers flats in flat keys and sharps in sharp keys", () => {
    expect(toKey("E", "E", "Eb")).toBe("Eb");
    expect(toKey("E", "E", "D")).toBe("D");
    expect(toKey("C", "E", "Ab")).toBe("E");
  });
});
