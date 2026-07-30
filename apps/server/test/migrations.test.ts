import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../src/db/connection";
import { migrate, schemaVersion, MIGRATIONS } from "../src/db/migrations";

let dir: string;
let db: DatabaseSync;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "baritonic-test-"));
  db = openDatabase(join(dir, "test.db"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("openDatabase", () => {
  it("enables foreign keys", () => {
    const row = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(row.foreign_keys).toBe(1);
  });

  it("uses write-ahead logging", () => {
    const row = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(row.journal_mode.toLowerCase()).toBe("wal");
  });
});

describe("migrate", () => {
  it("starts at version zero", () => {
    expect(schemaVersion(db)).toBe(0);
  });

  it("applies every migration and records the version", () => {
    expect(migrate(db)).toBe(MIGRATIONS.length);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it("creates the expected tables", () => {
    migrate(db);
    const names = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]
    ).map((r) => r.name);
    expect(names).toContain("song");
    expect(names).toContain("chord_override");
  });

  it("is idempotent", () => {
    migrate(db);
    expect(migrate(db)).toBe(MIGRATIONS.length);
    expect(schemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it("cascades override deletion when a song is removed", () => {
    migrate(db);
    db.prepare(
      `INSERT INTO song (id, artist, title, raw_body, document, imported_at, updated_at)
       VALUES (1, 'A', 'T', 'body', '{}', 'now', 'now')`,
    ).run();
    db.prepare(
      `INSERT INTO chord_override
         (song_id, section_idx, line_idx, chord_idx, original_sym, created_at)
       VALUES (1, 0, 0, 0, 'C', 'now')`,
    ).run();
    db.prepare("DELETE FROM song WHERE id = 1").run();
    const left = db.prepare("SELECT COUNT(*) AS n FROM chord_override").get() as { n: number };
    expect(left.n).toBe(0);
  });

  it("rejects a duplicate override for the same chord position", () => {
    migrate(db);
    db.prepare(
      `INSERT INTO song (id, artist, title, raw_body, document, imported_at, updated_at)
       VALUES (1, 'A', 'T', 'body', '{}', 'now', 'now')`,
    ).run();
    const ins = db.prepare(
      `INSERT INTO chord_override
         (song_id, section_idx, line_idx, chord_idx, original_sym, created_at)
       VALUES (1, 0, 0, 0, 'C', 'now')`,
    );
    ins.run();
    expect(() => ins.run()).toThrow();
  });
});
