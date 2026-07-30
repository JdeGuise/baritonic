import { noteSemitone, parseNote } from "@baritonic/music-core";

/** Conventional key-centre spellings by pitch class. */
const KEY_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** A capo raises sounding pitch, so the sounding key is the written key
 *  plus the fret number. Piano has no capo: fold it in once at import and
 *  never surface it again. */
export function foldCapo(key: string, capo: number | null): string {
  if (capo === null || capo === 0) return key;
  const n = parseNote(key);
  if (!n) return key;
  const pc = (noteSemitone(n) + capo) % 12;
  return KEY_NAMES[pc]!;
}
