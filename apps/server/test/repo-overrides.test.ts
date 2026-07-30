import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSongRepo } from "../src/repo/songs";
import { createOverrideRepo, type OverrideRepo } from "../src/repo/overrides";
import { tempDb, sampleImport, type TempDb } from "./helpers";

let t: TempDb;
let repo: OverrideRepo;
let songId: number;

beforeEach(() => {
  t = tempDb();
  songId = createSongRepo(t.db).insert(sampleImport(), null);
  repo = createOverrideRepo(t.db);
});
afterEach(() => t.cleanup());

const pos = { sectionIdx: 0, lineIdx: 0, chordIdx: 0 };

describe("upsert", () => {
  it("inserts a correction", () => {
    repo.upsert(songId, { ...pos, originalSym: "C", correctedSym: "Cmaj7", inversion: null });
    expect(repo.listForSong(songId)).toEqual([
      { ...pos, originalSym: "C", correctedSym: "Cmaj7", inversion: null },
    ]);
  });

  it("replaces an existing override at the same position", () => {
    repo.upsert(songId, { ...pos, originalSym: "C", correctedSym: "Cmaj7", inversion: null });
    repo.upsert(songId, { ...pos, originalSym: "C", correctedSym: "C7", inversion: 1 });
    const rows = repo.listForSong(songId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.correctedSym).toBe("C7");
    expect(rows[0]!.inversion).toBe(1);
  });

  it("keeps overrides at different positions separate", () => {
    repo.upsert(songId, { ...pos, originalSym: "C", correctedSym: "Cmaj7", inversion: null });
    repo.upsert(songId, {
      ...pos,
      chordIdx: 1,
      originalSym: "G",
      correctedSym: "G7",
      inversion: null,
    });
    expect(repo.listForSong(songId)).toHaveLength(2);
  });

  it("stores an inversion-only override", () => {
    repo.upsert(songId, { ...pos, originalSym: "C", correctedSym: null, inversion: 2 });
    expect(repo.listForSong(songId)[0]).toMatchObject({ correctedSym: null, inversion: 2 });
  });
});

describe("listForSong", () => {
  it("returns an empty list for a song with no overrides", () => {
    expect(repo.listForSong(songId)).toEqual([]);
  });

  it("orders by position", () => {
    repo.upsert(songId, { ...pos, chordIdx: 2, originalSym: "x", correctedSym: null, inversion: 0 });
    repo.upsert(songId, { ...pos, chordIdx: 0, originalSym: "y", correctedSym: null, inversion: 0 });
    expect(repo.listForSong(songId).map((o) => o.chordIdx)).toEqual([0, 2]);
  });

  it("does not leak another song's overrides", () => {
    const other = createSongRepo(t.db).insert(sampleImport(), null);
    repo.upsert(other, { ...pos, originalSym: "C", correctedSym: "Cmaj7", inversion: null });
    expect(repo.listForSong(songId)).toEqual([]);
  });
});

describe("remove", () => {
  it("deletes one override by position", () => {
    repo.upsert(songId, { ...pos, originalSym: "C", correctedSym: "Cmaj7", inversion: null });
    expect(repo.remove(songId, pos)).toBe(true);
    expect(repo.listForSong(songId)).toEqual([]);
  });

  it("returns false when there is nothing to delete", () => {
    expect(repo.remove(songId, pos)).toBe(false);
  });
});

describe("removeAllForSong", () => {
  it("clears every override for a song", () => {
    repo.upsert(songId, { ...pos, originalSym: "C", correctedSym: "Cmaj7", inversion: null });
    repo.upsert(songId, { ...pos, chordIdx: 1, originalSym: "G", correctedSym: null, inversion: 1 });
    expect(repo.removeAllForSong(songId)).toBe(2);
    expect(repo.listForSong(songId)).toEqual([]);
  });
});
