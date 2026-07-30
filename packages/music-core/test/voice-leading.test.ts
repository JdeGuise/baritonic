import { describe, it, expect } from "vitest";
import { parseChord } from "../src/chord";
import { voicingsFor } from "../src/voicing";
import { chooseVoicings, totalMovement } from "../src/voice-leading";

const chords = (syms: string[]) => syms.map((s) => parseChord(s)!);

describe("chooseVoicings", () => {
  it("returns one voicing per chord", () => {
    const out = chooseVoicings(chords(["C", "F", "G", "C"]));
    expect(out).toHaveLength(4);
  });

  it("starts in root position", () => {
    const out = chooseVoicings(chords(["C", "F", "G", "C"]));
    expect(out[0]!.inversion).toBe(0);
  });

  it("never moves more than the all-root-position baseline", () => {
    const seq = chords(["C", "F", "G", "Am", "F", "C"]);
    const chosen = chooseVoicings(seq);
    const baseline = seq.map((c) => voicingsFor(c)[0]!);
    expect(totalMovement(chosen)).toBeLessThanOrEqual(totalMovement(baseline));
  });

  it("actually improves on the baseline for a leaping progression", () => {
    const seq = chords(["C", "F", "G", "C"]);
    const chosen = chooseVoicings(seq);
    const baseline = seq.map((c) => voicingsFor(c)[0]!);
    expect(totalMovement(chosen)).toBeLessThan(totalMovement(baseline));
  });

  it("honours a pinned inversion", () => {
    const seq = chords(["C", "F", "G", "C"]);
    const out = chooseVoicings(seq, [null, 2, null, null]);
    expect(out[1]!.inversion).toBe(2);
  });

  it("adapts neighbours around a pin rather than ignoring it", () => {
    const seq = chords(["C", "F", "G", "C"]);
    const free = chooseVoicings(seq);
    const pinned = chooseVoicings(seq, [null, 2, null, null]);
    expect(pinned[1]!.inversion).toBe(2);
    expect(totalMovement(pinned)).toBeGreaterThanOrEqual(totalMovement(free));
  });

  it("is deterministic, so a repeated section voices identically", () => {
    const seq = chords(["C", "Am", "F", "G"]);
    expect(chooseVoicings(seq)).toEqual(chooseVoicings(seq));
  });

  it("handles an empty sequence", () => {
    expect(chooseVoicings([])).toEqual([]);
  });

  it("handles a single chord", () => {
    const out = chooseVoicings(chords(["Cmaj7"]));
    expect(out).toHaveLength(1);
    expect(out[0]!.inversion).toBe(0);
  });
});
