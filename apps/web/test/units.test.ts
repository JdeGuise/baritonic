import { describe, it, expect } from "vitest";
import { toUnits } from "../src/music/units.ts";

describe("toUnits", () => {
  it("returns one unit of plain text when there are no chords", () => {
    expect(toUnits("placeholder words", [])).toEqual([
      { chords: [], text: "placeholder words" },
    ]);
  });

  it("splits text at each anchor", () => {
    expect(
      toUnits("placeholder words here", [
        { sym: "C", at: 0 },
        { sym: "G", at: 12 },
      ]),
    ).toEqual([
      { chords: ["C"], text: "placeholder " },
      { chords: ["G"], text: "words here" },
    ]);
  });

  it("emits a leading unit when the first anchor is not at zero", () => {
    expect(toUnits("placeholder words", [{ sym: "C", at: 6 }])).toEqual([
      { chords: [], text: "placeh" },
      { chords: ["C"], text: "older words" },
    ]);
  });

  it("collapses several chords sharing an anchor", () => {
    expect(
      toUnits("word", [
        { sym: "C", at: 0 },
        { sym: "G", at: 0 },
      ]),
    ).toEqual([{ chords: ["C", "G"], text: "word" }]);
  });

  it("sorts anchors that arrive out of order", () => {
    expect(
      toUnits("placeholder words", [
        { sym: "G", at: 12 },
        { sym: "C", at: 0 },
      ]),
    ).toEqual([
      { chords: ["C"], text: "placeholder " },
      { chords: ["G"], text: "words" },
    ]);
  });

  it("keeps an anchor at the very end as an empty unit", () => {
    expect(toUnits("word", [{ sym: "C", at: 4 }])).toEqual([
      { chords: [], text: "word" },
      { chords: ["C"], text: "" },
    ]);
  });

  it("clamps an anchor beyond the end of the text", () => {
    expect(toUnits("word", [{ sym: "C", at: 99 }])).toEqual([
      { chords: [], text: "word" },
      { chords: ["C"], text: "" },
    ]);
  });

  it("clamps a negative anchor to zero", () => {
    expect(toUnits("word", [{ sym: "C", at: -3 }])).toEqual([{ chords: ["C"], text: "word" }]);
  });

  it("handles empty text with a chord", () => {
    expect(toUnits("", [{ sym: "C", at: 0 }])).toEqual([{ chords: ["C"], text: "" }]);
  });

  it("preserves internal whitespace exactly", () => {
    const units = toUnits("two  spaces here", [{ sym: "C", at: 5 }]);
    expect(units.map((u) => u.text).join("")).toBe("two  spaces here");
  });

  it("always reconstructs the original text", () => {
    const text = "placeholder line of text for layout";
    for (const anchors of [[0], [0, 5], [3, 3, 20], [0, 12, 34], [35]]) {
      const chords = anchors.map((at, i) => ({ sym: `C${i}`, at }));
      expect(toUnits(text, chords).map((u) => u.text).join("")).toBe(text);
    }
  });
});
