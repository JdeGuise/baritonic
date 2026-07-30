import { LETTERS, noteSemitone, parseNote } from "./note.ts";

export interface Interval {
  dLetter: number;
  dSemitone: number;
}

/** The interval from one key to another, taking the shorter way around
 *  the circle so a transposition never moves more than a tritone. */
export function keyDelta(from: string, to: string): Interval {
  const a = parseNote(from);
  const b = parseNote(to);
  if (!a || !b) throw new Error(`Unparseable key: ${!a ? from : to}`);

  let dLetter = LETTERS.indexOf(b.letter) - LETTERS.indexOf(a.letter);
  let dSemitone = noteSemitone(b) - noteSemitone(a);

  if (dSemitone > 6) dSemitone -= 12;
  if (dSemitone < -6) dSemitone += 12;
  if (dLetter > 3) dLetter -= 7;
  if (dLetter < -3) dLetter += 7;

  return { dLetter, dSemitone };
}
