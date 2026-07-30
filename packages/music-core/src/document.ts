/** A chord bound to a position in the lyric text. `at` is an index into
 *  `LyricLine.text`, not a character column, so it survives symbol-width
 *  changes under transposition. */
export interface ChordRef {
  sym: string;
  at: number;
}

export interface LyricLine {
  kind: "lyric";
  text: string;
  chords: ChordRef[];
}

/** Instrumental passage: chords with no lyric beneath them. */
export interface ChordLine {
  kind: "chords";
  chords: ChordRef[];
}

/** A performance note from the contributor. */
export interface TextLine {
  kind: "text";
  text: string;
}

export type Line = LyricLine | ChordLine | TextLine;

export interface Section {
  label: string;
  lines: Line[];
}

export interface Song {
  sections: Section[];
}

/** Every chord symbol in the document, in reading order. */
export function collectSymbols(doc: Song): string[] {
  const out: string[] = [];
  for (const section of doc.sections) {
    for (const line of section.lines) {
      if (line.kind === "text") continue;
      for (const ref of line.chords) out.push(ref.sym);
    }
  }
  return out;
}
