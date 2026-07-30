import type { Song } from "@music-ui/music-core";

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

export interface OrphanedOverride {
  override: {
    sectionIdx: number;
    lineIdx: number;
    chordIdx: number;
    originalSym: string;
    correctedSym: string | null;
    inversion: number | null;
  };
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
