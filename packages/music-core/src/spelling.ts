import { LETTERS, LETTER_SEMITONE, noteSemitone, noteToString, type Letter, type Note } from "./note";

/** Keys whose signature uses flats. */
export const FLAT_KEYS: ReadonlySet<string> = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"]);

/** Keys whose signature genuinely contains Cb, Fb, B# or E#. */
export const EXOTIC_KEYS: ReadonlySet<string> = new Set(["Gb", "Cb", "B", "F#", "C#"]);

const EXOTIC_SPELLINGS: ReadonlySet<string> = new Set(["Cb", "Fb", "B#", "E#"]);

/** Pass 1. A letter shift can legitimately land on a spelling like Bbb.
 *  Respell as the nearest single-accidental name, preferring the
 *  direction the target key leans. */
export function simplifyAccidental(n: Note, preferFlats: boolean): Note {
  if (n.acc >= -1 && n.acc <= 1) return n;

  const want = noteSemitone(n);
  let best: { letter: Letter; acc: number; score: number } | null = null;

  for (const letter of LETTERS) {
    let acc = want - LETTER_SEMITONE[letter];
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    if (acc < -1 || acc > 1) continue;

    const leansWrong = (preferFlats && acc > 0) || (!preferFlats && acc < 0);
    const score = (acc === 0 ? 0 : 1) + (leansWrong ? 2 : 0);
    if (!best || score < best.score) best = { letter, acc, score };
  }

  return best ? { letter: best.letter, acc: best.acc } : n;
}

/** Pass 2. Cb, Fb, B# and E# are correct only in keys whose signature
 *  contains them, and unreadable everywhere else. */
export function makeReadable(n: Note, targetKey: string): Note {
  if (EXOTIC_KEYS.has(targetKey)) return n;
  if (!EXOTIC_SPELLINGS.has(noteToString(n))) return n;

  const want = noteSemitone(n);
  for (const letter of LETTERS) {
    if (LETTER_SEMITONE[letter] === want) return { letter, acc: 0 };
  }
  return n;
}

/** Both normalization passes, in order. */
export function spellNote(n: Note, targetKey: string): Note {
  return makeReadable(simplifyAccidental(n, FLAT_KEYS.has(targetKey)), targetKey);
}
