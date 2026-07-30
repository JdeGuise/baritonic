import { parseChord, type Chord } from "./chord";
import { noteSemitone } from "./note";

export interface KeyGuess {
  key: string;
  mode: "major" | "minor";
  confidence: number;
}

/** Conventional key-centre spellings. These differ by mode: Db major and
 *  C# minor are both real keys, but Db minor and C# major are not how
 *  anyone writes them. */
const MAJOR_KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const MINOR_KEY_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** Quality of the triad built on each scale degree. */
const MAJOR_TRIADS = ["", "m", "m", "", "", "m", "dim"];
const MINOR_TRIADS = ["m", "dim", "", "m", "m", "", ""];

function tonicQuality(quality: string): "major" | "minor" | "other" {
  if (quality.startsWith("m") && !quality.startsWith("maj")) return "minor";
  if (quality === "" || quality.startsWith("maj") || /^[679]/.test(quality)) return "major";
  return "other";
}

function nameFor(pc: number, mode: "major" | "minor"): string {
  return (mode === "major" ? MAJOR_KEY_NAMES[pc] : MINOR_KEY_NAMES[pc])!;
}

export function detectKey(symbols: string[]): KeyGuess {
  const chords = symbols
    .map(parseChord)
    .filter((c): c is Chord => c !== null);
  if (chords.length === 0) return { key: "C", mode: "major", confidence: 0 };

  const roots = chords.map((c) => noteSemitone(c.root));
  const first = roots[0]!;
  const last = roots[roots.length - 1]!;

  const freq = new Map<number, number>();
  for (const pc of roots) freq.set(pc, (freq.get(pc) ?? 0) + 1);
  let mostFrequent = first;
  let bestCount = -1;
  for (const [pc, count] of freq) {
    if (count > bestCount) {
      bestCount = count;
      mostFrequent = pc;
    }
  }

  interface Candidate {
    key: string;
    mode: "major" | "minor";
    score: number;
    diatonic: number;
  }
  const candidates: Candidate[] = [];

  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ["major", "minor"] as const) {
      const scale = mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
      const triads = mode === "major" ? MAJOR_TRIADS : MINOR_TRIADS;

      let score = 0;
      let diatonic = 0;
      for (const c of chords) {
        const degree = scale.indexOf((((noteSemitone(c.root) - tonic) % 12) + 12) % 12);
        if (degree < 0) continue;
        diatonic += 1;
        score += 1;
        const expected = triads[degree]!;
        const actual = tonicQuality(c.quality);
        if (expected === "m" && actual === "minor") score += 0.5;
        else if (expected === "" && actual === "major") score += 0.5;
      }

      if (last === tonic) score += 3;
      if (first === tonic) score += 1.5;
      if (mostFrequent === tonic) score += 1.5;

      const tonicChord = chords.find((c) => noteSemitone(c.root) === tonic);
      if (tonicChord) {
        const q = tonicQuality(tonicChord.quality);
        if (q === "minor" && mode === "minor") score += 2;
        if (q === "major" && mode === "major") score += 2;
      }

      candidates.push({ key: nameFor(tonic, mode), mode, score, diatonic });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0]!;
  const runnerUp = candidates[1]!;

  // Two independent signals. How much of the material the key actually
  // explains catches chromatic writing, which fits no key well. The margin
  // over the runner-up catches ambiguity between two plausible keys.
  const diatonicFraction = winner.diatonic / chords.length;
  const rawMargin = winner.score > 0 ? (winner.score - runnerUp.score) / winner.score : 0;
  const margin = Math.min(rawMargin * 3, 1);
  const confidence = Math.max(0, Math.min(1, 0.65 * diatonicFraction + 0.35 * margin));

  return { key: winner.key, mode: winner.mode, confidence };
}
