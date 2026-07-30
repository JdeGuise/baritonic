import type { DatabaseSync } from "node:sqlite";

/** Ordered schema migrations. Append only — never edit a released entry,
 *  because deployed databases have already applied it. */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE song (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url              TEXT UNIQUE,
    ug_tab_id               INTEGER,
    ug_version              INTEGER,
    artist                  TEXT NOT NULL,
    title                   TEXT NOT NULL,
    tab_type                TEXT,
    detected_key            TEXT,
    detected_key_confidence REAL,
    key_override            TEXT,
    preferred_key           TEXT,
    tuning                  TEXT,
    raw_body                TEXT NOT NULL,
    document                TEXT NOT NULL,
    ug_meta                 TEXT,
    imported_at             TEXT NOT NULL,
    updated_at              TEXT NOT NULL
  );

  CREATE INDEX idx_song_artist_title ON song (artist, title);

  CREATE TABLE chord_override (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id       INTEGER NOT NULL REFERENCES song(id) ON DELETE CASCADE,
    section_idx   INTEGER NOT NULL,
    line_idx      INTEGER NOT NULL,
    chord_idx     INTEGER NOT NULL,
    original_sym  TEXT NOT NULL,
    corrected_sym TEXT,
    inversion     INTEGER,
    created_at    TEXT NOT NULL,
    UNIQUE (song_id, section_idx, line_idx, chord_idx)
  );

  CREATE INDEX idx_override_song ON chord_override (song_id);
  `,
];

export function schemaVersion(db: DatabaseSync): number {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}

/** Apply every migration above the current version. Returns the resulting
 *  version. Safe to call on every boot. */
export function migrate(db: DatabaseSync): number {
  const current = schemaVersion(db);
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v]!);
      // user_version does not accept a bound parameter.
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
  return schemaVersion(db);
}
