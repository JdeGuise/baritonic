import type { Voicing } from "./voicing.ts";

/** Right-hand fingering by note count and inversion. */
export function fingeringFor(noteCount: number, inversion: number): number[] {
  if (noteCount <= 3) {
    return inversion === 1 ? [1, 2, 5] : [1, 3, 5];
  }
  if (noteCount === 4) return [1, 2, 3, 5];
  return [1, 2, 3, 4, 5];
}

/** Split a voicing between hands. A slash chord's bass note is the lowest
 *  pitch and belongs to the left hand; everything above it is the right. */
export function fingerVoicing(v: Voicing, hasBass: boolean): { left: number[]; right: number[] } {
  if (!hasBass) {
    return { left: [], right: fingeringFor(v.pitches.length, v.inversion) };
  }
  const upper = v.pitches.length - 1;
  return { left: [5], right: fingeringFor(upper, v.inversion) };
}
