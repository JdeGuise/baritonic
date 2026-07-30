import { describe, it, expect } from "vitest";
import { parseNote, noteToString, shiftNote } from "../src/note";
import { keyDelta } from "../src/interval";

const shift = (s: string, dL: number, dS: number) =>
  noteToString(shiftNote(parseNote(s)!, dL, dS));

describe("shiftNote", () => {
  it("moves letter and semitone independently", () => {
    // E -> C is down a major third: letter -2, semitone -4
    expect(shift("E", -2, -4)).toBe("C");
    expect(shift("B", -2, -4)).toBe("G");
    expect(shift("A#", -2, -4)).toBe("F#");
    expect(shift("C", -2, -4)).toBe("Ab");
  });

  it("wraps letters around the octave", () => {
    expect(shift("C", -2, -4)).toBe("Ab");
    expect(shift("D", 5, 9)).toBe("B");
  });

  it("may produce a double accidental before normalization", () => {
    expect(shift("C", -1, -3)).toBe("Bbb");
  });
});

describe("keyDelta", () => {
  it("computes E to C", () => {
    expect(keyDelta("E", "C")).toEqual({ dLetter: -2, dSemitone: -4 });
  });

  it("computes identity", () => {
    expect(keyDelta("G", "G")).toEqual({ dLetter: 0, dSemitone: 0 });
  });

  it("chooses the short way around", () => {
    expect(keyDelta("C", "B")).toEqual({ dLetter: -1, dSemitone: -1 });
    expect(keyDelta("B", "C")).toEqual({ dLetter: 1, dSemitone: 1 });
  });

  it("throws on an unparseable key", () => {
    expect(() => keyDelta("H", "C")).toThrow();
  });
});
