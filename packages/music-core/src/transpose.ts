import { chordToString, parseChord } from "./chord";
import type { Line, Song } from "./document";
import { keyDelta, type Interval } from "./interval";
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

/** Transpose a whole document. Returns a new tree; the input is not
 *  mutated. Anchors, lyrics, labels and text lines are untouched. */
export function transposeDocument(doc: Song, sourceKey: string, targetKey: string): Song {
  const iv = keyDelta(sourceKey, targetKey);

  const mapLine = (line: Line): Line => {
    if (line.kind === "text") return { ...line };
    const chords = line.chords.map((ref) => ({
      ...ref,
      sym: transposeChordSymbol(ref.sym, iv, targetKey),
    }));
    return { ...line, chords };
  };

  return {
    sections: doc.sections.map((section) => ({
      ...section,
      lines: section.lines.map(mapLine),
    })),
  };
}
