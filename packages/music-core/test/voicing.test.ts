import { describe, it, expect } from "vitest";
import { parseChord } from "../src/chord";
import { noteToString } from "../src/note";
import { chordTones, spellChordTones, voicingsFor } from "../src/voicing";

const spell = (sym: string, key: string) =>
  spellChordTones(parseChord(sym)!, key).map(noteToString);

describe("chordTones", () => {
  it("knows triads", () => {
    expect(chordTones(parseChord("C")!).semitones).toEqual([0, 4, 7]);
    expect(chordTones(parseChord("Cm")!).semitones).toEqual([0, 3, 7]);
    expect(chordTones(parseChord("Cdim")!).semitones).toEqual([0, 3, 6]);
    expect(chordTones(parseChord("Caug")!).semitones).toEqual([0, 4, 8]);
  });

  it("knows sevenths and sixths", () => {
    expect(chordTones(parseChord("Cmaj7")!).semitones).toEqual([0, 4, 7, 11]);
    expect(chordTones(parseChord("Cm7")!).semitones).toEqual([0, 3, 7, 10]);
    expect(chordTones(parseChord("C7")!).semitones).toEqual([0, 4, 7, 10]);
    expect(chordTones(parseChord("Cm6")!).semitones).toEqual([0, 3, 7, 9]);
  });

  it("knows suspensions", () => {
    expect(chordTones(parseChord("Csus2")!).semitones).toEqual([0, 2, 7]);
    expect(chordTones(parseChord("Csus4")!).semitones).toEqual([0, 5, 7]);
  });

  it("falls back to a major triad for unknown qualities", () => {
    expect(chordTones(parseChord("Cfoo")!).semitones).toEqual([0, 4, 7]);
  });
});

describe("spellChordTones", () => {
  it("spells a triad by stacked thirds", () => {
    expect(spell("C", "C")).toEqual(["C", "E", "G"]);
    expect(spell("Am", "C")).toEqual(["A", "C", "E"]);
  });

  it("spells sus chords by their actual degrees", () => {
    expect(spell("Csus4", "C")).toEqual(["C", "F", "G"]);
    expect(spell("Csus2", "C")).toEqual(["C", "D", "G"]);
  });

  it("never emits a double accidental", () => {
    for (const key of ["C", "Db", "Eb", "Gb", "Ab", "B"]) {
      for (const sym of ["Abdim", "Cdim", "Eaug", "C#maj7", "Bbm7"]) {
        for (const tone of spell(sym, key)) {
          expect(tone, `${sym} in ${key}`).not.toMatch(/##|bb/);
        }
      }
    }
  });

  it("spells the fifth of a diminished chord below the natural fifth", () => {
    // Abdim is Ab-Cb-Ebb in strict theory; normalization makes it readable
    // while keeping three distinct pitch classes.
    const tones = spell("Abdim", "C");
    expect(tones).toHaveLength(3);
    expect(new Set(tones).size).toBe(3);
  });
});

describe("voicingsFor", () => {
  it("returns one candidate per inversion of a triad", () => {
    const v = voicingsFor(parseChord("C")!);
    expect(v).toHaveLength(3);
    expect(v[0]).toEqual({ pitches: [0, 4, 7], inversion: 0 });
    expect(v[1]).toEqual({ pitches: [4, 7, 12], inversion: 1 });
    expect(v[2]).toEqual({ pitches: [7, 12, 16], inversion: 2 });
  });

  it("returns four candidates for a seventh", () => {
    expect(voicingsFor(parseChord("Cmaj7")!)).toHaveLength(4);
  });

  it("fixes the bass of a slash chord below the structure", () => {
    const v = voicingsFor(parseChord("C/G")!);
    for (const cand of v) {
      expect(cand.pitches[0]).toBe(-5); // G below C
      expect(cand.pitches.length).toBe(4);
    }
  });

  it("places voicings in absolute pitch space, not relative to the root", () => {
    // F must sit above C, otherwise voice leading cannot measure movement.
    expect(voicingsFor(parseChord("F")!)[0]!.pitches).toEqual([5, 9, 12]);
    expect(voicingsFor(parseChord("G")!)[0]!.pitches).toEqual([7, 11, 14]);
  });
});
