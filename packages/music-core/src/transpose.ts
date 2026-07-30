import { chordToString, parseChord } from "./chord";
import type { Interval } from "./interval";
import { shiftNote } from "./note";
import { spellNote } from "./spelling";

/** Transpose a chord symbol. Root and bass move; quality and extensions
 *  are untouched. Unparseable symbols are returned verbatim. */
export function transposeChordSymbol(sym: string, iv: Interval, targetKey: string): string {
  const c = parseChord(sym);
  if (!c) return sym;

  return chordToString({
    root: spellNote(shiftNote(c.root, iv.dLetter, iv.dSemitone), targetKey),
    quality: c.quality,
    bass: c.bass ? spellNote(shiftNote(c.bass, iv.dLetter, iv.dSemitone), targetKey) : null,
  });
}
