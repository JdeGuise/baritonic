import { describe, it, expect } from "vitest";
import { extractStore, getPageData, str, num, obj } from "../src/extract";
import { ImportError } from "../src/errors";
import { GOOD_PAGE, SCHEMA_DRIFT_PAGE, CHALLENGE_PAGE } from "./fixtures/pages";

describe("extractStore", () => {
  it("unescapes and parses the embedded payload", () => {
    const store = extractStore(GOOD_PAGE);
    expect(store).toBeTypeOf("object");
  });

  it("throws a schema failure when the store element is absent", () => {
    try {
      extractStore(CHALLENGE_PAGE);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ImportError);
      expect((e as ImportError).failure.kind).toBe("schema");
    }
  });

  it("throws a schema failure when the payload is not valid JSON", () => {
    const broken = '<div class="js-store" data-content="{not json"></div>';
    expect(() => extractStore(broken)).toThrow(ImportError);
  });
});

describe("getPageData", () => {
  it("reaches store.page.data", () => {
    const data = getPageData(extractStore(GOOD_PAGE));
    expect(data).toHaveProperty("tab");
  });

  it("throws a schema failure when the shape changed", () => {
    expect(() => getPageData(extractStore(SCHEMA_DRIFT_PAGE))).toThrow(ImportError);
  });
});

describe("defensive accessors", () => {
  const src = { a: "x", n: 5, o: { deep: 1 }, nested: { b: "y" } };

  it("reads present values", () => {
    expect(str(src, "a")).toBe("x");
    expect(num(src, "n")).toBe(5);
    expect(obj(src, "o")).toEqual({ deep: 1 });
  });

  it("returns null for missing or wrongly-typed values", () => {
    expect(str(src, "missing")).toBeNull();
    expect(str(src, "n")).toBeNull();
    expect(num(src, "a")).toBeNull();
    expect(obj(src, "a")).toBeNull();
  });

  it("never throws on a non-object source", () => {
    expect(str(null, "a")).toBeNull();
    expect(num(undefined, "a")).toBeNull();
    expect(obj("string", "a")).toBeNull();
  });
});
