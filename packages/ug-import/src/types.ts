import type { Song } from "@music-ui/music-core";

export interface SongMeta {
  ugTabId: number | null;
  ugVersion: number | null;
  artist: string;
  title: string;
  tabType: string | null;
  tuning: string | null;
  capo: number | null;
  rating: number | null;
  votes: number | null;
  contributor: string | null;
  viewTotal: number | null;
}

export interface ImportResult {
  meta: SongMeta;
  /** The original body text, stored verbatim so the library can be
   *  re-parsed after a parser improvement without re-fetching. */
  rawBody: string;
  document: Song;
  detectedKey: string;
  detectedMode: "major" | "minor";
  keyConfidence: number;
  /** Symbols the chord parser could not read. They are preserved in the
   *  document; this list drives the "n chords couldn't be read" notice. */
  unparseableChords: string[];
}
