import type { Chord } from "./chord.ts";
import { noteSemitone, shiftNote, type Note } from "./note.ts";
import { spellNote } from "./spelling.ts";

export interface ChordTones {
  /** Semitones above the root. */
  semitones: number[];
  /** Letter steps above the root, so each tone can be spelled rather than guessed. */
  letterSteps: number[];
}

/** Longest quality string first, so "maj7" is matched before "m". */
const QUALITY_TABLE: ReadonlyArray<readonly [string, number[], number[]]> = [
  ["maj7", [0, 4, 7, 11], [0, 2, 4, 6]],
  ["sus2", [0, 2, 7], [0, 1, 4]],
  ["sus4", [0, 5, 7], [0, 3, 4]],
  ["dim", [0, 3, 6], [0, 2, 4]],
  ["aug", [0, 4, 8], [0, 2, 4]],
  ["m7", [0, 3, 7, 10], [0, 2, 4, 6]],
  ["m6", [0, 3, 7, 9], [0, 2, 4, 5]],
  ["m", [0, 3, 7], [0, 2, 4]],
  ["7", [0, 4, 7, 10], [0, 2, 4, 6]],
  ["6", [0, 4, 7, 9], [0, 2, 4, 5]],
  ["", [0, 4, 7], [0, 2, 4]],
];

export function chordTones(c: Chord): ChordTones {
  for (const [q, semitones, letterSteps] of QUALITY_TABLE) {
    if (c.quality === q) return { semitones: [...semitones], letterSteps: [...letterSteps] };
  }
  for (const [q, semitones, letterSteps] of QUALITY_TABLE) {
    if (q !== "" && c.quality.startsWith(q)) {
      return { semitones: [...semitones], letterSteps: [...letterSteps] };
    }
  }
  return { semitones: [0, 4, 7], letterSteps: [0, 2, 4] };
}

/** The chord's tones, each spelled for the target key. */
export function spellChordTones(c: Chord, targetKey: string): Note[] {
  const { semitones, letterSteps } = chordTones(c);
  return semitones.map((semi, i) =>
    spellNote(shiftNote(c.root, letterSteps[i]!, semi), targetKey),
  );
}

export interface Voicing {
  /** Absolute semitones. Pitch class 0 is C; a chord's pitches are placed
   *  where they actually sound relative to that origin, NOT normalized to
   *  the root — voice leading measures real distance between chords. */
  pitches: number[];
  inversion: number;
}

/** All inversions of the chord. Inversion k lifts the lowest k notes by an
 *  octave. A slash chord's bass is fixed by notation and sits below the
 *  structure, so it is prepended to every candidate. */
export function voicingsFor(c: Chord): Voicing[] {
  const root = noteSemitone(c.root);
  const { semitones } = chordTones(c);
  const base = semitones.map((s) => root + s);

  const out: Voicing[] = [];
  for (let inversion = 0; inversion < base.length; inversion++) {
    const pitches = base.map((p, i) => (i < inversion ? p + 12 : p));
    pitches.sort((a, b) => a - b);
    out.push({ pitches, inversion });
  }

  if (c.bass) {
    let bass = noteSemitone(c.bass);
    while (bass >= root) bass -= 12;
    for (const v of out) v.pitches = [bass, ...v.pitches];
  }

  return out;
}
