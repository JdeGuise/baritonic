import { describe, it, expect } from "vitest";
import { fetchPage, USER_AGENT } from "../src/fetch";
import { ImportError } from "../src/errors";
import { GOOD_PAGE } from "./fixtures/pages";

const UG_URL = "https://tabs.ultimate-guitar.com/tab/demo";

const ok = (body: string) => async () => new Response(body, { status: 200 });

describe("fetchPage", () => {
  it("returns the page body on success", async () => {
    await expect(fetchPage(UG_URL, ok(GOOD_PAGE))).resolves.toBe(GOOD_PAGE);
  });

  it("sends a browser user agent", async () => {
    let seen: string | null = null;
    await fetchPage(UG_URL, async (_url, init) => {
      seen = new Headers(init?.headers).get("user-agent");
      return new Response(GOOD_PAGE, { status: 200 });
    });
    expect(seen).toBe(USER_AGENT);
  });

  it("classifies a 403 as a challenge", async () => {
    try {
      await fetchPage(UG_URL, async () => new Response("nope", { status: 403 }));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).failure.kind).toBe("challenge");
    }
  });

  it("classifies a 503 as a challenge", async () => {
    await expect(
      fetchPage(UG_URL, async () => new Response("", { status: 503 })),
    ).rejects.toMatchObject({ failure: { kind: "challenge" } });
  });

  it("classifies a 200 interstitial as a challenge", async () => {
    const interstitial = "<html><body>Checking your browser before accessing</body></html>";
    await expect(fetchPage(UG_URL, ok(interstitial))).rejects.toMatchObject({
      failure: { kind: "challenge" },
    });
  });

  it("classifies a 404 as a network failure", async () => {
    await expect(
      fetchPage(UG_URL, async () => new Response("", { status: 404 })),
    ).rejects.toMatchObject({ failure: { kind: "network" } });
  });

  it("classifies a thrown error as a network failure", async () => {
    await expect(
      fetchPage(UG_URL, async () => {
        throw new Error("ECONNREFUSED");
      }),
    ).rejects.toMatchObject({ failure: { kind: "network" } });
  });

  it("rejects a non-Ultimate-Guitar URL", async () => {
    await expect(fetchPage("https://evil.test/tab", ok(GOOD_PAGE))).rejects.toBeInstanceOf(
      ImportError,
    );
  });

  it("rejects a malformed URL", async () => {
    await expect(fetchPage("not a url", ok(GOOD_PAGE))).rejects.toBeInstanceOf(ImportError);
  });
});
