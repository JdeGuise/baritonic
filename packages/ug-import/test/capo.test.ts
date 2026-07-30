import { describe, it, expect } from "vitest";
import { foldCapo } from "../src/capo";

describe("foldCapo", () => {
  it("returns the key unchanged when there is no capo", () => {
    expect(foldCapo("C", null)).toBe("C");
    expect(foldCapo("C", 0)).toBe("C");
  });

  it("raises the key by the capo fret", () => {
    expect(foldCapo("C", 2)).toBe("D");
    expect(foldCapo("G", 3)).toBe("Bb");
    expect(foldCapo("E", 1)).toBe("F");
  });

  it("wraps around the octave", () => {
    expect(foldCapo("B", 2)).toBe("Db");
    expect(foldCapo("A", 12)).toBe("A");
  });

  it("returns a conventional key spelling", () => {
    for (let capo = 0; capo <= 12; capo++) {
      expect(foldCapo("C", capo)).toMatch(/^[A-G][#b]?$/);
    }
  });

  it("leaves an unparseable key alone", () => {
    expect(foldCapo("H", 2)).toBe("H");
  });
});
