import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import type { FetchLike } from "@music-ui/ug-import";
import { createApp } from "../src/app";
import { createSongRepo } from "../src/repo/songs";
import { createOverrideRepo } from "../src/repo/overrides";
import { tempDb, sampleImport, type TempDb } from "./helpers";
import { GOOD_PAGE } from "../../../packages/ug-import/test/fixtures/pages";

let t: TempDb;
let server: Server;
let base: string;

const start = async (fetchImpl?: FetchLike) => {
  const app = createApp({ db: t.db, fetchImpl });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
};

const post = (body: unknown) =>
  fetch(`${base}/api/songs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  t = tempDb();
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  t.cleanup();
});

describe("GET /api/songs", () => {
  it("returns an empty list initially", async () => {
    await start();
    const res = await fetch(`${base}/api/songs`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns summaries", async () => {
    createSongRepo(t.db).insert(sampleImport(), null);
    await start();
    const body = (await (await fetch(`${base}/api/songs`)).json()) as unknown[];
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ artist: "Demo Artist", effectiveKey: "C" });
  });
});

describe("POST /api/songs", () => {
  it("imports from a url", async () => {
    await start(async () => new Response(GOOD_PAGE, { status: 200 }));
    const res = await post({ url: "https://tabs.ultimate-guitar.com/tab/demo" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; title: string };
    expect(body.title).toBe("Placeholder Song");
    expect(body.id).toBeGreaterThan(0);
  });

  it("imports from pasted text", async () => {
    await start();
    const res = await post({
      artist: "A",
      title: "T",
      rawBody: "[Verse]\r\n[ch]C[/ch]\r\nplaceholder words",
    });
    expect(res.status).toBe(201);
    expect((await res.json()) as { artist: string }).toMatchObject({ artist: "A" });
  });

  it("rejects a body with neither url nor rawBody", async () => {
    await start();
    expect((await post({})).status).toBe(400);
  });

  it("maps a challenge response to 502", async () => {
    await start(async () => new Response("", { status: 403 }));
    const res = await post({ url: "https://tabs.ultimate-guitar.com/tab/demo" });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toMatch(/past/i);
  });

  it("returns 409 when the url was already imported", async () => {
    await start(async () => new Response(GOOD_PAGE, { status: 200 }));
    const body = { url: "https://tabs.ultimate-guitar.com/tab/demo" };
    expect((await post(body)).status).toBe(201);
    expect((await post(body)).status).toBe(409);
  });
});

describe("GET /api/songs/:id", () => {
  it("returns the song with its document", async () => {
    const id = createSongRepo(t.db).insert(sampleImport(), null);
    await start();
    const body = (await (await fetch(`${base}/api/songs/${id}`)).json()) as {
      document: { sections: unknown[] };
      inversions: unknown[];
      orphanedOverrides: unknown[];
    };
    expect(body.document.sections).toHaveLength(1);
    expect(body.inversions).toEqual([]);
    expect(body.orphanedOverrides).toEqual([]);
  });

  it("applies a stored correction to the returned document", async () => {
    const id = createSongRepo(t.db).insert(sampleImport(), null);
    createOverrideRepo(t.db).upsert(id, {
      sectionIdx: 0,
      lineIdx: 0,
      chordIdx: 0,
      originalSym: "C",
      correctedSym: "Cmaj7",
      inversion: null,
    });
    await start();
    const body = (await (await fetch(`${base}/api/songs/${id}`)).json()) as {
      document: { sections: { lines: { chords: { sym: string }[] }[] }[] };
    };
    expect(body.document.sections[0]!.lines[0]!.chords[0]!.sym).toBe("Cmaj7");
  });

  it("reports an orphaned override without applying it", async () => {
    const id = createSongRepo(t.db).insert(sampleImport(), null);
    createOverrideRepo(t.db).upsert(id, {
      sectionIdx: 0,
      lineIdx: 0,
      chordIdx: 0,
      originalSym: "Dm",
      correctedSym: "D7",
      inversion: null,
    });
    await start();
    const body = (await (await fetch(`${base}/api/songs/${id}`)).json()) as {
      document: { sections: { lines: { chords: { sym: string }[] }[] }[] };
      orphanedOverrides: { reason: string }[];
    };
    expect(body.document.sections[0]!.lines[0]!.chords[0]!.sym).toBe("C");
    expect(body.orphanedOverrides).toHaveLength(1);
    expect(body.orphanedOverrides[0]!.reason).toBe("symbol-changed");
  });

  it("returns 404 for a missing song", async () => {
    await start();
    expect((await fetch(`${base}/api/songs/999`)).status).toBe(404);
  });

  it("returns 400 for a non-numeric id", async () => {
    await start();
    expect((await fetch(`${base}/api/songs/abc`)).status).toBe(400);
  });
});

describe("PATCH /api/songs/:id", () => {
  const patch = (id: number, body: unknown) =>
    fetch(`${base}/api/songs/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("updates the preferred key", async () => {
    const id = createSongRepo(t.db).insert(sampleImport(), null);
    await start();
    const res = await patch(id, { preferredKey: "G" });
    expect(res.status).toBe(200);
    expect((await res.json()) as { preferredKey: string }).toMatchObject({ preferredKey: "G" });
  });

  it("rejects an unknown key name", async () => {
    const id = createSongRepo(t.db).insert(sampleImport(), null);
    await start();
    expect((await patch(id, { preferredKey: "H" })).status).toBe(400);
  });

  it("returns 404 for a missing song", async () => {
    await start();
    expect((await patch(999, { preferredKey: "G" })).status).toBe(404);
  });
});

describe("DELETE /api/songs/:id", () => {
  it("deletes a song", async () => {
    const id = createSongRepo(t.db).insert(sampleImport(), null);
    await start();
    expect((await fetch(`${base}/api/songs/${id}`, { method: "DELETE" })).status).toBe(204);
    expect((await fetch(`${base}/api/songs/${id}`)).status).toBe(404);
  });

  it("returns 404 for a missing song", async () => {
    await start();
    expect((await fetch(`${base}/api/songs/999`, { method: "DELETE" })).status).toBe(404);
  });
});
