import { describe, it, expect } from "vitest";
import { extractStore, getPageData } from "../src/extract";
import { readMeta, readBody } from "../src/metadata";
import { ImportError } from "../src/errors";
import { GOOD_PAGE, PRO_PAGE, SIMPLE_BODY } from "./fixtures/pages";

const data = (html: string) => getPageData(extractStore(html));

describe("readMeta", () => {
  it("reads the fields the app stores", () => {
    const m = readMeta(data(GOOD_PAGE));
    expect(m).toMatchObject({
      ugTabId: 12345,
      ugVersion: 2,
      artist: "Demo Artist",
      title: "Placeholder Song",
      tabType: "Chords",
      tuning: "E A D G B E",
      rating: 4.88,
      votes: 2232,
      contributor: "demo_user",
      viewTotal: 911997,
    });
  });

  it("yields null for absent fields rather than throwing", () => {
    const m = readMeta(data(PRO_PAGE));
    expect(m.ugVersion).toBeNull();
    expect(m.tuning).toBeNull();
    expect(m.rating).toBeNull();
    expect(m.capo).toBeNull();
  });

  it("survives a completely empty payload", () => {
    const m = readMeta({});
    expect(m.artist).toBe("Unknown artist");
    expect(m.title).toBe("Untitled");
  });
});

describe("readBody", () => {
  it("returns the tab body", () => {
    expect(readBody(data(GOOD_PAGE))).toBe(SIMPLE_BODY);
  });

  it("throws a pro-tab failure when there is no body", () => {
    try {
      readBody(data(PRO_PAGE));
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).failure.kind).toBe("pro-tab");
    }
  });
});
