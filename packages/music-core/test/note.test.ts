import { describe, it, expect } from "vitest";
import { parseNote, noteToString, noteSemitone } from "../src/note";

describe("parseNote", () => {
  it("parses naturals", () => {
    expect(parseNote("C")).toEqual({ letter: "C", acc: 0 });
    expect(parseNote("G")).toEqual({ letter: "G", acc: 0 });
  });

  it("parses single accidentals", () => {
    expect(parseNote("C#")).toEqual({ letter: "C", acc: 1 });
    expect(parseNote("Eb")).toEqual({ letter: "E", acc: -1 });
  });

  it("parses double accidentals", () => {
    expect(parseNote("Bbb")).toEqual({ letter: "B", acc: -2 });
    expect(parseNote("F##")).toEqual({ letter: "F", acc: 2 });
  });

  it("rejects invalid input", () => {
    expect(parseNote("H")).toBeNull();
    expect(parseNote("C#b")).toBeNull();
    expect(parseNote("")).toBeNull();
  });
});

describe("noteToString", () => {
  it("round-trips every accidental level", () => {
    for (const s of ["C", "C#", "C##", "Cb", "Cbb"]) {
      expect(noteToString(parseNote(s)!)).toBe(s);
    }
  });
});

describe("noteSemitone", () => {
  it("maps to pitch class 0-11", () => {
    expect(noteSemitone({ letter: "C", acc: 0 })).toBe(0);
    expect(noteSemitone({ letter: "B", acc: 0 })).toBe(11);
    expect(noteSemitone({ letter: "B", acc: 1 })).toBe(0);
    expect(noteSemitone({ letter: "C", acc: -1 })).toBe(11);
  });
});
