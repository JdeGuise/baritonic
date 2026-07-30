import type { ChordRef, Line, Song } from "@music-ui/music-core";

export interface ChordOverride {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  /** What stood at this position when the override was made. */
  originalSym: string;
  correctedSym: string | null;
  inversion: number | null;
}

export type OrphanReason = "position-missing" | "symbol-changed";

export interface OrphanedOverride {
  override: ChordOverride;
  reason: OrphanReason;
  /** The symbol actually present, when the position still exists. */
  foundSym: string | null;
}

export interface InversionPin {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  inversion: number;
}

export interface OverlayResult {
  document: Song;
  /** Pins for the client's voice-leading pass. The server does no theory. */
  inversions: InversionPin[];
  orphaned: OrphanedOverride[];
}

function chordsOf(line: Line | undefined): ChordRef[] | null {
  if (!line || line.kind === "text") return null;
  return line.chords;
}

/** Apply symbol corrections to a document and collect inversion pins.
 *
 *  An override records the symbol that stood at its position when it was
 *  made. If the document no longer matches — because the parser improved
 *  and the tree shifted — the override is orphaned rather than applied to
 *  whatever now sits at those indices. */
export function applyOverrides(doc: Song, overrides: ChordOverride[]): OverlayResult {
  const document: Song = {
    sections: doc.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l): Line =>
        l.kind === "text" ? { ...l } : { ...l, chords: l.chords.map((c) => ({ ...c })) },
      ),
    })),
  };

  const inversions: InversionPin[] = [];
  const orphaned: OrphanedOverride[] = [];

  for (const o of overrides) {
    const section = document.sections[o.sectionIdx];
    const chords = chordsOf(section?.lines[o.lineIdx]);
    const ref = chords?.[o.chordIdx];

    if (!ref) {
      orphaned.push({ override: o, reason: "position-missing", foundSym: null });
      continue;
    }
    if (ref.sym !== o.originalSym) {
      orphaned.push({ override: o, reason: "symbol-changed", foundSym: ref.sym });
      continue;
    }

    if (o.correctedSym !== null) ref.sym = o.correctedSym;
    if (o.inversion !== null) {
      inversions.push({
        sectionIdx: o.sectionIdx,
        lineIdx: o.lineIdx,
        chordIdx: o.chordIdx,
        inversion: o.inversion,
      });
    }
  }

  return { document, inversions, orphaned };
}
