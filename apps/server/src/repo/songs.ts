import type { DatabaseSync } from "node:sqlite";
import type { Song } from "@music-ui/music-core";
import type { ImportResult, SongMeta } from "@music-ui/ug-import";

export interface SongRow {
  id: number;
  sourceUrl: string | null;
  ugTabId: number | null;
  ugVersion: number | null;
  artist: string;
  title: string;
  tabType: string | null;
  detectedKey: string | null;
  detectedKeyConfidence: number | null;
  keyOverride: string | null;
  preferredKey: string | null;
  tuning: string | null;
  rawBody: string;
  document: Song;
  ugMeta: Record<string, unknown> | null;
  importedAt: string;
  updatedAt: string;
}

export interface SongSummary {
  id: number;
  artist: string;
  title: string;
  /** key_override when set, otherwise the detected key. */
  effectiveKey: string | null;
  detectedKeyConfidence: number | null;
  preferredKey: string | null;
  updatedAt: string;
}

export interface SongUpdate {
  artist?: string;
  title?: string;
  keyOverride?: string | null;
  preferredKey?: string | null;
}

export interface SongRepo {
  insert(result: ImportResult, sourceUrl: string | null): number;
  get(id: number): SongRow | null;
  findBySourceUrl(url: string): SongRow | null;
  list(): SongSummary[];
  update(id: number, patch: SongUpdate): boolean;
  remove(id: number): boolean;
}

interface RawSongRow {
  id: number;
  source_url: string | null;
  ug_tab_id: number | null;
  ug_version: number | null;
  artist: string;
  title: string;
  tab_type: string | null;
  detected_key: string | null;
  detected_key_confidence: number | null;
  key_override: string | null;
  preferred_key: string | null;
  tuning: string | null;
  raw_body: string;
  document: string;
  ug_meta: string | null;
  imported_at: string;
  updated_at: string;
}

function hydrate(r: RawSongRow): SongRow {
  return {
    id: r.id,
    sourceUrl: r.source_url,
    ugTabId: r.ug_tab_id,
    ugVersion: r.ug_version,
    artist: r.artist,
    title: r.title,
    tabType: r.tab_type,
    detectedKey: r.detected_key,
    detectedKeyConfidence: r.detected_key_confidence,
    keyOverride: r.key_override,
    preferredKey: r.preferred_key,
    tuning: r.tuning,
    rawBody: r.raw_body,
    document: JSON.parse(r.document) as Song,
    ugMeta: r.ug_meta ? (JSON.parse(r.ug_meta) as Record<string, unknown>) : null,
    importedAt: r.imported_at,
    updatedAt: r.updated_at,
  };
}

const SELECT = "SELECT * FROM song";

export function createSongRepo(db: DatabaseSync): SongRepo {
  const repo: SongRepo = {
    insert(result: ImportResult, sourceUrl: string | null): number {
      const now = new Date().toISOString();
      const meta: SongMeta = result.meta;
      const info = db
        .prepare(
          `INSERT INTO song (
             source_url, ug_tab_id, ug_version, artist, title, tab_type,
             detected_key, detected_key_confidence, key_override, preferred_key,
             tuning, raw_body, document, ug_meta, imported_at, updated_at
           ) VALUES (?,?,?,?,?,?,?,?,NULL,NULL,?,?,?,?,?,?)`,
        )
        .run(
          sourceUrl,
          meta.ugTabId,
          meta.ugVersion,
          meta.artist,
          meta.title,
          meta.tabType,
          result.detectedKey,
          result.keyConfidence,
          meta.tuning,
          result.rawBody,
          JSON.stringify(result.document),
          JSON.stringify({
            rating: meta.rating,
            votes: meta.votes,
            contributor: meta.contributor,
            viewTotal: meta.viewTotal,
            mode: result.detectedMode,
            unparseableChords: result.unparseableChords,
          }),
          now,
          now,
        );
      return Number(info.lastInsertRowid);
    },

    get(id: number): SongRow | null {
      const row = db.prepare(`${SELECT} WHERE id = ?`).get(id) as RawSongRow | undefined;
      return row ? hydrate(row) : null;
    },

    findBySourceUrl(url: string): SongRow | null {
      const row = db.prepare(`${SELECT} WHERE source_url = ?`).get(url) as RawSongRow | undefined;
      return row ? hydrate(row) : null;
    },

    list(): SongSummary[] {
      const rows = db
        .prepare(
          `SELECT id, artist, title,
                  COALESCE(key_override, detected_key) AS effective_key,
                  detected_key_confidence, preferred_key, updated_at
             FROM song
            ORDER BY artist COLLATE NOCASE, title COLLATE NOCASE`,
        )
        .all() as Array<{
        id: number;
        artist: string;
        title: string;
        effective_key: string | null;
        detected_key_confidence: number | null;
        preferred_key: string | null;
        updated_at: string;
      }>;

      return rows.map((r) => ({
        id: r.id,
        artist: r.artist,
        title: r.title,
        effectiveKey: r.effective_key,
        detectedKeyConfidence: r.detected_key_confidence,
        preferredKey: r.preferred_key,
        updatedAt: r.updated_at,
      }));
    },

    update(id: number, patch: SongUpdate): boolean {
      const sets: string[] = [];
      const values: Array<string | null> = [];

      // Column names here are fixed literals; every value is bound.
      const put = (column: string, value: string | null | undefined) => {
        if (value === undefined) return;
        sets.push(`${column} = ?`);
        values.push(value);
      };

      put("artist", patch.artist);
      put("title", patch.title);
      put("key_override", patch.keyOverride);
      put("preferred_key", patch.preferredKey);

      if (sets.length === 0) return repo.get(id) !== null;

      sets.push("updated_at = ?");
      values.push(new Date().toISOString());

      const info = db.prepare(`UPDATE song SET ${sets.join(", ")} WHERE id = ?`).run(...values, id);
      return Number(info.changes) > 0;
    },

    remove(id: number): boolean {
      return Number(db.prepare("DELETE FROM song WHERE id = ?").run(id).changes) > 0;
    },
  };

  return repo;
}
