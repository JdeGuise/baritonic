import { describe, it, expect } from "vitest";
import { detectKey } from "../src/key-detect";

describe("detectKey", () => {
  it("identifies a clear major key", () => {
    const g = detectKey(["E", "Emaj7", "Esus2", "B", "C#m", "F#m", "A", "E"]);
    expect(g.key).toBe("E");
    expect(g.mode).toBe("major");
    expect(g.confidence).toBeGreaterThan(0.7);
  });

  it("identifies a clear minor key", () => {
    const g = detectKey(["Am", "Dm", "E", "Am", "F", "G", "Am"]);
    expect(g.key).toBe("A");
    expect(g.mode).toBe("minor");
  });

  it("prefers flat spelling in flat keys", () => {
    const g = detectKey(["Bb", "Eb", "F", "Bb", "Gm", "Cm", "Bb"]);
    expect(g.key).toBe("Bb");
  });

  it("reports low confidence for chromatic material", () => {
    const g = detectKey(["C", "C#", "D", "D#", "E", "F", "F#"]);
    expect(g.confidence).toBeLessThan(0.6);
  });

  it("handles an empty input without throwing", () => {
    const g = detectKey([]);
    expect(g.confidence).toBe(0);
  });

  it("ignores unparseable symbols", () => {
    const g = detectKey(["N.C.", "E", "B", "C#m", "A", "E"]);
    expect(g.key).toBe("E");
  });
});
