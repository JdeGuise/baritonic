import { describe, it, expect } from "vitest";
import * as core from "../src/index";

describe("public API", () => {
  it("exports the full surface consumers rely on", () => {
    const expected = [
      "parseNote", "noteToString", "noteSemitone", "shiftNote", "LETTERS",
      "keyDelta",
      "spellNote", "simplifyAccidental", "makeReadable", "FLAT_KEYS", "EXOTIC_KEYS",
      "parseChord", "chordToString",
      "transposeChordSymbol", "transposeDocument",
      "collectSymbols",
      "detectKey",
      "chordTones", "spellChordTones", "voicingsFor",
      "chooseVoicings", "transitionCost", "totalMovement",
      "fingeringFor", "fingerVoicing",
    ];
    for (const name of expected) {
      expect(core, `missing export: ${name}`).toHaveProperty(name);
    }
  });

  it("transposes end to end through the public API", () => {
    const iv = core.keyDelta("E", "C");
    expect(core.transposeChordSymbol("C#maj7/C", iv, "C")).toBe("Amaj7/Ab");
  });

  it("detects a key and transposes a document through the public API", () => {
    const doc: core.Song = {
      sections: [
        {
          label: "Verse",
          lines: [
            { kind: "lyric", text: "placeholder line of text", chords: [{ sym: "E", at: 0 }, { sym: "C#m", at: 12 }] },
            { kind: "chords", chords: [{ sym: "A", at: 0 }, { sym: "B", at: 1 }, { sym: "F#m", at: 2 }, { sym: "E", at: 3 }] },
          ],
        },
      ],
    };
    const guess = core.detectKey(core.collectSymbols(doc));
    expect(guess.key).toBe("E");
    expect(guess.mode).toBe("major");

    const out = core.transposeDocument(doc, guess.key, "C");
    expect(core.collectSymbols(out)).toEqual(["C", "Am", "F", "G", "Dm", "C"]);
  });
});
