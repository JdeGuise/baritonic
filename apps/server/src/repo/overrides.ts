import type { DatabaseSync } from "node:sqlite";
import type { ChordOverride } from "../overlay.ts";

export interface ChordPosition {
  sectionIdx: number;
  lineIdx: number;
  chordIdx: number;
}

export interface OverrideRepo {
  upsert(songId: number, override: ChordOverride): void;
  listForSong(songId: number): ChordOverride[];
  remove(songId: number, at: ChordPosition): boolean;
  removeAllForSong(songId: number): number;
}

interface RawOverrideRow {
  section_idx: number;
  line_idx: number;
  chord_idx: number;
  original_sym: string;
  corrected_sym: string | null;
  inversion: number | null;
}

export function createOverrideRepo(db: DatabaseSync): OverrideRepo {
  return {
    upsert(songId: number, o: ChordOverride): void {
      db.prepare(
        `INSERT INTO chord_override
           (song_id, section_idx, line_idx, chord_idx, original_sym, corrected_sym, inversion, created_at)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT (song_id, section_idx, line_idx, chord_idx)
         DO UPDATE SET original_sym  = excluded.original_sym,
                       corrected_sym = excluded.corrected_sym,
                       inversion     = excluded.inversion`,
      ).run(
        songId,
        o.sectionIdx,
        o.lineIdx,
        o.chordIdx,
        o.originalSym,
        o.correctedSym,
        o.inversion,
        new Date().toISOString(),
      );
    },

    listForSong(songId: number): ChordOverride[] {
      const rows = db
        .prepare(
          `SELECT section_idx, line_idx, chord_idx, original_sym, corrected_sym, inversion
             FROM chord_override
            WHERE song_id = ?
            ORDER BY section_idx, line_idx, chord_idx`,
        )
        .all(songId) as unknown as RawOverrideRow[];

      return rows.map((r) => ({
        sectionIdx: r.section_idx,
        lineIdx: r.line_idx,
        chordIdx: r.chord_idx,
        originalSym: r.original_sym,
        correctedSym: r.corrected_sym,
        inversion: r.inversion,
      }));
    },

    remove(songId: number, at: ChordPosition): boolean {
      const info = db
        .prepare(
          `DELETE FROM chord_override
            WHERE song_id = ? AND section_idx = ? AND line_idx = ? AND chord_idx = ?`,
        )
        .run(songId, at.sectionIdx, at.lineIdx, at.chordIdx);
      return Number(info.changes) > 0;
    },

    removeAllForSong(songId: number): number {
      return Number(db.prepare("DELETE FROM chord_override WHERE song_id = ?").run(songId).changes);
    },
  };
}
