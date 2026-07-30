import { noteToString, parseNote, type Note } from "./note.ts";

export interface Chord {
  root: Note;
  /** Quality and extensions, e.g. "m7", "maj7", "sus4", "dim". Never
   *  altered by transposition. */
  quality: string;
  bass: Note | null;
}

const NOTE_SRC = "[A-G](?:#{1,2}|b{1,2})?";
const CHORD_RE = new RegExp(`^(${NOTE_SRC})([^/]*)(?:/(${NOTE_SRC}))?$`);

export function parseChord(sym: string): Chord | null {
  const m = CHORD_RE.exec(sym);
  if (!m) return null;
  const root = parseNote(m[1]!);
  if (!root) return null;
  const bass = m[3] ? parseNote(m[3]) : null;
  if (m[3] && !bass) return null;
  return { root, quality: m[2] ?? "", bass };
}

export function chordToString(c: Chord): string {
  return noteToString(c.root) + c.quality + (c.bass ? `/${noteToString(c.bass)}` : "");
}
