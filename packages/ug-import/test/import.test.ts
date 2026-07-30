import { describe, it, expect } from "vitest";
import { importFromHtml, importFromText, importFromUrl } from "../src/import";
import { ImportError } from "../src/errors";
import { GOOD_PAGE, PRO_PAGE, CHALLENGE_PAGE, SIMPLE_BODY } from "./fixtures/pages";

const UG_URL = "https://tabs.ultimate-guitar.com/tab/demo";

describe("importFromHtml", () => {
  const r = importFromHtml(GOOD_PAGE);

  it("returns metadata, body, and document together", () => {
    expect(r.meta.title).toBe("Placeholder Song");
    expect(r.meta.artist).toBe("Demo Artist");
    expect(r.rawBody).toBe(SIMPLE_BODY);
    expect(r.document.sections).toHaveLength(2);
  });

  it("detects a key", () => {
    expect(r.detectedKey).toBe("C");
    expect(r.detectedMode).toBe("major");
    expect(r.keyConfidence).toBeGreaterThan(0);
  });

  it("reports no unparseable chords for a clean tab", () => {
    expect(r.unparseableChords).toEqual([]);
  });

  it("surfaces a pro tab as a typed failure", () => {
    expect(() => importFromHtml(PRO_PAGE)).toThrow(ImportError);
  });

  it("surfaces a challenge page as a schema failure at parse time", () => {
    expect(() => importFromHtml(CHALLENGE_PAGE)).toThrow(ImportError);
  });
});

describe("importFromText", () => {
  it("accepts a pasted body with supplied artist and title", () => {
    const r = importFromText({ artist: "A", title: "T", body: SIMPLE_BODY });
    expect(r.meta.artist).toBe("A");
    expect(r.meta.title).toBe("T");
    expect(r.meta.ugTabId).toBeNull();
    expect(r.document.sections).toHaveLength(2);
  });

  it("falls back to placeholders for blank artist and title", () => {
    const r = importFromText({ artist: "  ", title: "", body: SIMPLE_BODY });
    expect(r.meta.artist).toBe("Unknown artist");
    expect(r.meta.title).toBe("Untitled");
  });
});

describe("importFromUrl", () => {
  it("fetches then parses", async () => {
    const r = await importFromUrl(UG_URL, async () => new Response(GOOD_PAGE, { status: 200 }));
    expect(r.meta.title).toBe("Placeholder Song");
  });

  it("propagates a challenge failure", async () => {
    await expect(
      importFromUrl(UG_URL, async () => new Response("", { status: 403 })),
    ).rejects.toMatchObject({ failure: { kind: "challenge" } });
  });
});
