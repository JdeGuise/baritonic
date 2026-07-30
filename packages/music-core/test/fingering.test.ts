import { describe, it, expect } from "vitest";
import { fingeringFor, fingerVoicing } from "../src/fingering";
import { voicingsFor } from "../src/voicing";
import { parseChord } from "../src/chord";

describe("fingeringFor", () => {
  it("fingers triads by inversion", () => {
    expect(fingeringFor(3, 0)).toEqual([1, 3, 5]);
    expect(fingeringFor(3, 1)).toEqual([1, 2, 5]);
    expect(fingeringFor(3, 2)).toEqual([1, 3, 5]);
  });

  it("fingers four-note chords the same in every inversion", () => {
    for (const inv of [0, 1, 2, 3]) {
      expect(fingeringFor(4, inv)).toEqual([1, 2, 3, 5]);
    }
  });

  it("fingers five-note chords with all five fingers", () => {
    expect(fingeringFor(5, 0)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns one finger per note", () => {
    for (const count of [3, 4, 5]) {
      for (const inv of [0, 1, 2]) {
        expect(fingeringFor(count, inv)).toHaveLength(count);
      }
    }
  });
});

describe("fingerVoicing", () => {
  it("keeps a plain triad in the right hand", () => {
    const v = voicingsFor(parseChord("C")!)[0]!;
    expect(fingerVoicing(v, false)).toEqual({ left: [], right: [1, 3, 5] });
  });

  it("moves a slash bass to the left hand", () => {
    const v = voicingsFor(parseChord("C/G")!)[0]!;
    const f = fingerVoicing(v, true);
    expect(f.left).toEqual([5]);
    expect(f.right).toEqual([1, 3, 5]);
  });

  it("assigns a finger to every sounding note", () => {
    const plain = voicingsFor(parseChord("Cmaj7")!)[0]!;
    const p = fingerVoicing(plain, false);
    expect(p.left.length + p.right.length).toBe(plain.pitches.length);

    const slash = voicingsFor(parseChord("C/G")!)[0]!;
    const s = fingerVoicing(slash, true);
    expect(s.left.length + s.right.length).toBe(slash.pitches.length);
  });
});
