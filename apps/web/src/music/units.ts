import type { ChordRef } from "@baritonic/music-core";

export interface ChartUnit {
  /** Chords sitting above this run of text. Usually zero or one. */
  chords: string[];
  text: string;
}

/** Convert a lyric line and its anchors into independently laid out units.
 *
 *  Each unit owns one anchor position and the text that follows it, so a
 *  chord symbol that changes width under transposition widens its own unit
 *  rather than shifting every later chord off its syllable. */
export function toUnits(text: string, chords: readonly ChordRef[]): ChartUnit[] {
  if (chords.length === 0) return [{ chords: [], text }];

  const byPosition = new Map<number, string[]>();
  for (const c of chords) {
    const at = Math.max(0, Math.min(c.at, text.length));
    const existing = byPosition.get(at);
    if (existing) existing.push(c.sym);
    else byPosition.set(at, [c.sym]);
  }

  const positions = [...byPosition.keys()].sort((a, b) => a - b);
  const units: ChartUnit[] = [];

  const first = positions[0]!;
  if (first > 0) units.push({ chords: [], text: text.slice(0, first) });

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i]!;
    const end = positions[i + 1] ?? text.length;
    units.push({ chords: byPosition.get(start)!, text: text.slice(start, end) });
  }

  return units;
}
