import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app";
import { createSongRepo } from "../src/repo/songs";
import { tempDb, sampleImport, type TempDb } from "./helpers";

let t: TempDb;
let server: Server;
let base: string;
let id: number;

beforeEach(async () => {
  t = tempDb();
  id = createSongRepo(t.db).insert(sampleImport(), null);
  const app = createApp({ db: t.db });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  t.cleanup();
});

const put = (path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const getSong = async () =>
  (await (await fetch(`${base}/api/songs/${id}`)).json()) as {
    document: { sections: { lines: { chords: { sym: string }[] }[] }[] };
    inversions: { inversion: number }[];
  };

describe("PUT override", () => {
  it("stores a correction and reflects it on the song", async () => {
    const res = await put(`/api/songs/${id}/overrides/0/0/0`, {
      originalSym: "C",
      correctedSym: "Cmaj7",
    });
    expect(res.status).toBe(204);
    expect((await getSong()).document.sections[0]!.lines[0]!.chords[0]!.sym).toBe("Cmaj7");
  });

  it("stores an inversion pin", async () => {
    const res = await put(`/api/songs/${id}/overrides/0/0/0`, { originalSym: "C", inversion: 2 });
    expect(res.status).toBe(204);
    expect((await getSong()).inversions[0]!.inversion).toBe(2);
  });

  it("replaces an existing override at the same position", async () => {
    await put(`/api/songs/${id}/overrides/0/0/0`, { originalSym: "C", correctedSym: "Cmaj7" });
    await put(`/api/songs/${id}/overrides/0/0/0`, { originalSym: "C", correctedSym: "C7" });
    expect((await getSong()).document.sections[0]!.lines[0]!.chords[0]!.sym).toBe("C7");
  });

  it("rejects an unparseable corrected symbol", async () => {
    const res = await put(`/api/songs/${id}/overrides/0/0/0`, {
      originalSym: "C",
      correctedSym: "H7",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/chord/i);
  });

  it("requires originalSym", async () => {
    expect((await put(`/api/songs/${id}/overrides/0/0/0`, { correctedSym: "C7" })).status).toBe(400);
  });

  it("rejects a negative index", async () => {
    const res = await put(`/api/songs/${id}/overrides/0/0/-1`, {
      originalSym: "C",
      correctedSym: "C7",
    });
    expect(res.status).toBe(400);
  });

  it("rejects an inversion that is not a small non-negative integer", async () => {
    const res = await put(`/api/songs/${id}/overrides/0/0/0`, { originalSym: "C", inversion: 9 });
    expect(res.status).toBe(400);
  });

  it("requires at least one of correctedSym or inversion", async () => {
    expect((await put(`/api/songs/${id}/overrides/0/0/0`, { originalSym: "C" })).status).toBe(400);
  });

  it("returns 404 for a missing song", async () => {
    const res = await put(`/api/songs/999/overrides/0/0/0`, {
      originalSym: "C",
      correctedSym: "C7",
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE override", () => {
  it("removes a stored override", async () => {
    await put(`/api/songs/${id}/overrides/0/0/0`, { originalSym: "C", correctedSym: "Cmaj7" });
    const res = await fetch(`${base}/api/songs/${id}/overrides/0/0/0`, { method: "DELETE" });
    expect(res.status).toBe(204);
    expect((await getSong()).document.sections[0]!.lines[0]!.chords[0]!.sym).toBe("C");
  });

  it("returns 404 when there is no such override", async () => {
    const res = await fetch(`${base}/api/songs/${id}/overrides/0/0/0`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
