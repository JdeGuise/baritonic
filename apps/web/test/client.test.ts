import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiError } from "../src/api/client.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.restoreAllMocks());

describe("listSongs", () => {
  it("requests the songs endpoint and returns the list", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse([{ id: 1 }]));
    await expect(api.listSongs()).resolves.toEqual([{ id: 1 }]);
    expect(spy.mock.calls[0]![0]).toBe("/api/songs");
  });
});

describe("error handling", () => {
  it("throws ApiError carrying the server message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "This looks like a Pro tab" }, 422),
    );
    await expect(api.importUrl("https://example.test")).rejects.toThrow(/Pro tab/);
  });

  it("exposes the status on the error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "nope" }, 502));
    await expect(api.importUrl("https://example.test")).rejects.toMatchObject({ status: 502 });
  });

  it("falls back to a generic message when the body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("boom", { status: 500 }));
    await expect(api.listSongs()).rejects.toBeInstanceOf(ApiError);
  });

  it("reports a network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(api.listSongs()).rejects.toMatchObject({ status: 0 });
  });
});

describe("mutations", () => {
  it("posts a url import", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: 1 }, 201));
    await api.importUrl("https://tabs.ultimate-guitar.com/tab/demo");
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("/api/songs");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      url: "https://tabs.ultimate-guitar.com/tab/demo",
    });
  });

  it("posts a pasted import", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: 1 }, 201));
    await api.importText({ artist: "A", title: "T", rawBody: "body" });
    expect(JSON.parse(String(spy.mock.calls[0]![1]?.body))).toEqual({
      artist: "A",
      title: "T",
      rawBody: "body",
    });
  });

  it("patches a song", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ id: 1 }));
    await api.updateSong(1, { preferredKey: "G" });
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe("/api/songs/1");
    expect(init?.method).toBe("PATCH");
  });

  it("puts an override at a position", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    await api.putOverride(
      7,
      { sectionIdx: 1, lineIdx: 2, chordIdx: 3 },
      { originalSym: "C", correctedSym: "Cmaj7" },
    );
    expect(spy.mock.calls[0]![0]).toBe("/api/songs/7/overrides/1/2/3");
    expect(spy.mock.calls[0]![1]?.method).toBe("PUT");
  });

  it("tolerates an empty 204 body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.deleteSong(1)).resolves.toBeUndefined();
  });
});
