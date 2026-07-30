import { keyDelta, parseChord, transposeChordSymbol, type Song } from "@music-ui/music-core";
import type { ChordOverride, ChordPosition } from "../api/types.ts";

/** Translate a chord the user typed while viewing `targetKey` into the
 *  key the song is stored in.
 *
 *  The database holds one version of each song, in the written key, so a
 *  correction made against a transposed chart has to travel back before
 *  it is saved. Returns null when the input is not a readable chord. */
export function toWrittenKey(
  input: string,
  targetKey: string,
  writtenKey: string,
): string | null {
  const sym = input.trim();
  if (sym === "" || parseChord(sym) === null) return null;
  if (targetKey === writtenKey) return sym;
  return transposeChordSymbol(sym, keyDelta(targetKey, writtenKey), writtenKey);
}

export function findOverride(
  overrides: readonly ChordOverride[],
  at: ChordPosition,
): ChordOverride | undefined {
  return overrides.find(
    (o) =>
      o.sectionIdx === at.sectionIdx && o.lineIdx === at.lineIdx && o.chordIdx === at.chordIdx,
  );
}

/** The raw symbol the parser produced at a position.
 *
 *  A stored override remembers it; otherwise the document still holds it,
 *  because a position without an override has nothing applied over it.
 *  This is what the server's orphan check compares against, so getting it
 *  wrong would silently orphan the override on the next load. */
export function originalSymAt(
  overrides: readonly ChordOverride[],
  document: Song,
  at: ChordPosition,
): string | null {
  const existing = findOverride(overrides, at);
  if (existing) return existing.originalSym;

  const line = document.sections[at.sectionIdx]?.lines[at.lineIdx];
  if (!line || line.kind === "text") return null;
  return line.chords[at.chordIdx]?.sym ?? null;
}
