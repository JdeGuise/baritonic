export type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** A tonal pitch class: a letter and an accidental, kept apart so that
 *  transposition can move each independently. `acc` is -2..2 after
 *  normalization; intermediate values may exceed that range. */
export interface Note {
  letter: Letter;
  acc: number;
}

export const LETTERS: readonly Letter[] = ["C", "D", "E", "F", "G", "A", "B"];

export const LETTER_SEMITONE: Readonly<Record<Letter, number>> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

const NOTE_RE = /^([A-G])(#{1,2}|b{1,2})?$/;

export function parseNote(s: string): Note | null {
  const m = NOTE_RE.exec(s);
  if (!m) return null;
  const letter = m[1] as Letter;
  const a = m[2] ?? "";
  const acc = a === "" ? 0 : a.startsWith("#") ? a.length : -a.length;
  return { letter, acc };
}

export function noteToString(n: Note): string {
  const mark = n.acc > 0 ? "#".repeat(n.acc) : n.acc < 0 ? "b".repeat(-n.acc) : "";
  return n.letter + mark;
}

/** Pitch class, 0-11. */
export function noteSemitone(n: Note): number {
  return (((LETTER_SEMITONE[n.letter] + n.acc) % 12) + 12) % 12;
}

/** Move a note by a diatonic interval. The letter and the semitone move
 *  independently, which is what produces correct enharmonic spelling.
 *  The result may carry a double accidental; callers normalize. */
export function shiftNote(n: Note, dLetter: number, dSemitone: number): Note {
  const idx = (((LETTERS.indexOf(n.letter) + dLetter) % 7) + 7) % 7;
  const letter = LETTERS[idx]!;
  const want = (((noteSemitone(n) + dSemitone) % 12) + 12) % 12;
  let acc = want - LETTER_SEMITONE[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { letter, acc };
}
