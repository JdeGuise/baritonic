import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Server } from "node:http";
import { createApp } from "../src/app";
import { tempDb, type TempDb } from "./helpers";

let t: TempDb;
let server: Server;
let base: string;

beforeEach(async () => {
  t = tempDb();
  const app = createApp({ db: t.db, fetchImpl: async () => new Response("", { status: 200 }) });
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

describe("GET /healthz", () => {
  it("reports ok", async () => {
    const res = await fetch(`${base}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });
});

describe("error handling", () => {
  it("returns JSON 404 for an unknown api route", async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/json/);
    expect(await res.json()).toHaveProperty("error");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await fetch(`${base}/api/songs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("error");
  });
});
