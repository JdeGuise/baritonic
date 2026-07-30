import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { createApp } from "../src/app";
import { tempDb, type TempDb } from "./helpers";

let t: TempDb;
let server: Server;
let base: string;
let webDir: string;

const start = async (staticDir?: string) => {
  const app = createApp({ db: t.db, staticDir });
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const addr = server.address();
  if (addr === null || typeof addr === "string") throw new Error("no port");
  base = `http://127.0.0.1:${addr.port}`;
};

beforeEach(() => {
  t = tempDb();
  webDir = mkdtempSync(join(tmpdir(), "baritonic-web-"));
  mkdirSync(join(webDir, "assets"), { recursive: true });
  writeFileSync(join(webDir, "index.html"), "<!doctype html><title>baritonic</title>");
  writeFileSync(join(webDir, "assets", "app.js"), "console.log(1);");
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  rmSync(webDir, { recursive: true, force: true });
  t.cleanup();
});

describe("static serving", () => {
  it("serves index.html at the root", async () => {
    await start(webDir);
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("baritonic");
  });

  it("serves built assets", async () => {
    await start(webDir);
    expect((await fetch(`${base}/assets/app.js`)).status).toBe(200);
  });

  it("falls back to index.html for client routes", async () => {
    await start(webDir);
    const res = await fetch(`${base}/songs/42`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("baritonic");
  });

  it("never falls back for api routes", async () => {
    await start(webDir);
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/json/);
  });

  it("still serves the api when no web build exists", async () => {
    await start(undefined);
    expect((await fetch(`${base}/api/songs`)).status).toBe(200);
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
  });
});
