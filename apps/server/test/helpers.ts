import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { ImportResult } from "@music-ui/ug-import";
import { openDatabase } from "../src/db/connection";
import { migrate } from "../src/db/migrations";

export interface TempDb {
  db: DatabaseSync;
  cleanup: () => void;
}

/** A fresh migrated database in its own temp directory, so suites never
 *  share state. */
export function tempDb(): TempDb {
  const dir = mkdtempSync(join(tmpdir(), "music-ui-test-"));
  const db = openDatabase(join(dir, "test.db"));
  migrate(db);
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function sampleImport(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    meta: {
      ugTabId: 12345,
      ugVersion: 2,
      artist: "Demo Artist",
      title: "Placeholder Song",
      tabType: "Chords",
      tuning: "E A D G B E",
      capo: null,
      rating: 4.88,
      votes: 2232,
      contributor: "demo_user",
      viewTotal: 911997,
    },
    rawBody: "[Verse]\r\n[ch]C[/ch]\r\nplaceholder words",
    document: {
      sections: [
        {
          label: "Verse",
          lines: [{ kind: "lyric", text: "placeholder words", chords: [{ sym: "C", at: 0 }] }],
        },
      ],
    },
    detectedKey: "C",
    detectedMode: "major",
    keyConfidence: 0.9,
    unparseableChords: [],
    ...overrides,
  };
}
