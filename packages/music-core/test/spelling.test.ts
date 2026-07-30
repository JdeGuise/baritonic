import { describe, it, expect } from "vitest";
import { parseNote, noteToString } from "../src/note";
import { simplifyAccidental, makeReadable, spellNote, FLAT_KEYS, EXOTIC_KEYS } from "../src/spelling";

const simp = (s: string, flat: boolean) => noteToString(simplifyAccidental(parseNote(s)!, flat));
const read = (s: string, key: string) => noteToString(makeReadable(parseNote(s)!, key));
const spell = (s: string, key: string) => noteToString(spellNote(parseNote(s)!, key));

describe("key sets", () => {
  it("lists exactly the flat keys", () => {
    expect([...FLAT_KEYS].sort()).toEqual(["Ab", "Bb", "Db", "Eb", "F", "Gb"]);
  });

  it("lists exactly the exotic-tolerant keys", () => {
    expect([...EXOTIC_KEYS].sort()).toEqual(["B", "C#", "Cb", "F#", "Gb"]);
  });
});

describe("simplifyAccidental", () => {
  it("leaves single accidentals alone", () => {
    expect(simp("C#", false)).toBe("C#");
    expect(simp("Eb", true)).toBe("Eb");
    expect(simp("G", false)).toBe("G");
  });

  it("respells double accidentals", () => {
    expect(simp("Bbb", true)).toBe("A");
    expect(simp("F##", false)).toBe("G");
  });

  it("leans the way the key leans", () => {
    // pitch class 6 is F# or Gb depending on context
    expect(simp("E##", true)).toBe("Gb");
    expect(simp("E##", false)).toBe("F#");
  });
});

describe("makeReadable", () => {
  it("keeps exotic spellings where the signature contains them", () => {
    expect(read("Cb", "Gb")).toBe("Cb");
    expect(read("E#", "B")).toBe("E#");
  });

  it("replaces exotic spellings elsewhere", () => {
    expect(read("Fb", "Ab")).toBe("E");
    expect(read("Cb", "Eb")).toBe("B");
    expect(read("B#", "C")).toBe("C");
    expect(read("E#", "F")).toBe("F");
  });

  it("leaves ordinary spellings untouched", () => {
    expect(read("Ab", "Eb")).toBe("Ab");
    expect(read("F#", "G")).toBe("F#");
  });
});

describe("spellNote", () => {
  it("applies both passes in order", () => {
    expect(spell("Bbb", "Db")).toBe("A");
    expect(spell("Fb", "Ab")).toBe("E");
  });
});
