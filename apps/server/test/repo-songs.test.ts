import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSongRepo, type SongRepo } from "../src/repo/songs";
import { tempDb, sampleImport, type TempDb } from "./helpers";

let t: TempDb;
let repo: SongRepo;

beforeEach(() => {
  t = tempDb();
  repo = createSongRepo(t.db);
});
afterEach(() => t.cleanup());

describe("insert and get", () => {
  it("round-trips a song including its document", () => {
    const id = repo.insert(sampleImport(), "https://tabs.ultimate-guitar.com/tab/demo");
    const song = repo.get(id)!;
    expect(song.artist).toBe("Demo Artist");
    expect(song.title).toBe("Placeholder Song");
    expect(song.detectedKey).toBe("C");
    expect(song.document.sections[0]!.label).toBe("Verse");
    expect(song.rawBody).toContain("[ch]C[/ch]");
  });

  it("stores UG metadata as JSON", () => {
    const id = repo.insert(sampleImport(), null);
    expect(repo.get(id)!.ugMeta).toMatchObject({
      rating: 4.88,
      votes: 2232,
      contributor: "demo_user",
    });
  });

  it("accepts a null source url for a pasted import", () => {
    const id = repo.insert(sampleImport(), null);
    expect(repo.get(id)!.sourceUrl).toBeNull();
  });

  it("allows several pasted imports despite the unique url index", () => {
    repo.insert(sampleImport(), null);
    expect(() => repo.insert(sampleImport(), null)).not.toThrow();
  });

  it("returns null for a missing id", () => {
    expect(repo.get(999)).toBeNull();
  });
});

describe("findBySourceUrl", () => {
  it("finds a previously imported url", () => {
    const url = "https://tabs.ultimate-guitar.com/tab/demo";
    const id = repo.insert(sampleImport(), url);
    expect(repo.findBySourceUrl(url)!.id).toBe(id);
  });

  it("returns null for an unknown url", () => {
    expect(repo.findBySourceUrl("https://tabs.ultimate-guitar.com/nope")).toBeNull();
  });
});

describe("list", () => {
  it("returns summaries without the document body", () => {
    repo.insert(sampleImport(), null);
    const rows = repo.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ artist: "Demo Artist", title: "Placeholder Song" });
    expect(rows[0]).not.toHaveProperty("document");
    expect(rows[0]).not.toHaveProperty("rawBody");
  });

  it("orders by artist then title", () => {
    const base = sampleImport();
    repo.insert({ ...base, meta: { ...base.meta, artist: "Zed", title: "A" } }, null);
    repo.insert({ ...base, meta: { ...base.meta, artist: "Abe", title: "B" } }, null);
    expect(repo.list().map((r) => r.artist)).toEqual(["Abe", "Zed"]);
  });

  it("reports the effective key, preferring an override", () => {
    const id = repo.insert(sampleImport(), null);
    expect(repo.list()[0]!.effectiveKey).toBe("C");
    repo.update(id, { keyOverride: "G" });
    expect(repo.list()[0]!.effectiveKey).toBe("G");
  });
});

describe("update", () => {
  it("sets the key override and preferred key", () => {
    const id = repo.insert(sampleImport(), null);
    repo.update(id, { keyOverride: "G", preferredKey: "D" });
    const song = repo.get(id)!;
    expect(song.keyOverride).toBe("G");
    expect(song.preferredKey).toBe("D");
  });

  it("sets artist and title", () => {
    const id = repo.insert(sampleImport(), null);
    repo.update(id, { artist: "New Artist", title: "New Title" });
    expect(repo.get(id)!.artist).toBe("New Artist");
  });

  it("leaves unspecified fields alone", () => {
    const id = repo.insert(sampleImport(), null);
    repo.update(id, { preferredKey: "D" });
    expect(repo.get(id)!.artist).toBe("Demo Artist");
  });

  it("clears a field when passed null", () => {
    const id = repo.insert(sampleImport(), null);
    repo.update(id, { preferredKey: "D" });
    repo.update(id, { preferredKey: null });
    expect(repo.get(id)!.preferredKey).toBeNull();
  });

  it("never overwrites raw_body", () => {
    const id = repo.insert(sampleImport(), null);
    const before = repo.get(id)!.rawBody;
    repo.update(id, { artist: "Changed" });
    expect(repo.get(id)!.rawBody).toBe(before);
  });

  it("touches updated_at", () => {
    const id = repo.insert(sampleImport(), null);
    const before = repo.get(id)!.updatedAt;
    repo.update(id, { artist: "Changed" });
    expect(repo.get(id)!.updatedAt >= before).toBe(true);
  });

  it("returns false for a missing id", () => {
    expect(repo.update(999, { artist: "x" })).toBe(false);
  });
});

describe("remove", () => {
  it("deletes a song", () => {
    const id = repo.insert(sampleImport(), null);
    expect(repo.remove(id)).toBe(true);
    expect(repo.get(id)).toBeNull();
  });

  it("returns false for a missing id", () => {
    expect(repo.remove(999)).toBe(false);
  });
});
