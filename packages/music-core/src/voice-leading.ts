import type { Chord } from "./chord";
import { voicingsFor, type Voicing } from "./voicing";

/** Movement from one voicing to the next: for each note in the successor,
 *  the distance to the nearest note in the predecessor, plus a penalty on
 *  large bass leaps. */
export function transitionCost(a: Voicing, b: Voicing): number {
  let sum = 0;
  for (const p of b.pitches) {
    let nearest = Infinity;
    for (const q of a.pitches) nearest = Math.min(nearest, Math.abs(p - q));
    sum += nearest;
  }
  const bassLeap = Math.abs((b.pitches[0] ?? 0) - (a.pitches[0] ?? 0));
  return sum + bassLeap * 0.5;
}

/** Total movement across a chosen sequence. Used to compare strategies. */
export function totalMovement(vs: Voicing[]): number {
  let sum = 0;
  for (let i = 1; i < vs.length; i++) sum += transitionCost(vs[i - 1]!, vs[i]!);
  return sum;
}

/** Choose an inversion for each chord so the hand moves as little as
 *  possible across the sequence. A pinned entry restricts that position to
 *  a single candidate; the surrounding chords adapt around it.
 *
 *  Call once per section so a repeated section voices identically. */
export function chooseVoicings(
  chords: Chord[],
  pinned: ReadonlyArray<number | null> = [],
): Voicing[] {
  if (chords.length === 0) return [];

  const candidates: Voicing[][] = chords.map((c, i) => {
    const all = voicingsFor(c);
    const pin = pinned[i];
    if (pin !== null && pin !== undefined) {
      const match = all.find((v) => v.inversion === pin);
      if (match) return [match];
    }
    // A section starts from a predictable hand position, so the opening
    // chord is root position unless it was explicitly pinned otherwise.
    if (i === 0) {
      const root = all.find((v) => v.inversion === 0);
      if (root) return [root];
    }
    return all;
  });

  // cost[i][j] = best cumulative cost reaching candidate j of chord i
  const cost: number[][] = [];
  const from: number[][] = [];

  cost[0] = candidates[0]!.map(() => 0);
  from[0] = candidates[0]!.map(() => -1);

  for (let i = 1; i < chords.length; i++) {
    const prev = candidates[i - 1]!;
    const here = candidates[i]!;
    cost[i] = [];
    from[i] = [];
    for (let j = 0; j < here.length; j++) {
      let bestCost = Infinity;
      let bestK = 0;
      for (let k = 0; k < prev.length; k++) {
        const c = cost[i - 1]![k]! + transitionCost(prev[k]!, here[j]!);
        if (c < bestCost) {
          bestCost = c;
          bestK = k;
        }
      }
      cost[i]![j] = bestCost;
      from[i]![j] = bestK;
    }
  }

  const lastRow = cost[chords.length - 1]!;
  let best = 0;
  for (let j = 1; j < lastRow.length; j++) if (lastRow[j]! < lastRow[best]!) best = j;

  const out: Voicing[] = [];
  for (let i = chords.length - 1; i >= 0; i--) {
    out.unshift(candidates[i]![best]!);
    const prevBest = from[i]![best]!;
    best = prevBest < 0 ? 0 : prevBest;
  }
  return out;
}
