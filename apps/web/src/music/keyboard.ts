import type { Voicing } from "@baritonic/music-core";

export interface KeyShape {
  semitone: number;
  white: boolean;
  x: number;
  width: number;
  height: number;
  /** Finger number when this key sounds, otherwise null. */
  finger: number | null;
  isBass: boolean;
}

export interface KeyboardLayout {
  keys: KeyShape[];
  width: number;
  height: number;
}

const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
const WHITE_W = 13;
const WHITE_H = 54;
const BLACK_W = 8.5;
const BLACK_H = 34;

function isWhite(pitchClass: number): boolean {
  return WHITE_SEMITONES.includes(pitchClass);
}

function whiteIndexBefore(pitchClass: number): number {
  return WHITE_SEMITONES.indexOf(pitchClass - 1);
}

/** Lay out a keyboard wide enough to contain the voicing.
 *
 *  music-core voicings are absolute semitones and a slash bass may be
 *  negative — C/G puts G five semitones below the root — so the whole
 *  voicing is first shifted up by whole octaves until it starts at or
 *  above zero. */
export function layoutKeyboard(
  voicing: Voicing,
  fingers: { left: number[]; right: number[] },
): KeyboardLayout {
  const sorted = [...voicing.pitches].sort((a, b) => a - b);
  let shift = 0;
  while (sorted.length > 0 && sorted[0]! + shift < 0) shift += 12;

  const pitches = sorted.map((p) => p + shift);
  const hasBass = fingers.left.length > 0;
  const bassPitch = hasBass && pitches.length > 0 ? pitches[0]! : null;

  // Right-hand fingers apply to the upper structure, in ascending order.
  const upper = hasBass ? pitches.slice(1) : pitches;
  const fingerFor = new Map<number, number>();
  upper.forEach((p, i) => {
    const f = fingers.right[i];
    if (f !== undefined) fingerFor.set(p, f);
  });
  if (bassPitch !== null) {
    const f = fingers.left[0];
    if (f !== undefined) fingerFor.set(bassPitch, f);
  }

  const highest = pitches.length > 0 ? pitches[pitches.length - 1]! : 0;
  const octaves = Math.max(2, Math.ceil((highest + 1) / 12));

  const keys: KeyShape[] = [];
  for (let semitone = 0; semitone < octaves * 12; semitone++) {
    const octave = Math.floor(semitone / 12);
    const pc = semitone % 12;
    const white = isWhite(pc);
    const x = white
      ? (octave * 7 + WHITE_SEMITONES.indexOf(pc)) * WHITE_W
      : (octave * 7 + whiteIndexBefore(pc)) * WHITE_W + WHITE_W - BLACK_W / 2;

    keys.push({
      semitone,
      white,
      x,
      width: white ? WHITE_W : BLACK_W,
      height: white ? WHITE_H : BLACK_H,
      finger: fingerFor.get(semitone) ?? null,
      isBass: bassPitch !== null && semitone === bassPitch,
    });
  }

  return { keys, width: octaves * 7 * WHITE_W, height: WHITE_H };
}
