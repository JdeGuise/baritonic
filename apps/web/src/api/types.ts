import type { Song } from "@baritonic/music-core";

export interface SongSummary {
  id: number;
  artist: string;
  title: string;
  effectiveKey: string | null;
  detectedKeyConfidence: number | null;
  preferredKey: string | null;
  updatedAt: string;
}

export interface InversionPin {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  inversion: number;
}

export interface ChordOverride {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
  /** The symbol the parser produced here, never a corrected one. The
   *  server compares this against the unmodified document. */
  originalSym: string;
  correctedSym: string | null;
  inversion: number | null;
}

export interface OrphanedOverride {
  override: ChordOverride;
  reason: "position-missing" | "symbol-changed";
  foundSym: string | null;
}

export interface SongDetail {
  id: number;
  sourceUrl: string | null;
  artist: string;
  title: string;
  tabType: string | null;
  detectedKey: string | null;
  detectedKeyConfidence: number | null;
  keyOverride: string | null;
  preferredKey: string | null;
  tuning: string | null;
  document: Song;
  ugMeta: Record<string, unknown> | null;
  /** The raw stored overrides. Needed to recover a position's original
   *  symbol once a correction has been applied over it. */
  overrides: ChordOverride[];
  inversions: InversionPin[];
  orphanedOverrides: OrphanedOverride[];
  importedAt: string;
  updatedAt: string;
}

export interface ChordPosition {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
}
