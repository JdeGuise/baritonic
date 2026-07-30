import { describe, it, expect } from "vitest";
import { keyDelta } from "../src/interval";
import { transposeChordSymbol } from "../src/transpose";
import { parseChord } from "../src/chord";
import { EXOTIC_KEYS } from "../src/spelling";
import { REFERENCE_VOCABULARY, ALL_KEYS } from "./fixtures";

const SOURCE_KEY = "E";

function sweep(): Array<{ key: string; from: string; out: string }> {
  const rows: Array<{ key: string; from: string; out: string }> = [];
  for (const key of ALL_KEYS) {
    const iv = keyDelta(SOURCE_KEY, key);
    for (const from of REFERENCE_VOCABULARY) {
      rows.push({ key, from, out: transposeChordSymbol(from, iv, key) });
    }
  }
  return rows;
}

describe("transposition invariants over the reference vocabulary x 12 keys", () => {
  const rows = sweep();

  it("covers 288 combinations", () => {
    expect(rows).toHaveLength(REFERENCE_VOCABULARY.length * ALL_KEYS.length);
    expect(rows).toHaveLength(288);
  });

  it("never emits a double accidental", () => {
    const bad = rows.filter((r) => /##|bb/.test(r.out));
    expect(bad).toEqual([]);
  });

  it("always emits a re-parseable symbol", () => {
    const bad = rows.filter((r) => parseChord(r.out) === null);
    expect(bad).toEqual([]);
  });

  it("emits Cb, Fb, B# or E# only in keys whose signature contains them", () => {
    const bad = rows.filter(
      (r) => /(?:^|\/)(?:Cb|Fb|B#|E#)(?![#b])/.test(r.out) && !EXOTIC_KEYS.has(r.key),
    );
    expect(bad).toEqual([]);
  });
});
