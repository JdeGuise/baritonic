import { describe, it, expect } from "vitest";
import { parseChord, voicingsFor, fingerVoicing } from "@baritonic/music-core";
import { layoutKeyboard } from "../src/music/keyboard.ts";

const layoutFor = (sym: string, inversion = 0) => {
  const chord = parseChord(sym)!;
  const voicing = voicingsFor(chord).find((v) => v.inversion === inversion)!;
  return layoutKeyboard(voicing, fingerVoicing(voicing, chord.bass !== null));
};

describe("layoutKeyboard", () => {
  it("spans two octaves for a simple triad", () => {
    const l = layoutFor("C");
    expect(l.keys.filter((k) => k.white)).toHaveLength(14);
    expect(l.keys.filter((k) => !k.white)).toHaveLength(10);
  });

  it("highlights exactly the chord tones", () => {
    const l = layoutFor("C");
    const lit = l.keys.filter((k) => k.finger !== null);
    expect(lit).toHaveLength(3);
    expect(lit.map((k) => k.semitone % 12).sort((a, b) => a - b)).toEqual([0, 4, 7]);
  });

  it("assigns fingering in ascending pitch order", () => {
    const l = layoutFor("C");
    const lit = l.keys.filter((k) => k.finger !== null).sort((a, b) => a.semitone - b.semitone);
    expect(lit.map((k) => k.finger)).toEqual([1, 3, 5]);
  });

  it("lights four keys for a seventh", () => {
    expect(layoutFor("Cmaj7").keys.filter((k) => k.finger !== null)).toHaveLength(4);
  });

  it("places black keys between their neighbours", () => {
    const l = layoutFor("C");
    const cSharp = l.keys.find((k) => k.semitone === 1)!;
    const c = l.keys.find((k) => k.semitone === 0)!;
    const d = l.keys.find((k) => k.semitone === 2)!;
    expect(cSharp.white).toBe(false);
    expect(cSharp.x).toBeGreaterThan(c.x);
    expect(cSharp.x).toBeLessThan(d.x);
  });

  it("keeps a negative slash bass on the board", () => {
    const l = layoutFor("C/G");
    expect(l.keys.every((k) => k.x >= 0)).toBe(true);
    const bass = l.keys.filter((k) => k.isBass);
    expect(bass).toHaveLength(1);
    expect(bass[0]!.semitone % 12).toBe(7);
  });

  it("puts the slash bass below the chord tones", () => {
    const l = layoutFor("C/G");
    const bass = l.keys.find((k) => k.isBass)!;
    const lit = l.keys.filter((k) => k.finger !== null && !k.isBass);
    expect(lit.every((k) => k.semitone > bass.semitone)).toBe(true);
  });

  it("widens the board when an inversion reaches past two octaves", () => {
    const wide = layoutFor("Cmaj7", 3);
    expect(wide.keys.filter((k) => k.white).length).toBeGreaterThanOrEqual(14);
    expect(wide.keys.filter((k) => k.finger !== null)).toHaveLength(4);
  });

  it("reports a width matching the white keys", () => {
    const l = layoutFor("C");
    const whites = l.keys.filter((k) => k.white);
    expect(l.width).toBeCloseTo(whites.length * whites[0]!.width);
  });
});
