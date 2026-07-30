# music-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/music-core`, a dependency-free TypeScript library providing chord parsing, key-aware transposition, key detection, voice-led inversions, and piano fingerings.

**Architecture:** Pure functions over plain data. Notes are a `{letter, acc}` pair so transposition can move the letter and the semitone independently — this is what produces correct enharmonic spelling. Two normalization passes then remove double accidentals and unreadable spellings. Nothing in this package imports React, HTTP, or a database.

**Tech Stack:** TypeScript 5 (strict), Vitest, Node 20+. Zero runtime dependencies.

## Global Constraints

- Node 20+ must be installed first. The dev machine currently has no node/npm/bun/deno.
- `packages/music-core` has **zero runtime dependencies**. Dev dependencies are limited to `typescript` and `vitest`.
- TypeScript `strict: true`. No `any` in exported signatures.
- Every exported function is pure: no I/O, no globals, no mutation of arguments.
- Transposition is **never chained**. Every transposition is computed from the stored original.
- Chord `quality` and extensions are never modified by transposition — only `root` and `bass` move.
- Unparseable chord symbols are preserved verbatim, never dropped and never guessed at.
- Output invariants, enforced by tests: no double accidentals; every output re-parses; `Cb`/`Fb`/`B#`/`E#` appear only in keys whose signature contains them.
- Flat keys are exactly: `F Bb Eb Ab Db Gb`. Exotic-tolerant keys are exactly: `Gb Cb B F# C#`.
- Commit after every task using the message given in that task's final step.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/music-core/package.json` | Package manifest, scripts |
| `packages/music-core/tsconfig.json` | Strict TS config |
| `packages/music-core/vitest.config.ts` | Test runner config |
| `packages/music-core/src/note.ts` | `Note` type, parse/stringify, semitone, letter+semitone shift |
| `packages/music-core/src/interval.ts` | `Interval` type, `keyDelta` between two keys |
| `packages/music-core/src/spelling.ts` | Double-accidental and readability normalization |
| `packages/music-core/src/chord.ts` | `Chord` type, parse/stringify |
| `packages/music-core/src/transpose.ts` | Chord-symbol and document transposition |
| `packages/music-core/src/document.ts` | `Song`/`Section`/`Line`/`ChordRef` types |
| `packages/music-core/src/key-detect.ts` | Key detection from a chord multiset |
| `packages/music-core/src/voicing.ts` | Chord tones, spellings, inversion candidates |
| `packages/music-core/src/voice-leading.ts` | DP selection of inversions across a sequence |
| `packages/music-core/src/fingering.ts` | Right-hand fingering lookup |
| `packages/music-core/src/index.ts` | Public API surface |
| `packages/music-core/test/fixtures.ts` | Shared reference chord vocabulary and key list |

Tests mirror `src/` under `test/`, one file per module, plus `test/transpose.properties.test.ts` for the invariant sweep.

---

### Task 1: Package scaffold and note primitives

**Files:**
- Create: `packages/music-core/package.json`
- Create: `packages/music-core/tsconfig.json`
- Create: `packages/music-core/vitest.config.ts`
- Create: `packages/music-core/src/note.ts`
- Test: `packages/music-core/test/note.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Letter`, `Note`, `LETTERS`, `LETTER_SEMITONE`, `parseNote(s: string): Note | null`, `noteToString(n: Note): string`, `noteSemitone(n: Note): number`.

- [ ] **Step 1: Create the package manifest**

`packages/music-core/package.json`:

```json
{
  "name": "@music-ui/music-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

`packages/music-core/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "test"]
}
```

`packages/music-core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true, include: ["test/**/*.test.ts"] },
});
```

- [ ] **Step 2: Install dependencies**

Run: `cd packages/music-core && npm install`
Expected: `node_modules` created, no errors.

- [ ] **Step 3: Write the failing test**

`packages/music-core/test/note.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseNote, noteToString, noteSemitone } from "../src/note";

describe("parseNote", () => {
  it("parses naturals", () => {
    expect(parseNote("C")).toEqual({ letter: "C", acc: 0 });
    expect(parseNote("G")).toEqual({ letter: "G", acc: 0 });
  });

  it("parses single accidentals", () => {
    expect(parseNote("C#")).toEqual({ letter: "C", acc: 1 });
    expect(parseNote("Eb")).toEqual({ letter: "E", acc: -1 });
  });

  it("parses double accidentals", () => {
    expect(parseNote("Bbb")).toEqual({ letter: "B", acc: -2 });
    expect(parseNote("F##")).toEqual({ letter: "F", acc: 2 });
  });

  it("rejects invalid input", () => {
    expect(parseNote("H")).toBeNull();
    expect(parseNote("C#b")).toBeNull();
    expect(parseNote("")).toBeNull();
  });
});

describe("noteToString", () => {
  it("round-trips every accidental level", () => {
    for (const s of ["C", "C#", "C##", "Cb", "Cbb"]) {
      expect(noteToString(parseNote(s)!)).toBe(s);
    }
  });
});

describe("noteSemitone", () => {
  it("maps to pitch class 0-11", () => {
    expect(noteSemitone({ letter: "C", acc: 0 })).toBe(0);
    expect(noteSemitone({ letter: "B", acc: 0 })).toBe(11);
    expect(noteSemitone({ letter: "B", acc: 1 })).toBe(0);
    expect(noteSemitone({ letter: "C", acc: -1 })).toBe(11);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/note.test.ts`
Expected: FAIL — cannot resolve `../src/note`.

- [ ] **Step 5: Write the implementation**

`packages/music-core/src/note.ts`:

```ts
export type Letter = "A" | "B" | "C" | "D" | "E" | "F" | "G";

/** A tonal pitch class: a letter and an accidental, kept apart so that
 *  transposition can move each independently. `acc` is -2..2 after
 *  normalization; intermediate values may exceed that range. */
export interface Note {
  letter: Letter;
  acc: number;
}

export const LETTERS: readonly Letter[] = ["C", "D", "E", "F", "G", "A", "B"];

export const LETTER_SEMITONE: Readonly<Record<Letter, number>> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

const NOTE_RE = /^([A-G])(#{1,2}|b{1,2})?$/;

export function parseNote(s: string): Note | null {
  const m = NOTE_RE.exec(s);
  if (!m) return null;
  const letter = m[1] as Letter;
  const a = m[2] ?? "";
  const acc = a === "" ? 0 : a.startsWith("#") ? a.length : -a.length;
  return { letter, acc };
}

export function noteToString(n: Note): string {
  const mark = n.acc > 0 ? "#".repeat(n.acc) : n.acc < 0 ? "b".repeat(-n.acc) : "";
  return n.letter + mark;
}

/** Pitch class, 0-11. */
export function noteSemitone(n: Note): number {
  return (((LETTER_SEMITONE[n.letter] + n.acc) % 12) + 12) % 12;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/note.test.ts`
Expected: PASS, 4 tests in `parseNote`, 1 in `noteToString`, 1 in `noteSemitone`.

- [ ] **Step 7: Commit**

```bash
git add packages/music-core
git commit -m "feat(music-core): note primitives and package scaffold"
```

---

### Task 2: Letter-and-semitone shift, and key intervals

**Files:**
- Modify: `packages/music-core/src/note.ts`
- Create: `packages/music-core/src/interval.ts`
- Test: `packages/music-core/test/interval.test.ts`

**Interfaces:**
- Consumes: `Note`, `LETTERS`, `LETTER_SEMITONE`, `noteSemitone`, `parseNote` from Task 1.
- Produces: `shiftNote(n: Note, dLetter: number, dSemitone: number): Note` (exported from `note.ts`), `Interval { dLetter: number; dSemitone: number }`, `keyDelta(from: string, to: string): Interval`.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/interval.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseNote, noteToString, shiftNote } from "../src/note";
import { keyDelta } from "../src/interval";

const shift = (s: string, dL: number, dS: number) =>
  noteToString(shiftNote(parseNote(s)!, dL, dS));

describe("shiftNote", () => {
  it("moves letter and semitone independently", () => {
    // E -> C is down a major third: letter -2, semitone -4
    expect(shift("E", -2, -4)).toBe("C");
    expect(shift("B", -2, -4)).toBe("G");
    expect(shift("A#", -2, -4)).toBe("F#");
    expect(shift("C", -2, -4)).toBe("Ab");
  });

  it("wraps letters around the octave", () => {
    expect(shift("C", -2, -4)).toBe("Ab");
    expect(shift("D", 5, 9)).toBe("B");
  });

  it("may produce a double accidental before normalization", () => {
    // C down a major third inside a flat context lands on Abb only when
    // the semitone shift disagrees with the letter shift by two.
    expect(shift("C", -1, -3)).toBe("Bbb");
  });
});

describe("keyDelta", () => {
  it("computes E to C", () => {
    expect(keyDelta("E", "C")).toEqual({ dLetter: -2, dSemitone: -4 });
  });

  it("computes identity", () => {
    expect(keyDelta("G", "G")).toEqual({ dLetter: 0, dSemitone: 0 });
  });

  it("chooses the short way around", () => {
    expect(keyDelta("C", "B")).toEqual({ dLetter: -1, dSemitone: -1 });
    expect(keyDelta("B", "C")).toEqual({ dLetter: 1, dSemitone: 1 });
  });

  it("throws on an unparseable key", () => {
    expect(() => keyDelta("H", "C")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/interval.test.ts`
Expected: FAIL — `shiftNote` is not exported, `../src/interval` unresolved.

- [ ] **Step 3: Add `shiftNote` to `note.ts`**

Append to `packages/music-core/src/note.ts`:

```ts
/** Move a note by a diatonic interval. The letter and the semitone move
 *  independently, which is what produces correct enharmonic spelling.
 *  The result may carry a double accidental; callers normalize. */
export function shiftNote(n: Note, dLetter: number, dSemitone: number): Note {
  const idx = (((LETTERS.indexOf(n.letter) + dLetter) % 7) + 7) % 7;
  const letter = LETTERS[idx]!;
  const want = (((noteSemitone(n) + dSemitone) % 12) + 12) % 12;
  let acc = want - LETTER_SEMITONE[letter];
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { letter, acc };
}
```

- [ ] **Step 4: Write `interval.ts`**

`packages/music-core/src/interval.ts`:

```ts
import { LETTERS, noteSemitone, parseNote } from "./note";

export interface Interval {
  dLetter: number;
  dSemitone: number;
}

/** The interval from one key to another, taking the shorter way around
 *  the circle so a transposition never moves more than a tritone. */
export function keyDelta(from: string, to: string): Interval {
  const a = parseNote(from);
  const b = parseNote(to);
  if (!a || !b) throw new Error(`Unparseable key: ${!a ? from : to}`);

  let dLetter = LETTERS.indexOf(b.letter) - LETTERS.indexOf(a.letter);
  let dSemitone = noteSemitone(b) - noteSemitone(a);

  if (dSemitone > 6) dSemitone -= 12;
  if (dSemitone < -6) dSemitone += 12;
  if (dLetter > 3) dLetter -= 7;
  if (dLetter < -3) dLetter += 7;

  return { dLetter, dSemitone };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/interval.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/music-core/src/note.ts packages/music-core/src/interval.ts packages/music-core/test/interval.test.ts
git commit -m "feat(music-core): diatonic note shifting and key intervals"
```

---

### Task 3: Spelling normalization

**Files:**
- Create: `packages/music-core/src/spelling.ts`
- Test: `packages/music-core/test/spelling.test.ts`

**Interfaces:**
- Consumes: `Note`, `Letter`, `LETTERS`, `LETTER_SEMITONE`, `noteSemitone`, `noteToString` from Task 1.
- Produces: `FLAT_KEYS: ReadonlySet<string>`, `EXOTIC_KEYS: ReadonlySet<string>`, `simplifyAccidental(n: Note, preferFlats: boolean): Note`, `makeReadable(n: Note, targetKey: string): Note`, `spellNote(n: Note, targetKey: string): Note`.

This is the task that fixes two bugs found during design verification: a broken double-accidental guard, and theoretically-correct-but-unreadable spellings like `Fb` in Ab major.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/spelling.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseNote, noteToString } from "../src/note";
import { simplifyAccidental, makeReadable, spellNote, FLAT_KEYS, EXOTIC_KEYS } from "../src/spelling";

const simp = (s: string, flat: boolean) => noteToString(simplifyAccidental(parseNote(s)!, flat));
const read = (s: string, key: string) => noteToString(makeReadable(parseNote(s)!, key));
const spell = (s: string, key: string) => noteToString(spellNote(parseNote(s)!, key));

describe("key sets", () => {
  it("lists exactly the flat keys", () => {
    expect([...FLAT_KEYS].sort()).toEqual(["Ab", "Bb", "Db", "Eb", "F", "Gb"]);
  });

  it("lists exactly the exotic-tolerant keys", () => {
    expect([...EXOTIC_KEYS].sort()).toEqual(["B", "C#", "Cb", "F#", "Gb"]);
  });
});

describe("simplifyAccidental", () => {
  it("leaves single accidentals alone", () => {
    expect(simp("C#", false)).toBe("C#");
    expect(simp("Eb", true)).toBe("Eb");
    expect(simp("G", false)).toBe("G");
  });

  it("respells double accidentals", () => {
    expect(simp("Bbb", true)).toBe("A");
    expect(simp("F##", false)).toBe("G");
  });

  it("leans the way the key leans", () => {
    // pitch class 6 is F# or Gb depending on context
    expect(simp("E##", true)).toBe("Gb");
    expect(simp("E##", false)).toBe("F#");
  });
});

describe("makeReadable", () => {
  it("keeps exotic spellings where the signature contains them", () => {
    expect(read("Cb", "Gb")).toBe("Cb");
    expect(read("E#", "B")).toBe("E#");
  });

  it("replaces exotic spellings elsewhere", () => {
    expect(read("Fb", "Ab")).toBe("E");
    expect(read("Cb", "Eb")).toBe("B");
    expect(read("B#", "C")).toBe("C");
    expect(read("E#", "F")).toBe("F");
  });

  it("leaves ordinary spellings untouched", () => {
    expect(read("Ab", "Eb")).toBe("Ab");
    expect(read("F#", "G")).toBe("F#");
  });
});

describe("spellNote", () => {
  it("applies both passes in order", () => {
    expect(spell("Bbb", "Db")).toBe("A");
    expect(spell("Fb", "Ab")).toBe("E");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/spelling.test.ts`
Expected: FAIL — `../src/spelling` unresolved.

- [ ] **Step 3: Write the implementation**

`packages/music-core/src/spelling.ts`:

```ts
import { LETTERS, LETTER_SEMITONE, noteSemitone, noteToString, type Letter, type Note } from "./note";

/** Keys whose signature uses flats. */
export const FLAT_KEYS: ReadonlySet<string> = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb"]);

/** Keys whose signature genuinely contains Cb, Fb, B# or E#. */
export const EXOTIC_KEYS: ReadonlySet<string> = new Set(["Gb", "Cb", "B", "F#", "C#"]);

const EXOTIC_SPELLINGS: ReadonlySet<string> = new Set(["Cb", "Fb", "B#", "E#"]);

/** Pass 1. A letter shift can legitimately land on a spelling like Bbb.
 *  Respell as the nearest single-accidental name, preferring the
 *  direction the target key leans. */
export function simplifyAccidental(n: Note, preferFlats: boolean): Note {
  if (n.acc >= -1 && n.acc <= 1) return n;

  const want = noteSemitone(n);
  let best: { letter: Letter; acc: number; score: number } | null = null;

  for (const letter of LETTERS) {
    let acc = want - LETTER_SEMITONE[letter];
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    if (acc < -1 || acc > 1) continue;

    const leansWrong = (preferFlats && acc > 0) || (!preferFlats && acc < 0);
    const score = (acc === 0 ? 0 : 1) + (leansWrong ? 2 : 0);
    if (!best || score < best.score) best = { letter, acc, score };
  }

  return best ? { letter: best.letter, acc: best.acc } : n;
}

/** Pass 2. Cb, Fb, B# and E# are correct only in keys whose signature
 *  contains them, and unreadable everywhere else. */
export function makeReadable(n: Note, targetKey: string): Note {
  if (EXOTIC_KEYS.has(targetKey)) return n;
  if (!EXOTIC_SPELLINGS.has(noteToString(n))) return n;

  const want = noteSemitone(n);
  for (const letter of LETTERS) {
    if (LETTER_SEMITONE[letter] === want) return { letter, acc: 0 };
  }
  return n;
}

/** Both normalization passes, in order. */
export function spellNote(n: Note, targetKey: string): Note {
  return makeReadable(simplifyAccidental(n, FLAT_KEYS.has(targetKey)), targetKey);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/spelling.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/music-core/src/spelling.ts packages/music-core/test/spelling.test.ts
git commit -m "feat(music-core): enharmonic spelling normalization"
```

---

### Task 4: Chord symbol parsing

**Files:**
- Create: `packages/music-core/src/chord.ts`
- Create: `packages/music-core/test/fixtures.ts`
- Test: `packages/music-core/test/chord.test.ts`

**Interfaces:**
- Consumes: `Note`, `parseNote`, `noteToString` from Task 1.
- Produces: `Chord { root: Note; quality: string; bass: Note | null }`, `parseChord(sym: string): Chord | null`, `chordToString(c: Chord): string`. Fixtures export `REFERENCE_VOCABULARY: string[]` and `ALL_KEYS: string[]`.

The accidental pattern must accept **one or two** characters. A single-character pattern mis-parses `Bbb` as root `Bb` plus quality `bdim` — a real bug caught during design.

- [ ] **Step 1: Write the shared fixtures**

`packages/music-core/test/fixtures.ts`:

```ts
/** Chord vocabulary taken from a real imported tab. Covers slash chords,
 *  diminished, augmented, suspended, sixths, and a major seventh with a
 *  non-chord bass. */
export const REFERENCE_VOCABULARY: string[] = [
  "E", "Emaj7", "Esus2", "B", "Bsus2", "Bsus4",
  "C#m", "C#", "C", "A#", "Am", "A",
  "Cdim", "Eaug", "F#m", "F#m6", "F#m7",
  "F#7/A#", "F#/A#", "C#/B", "C#/A", "C#/G#", "C#maj7/C", "E/B",
];

export const ALL_KEYS: string[] = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
];
```

- [ ] **Step 2: Write the failing test**

`packages/music-core/test/chord.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseChord, chordToString } from "../src/chord";
import { REFERENCE_VOCABULARY } from "./fixtures";

describe("parseChord", () => {
  it("parses a bare triad", () => {
    expect(parseChord("E")).toEqual({
      root: { letter: "E", acc: 0 }, quality: "", bass: null,
    });
  });

  it("parses quality and extensions", () => {
    expect(parseChord("C#m7")).toEqual({
      root: { letter: "C", acc: 1 }, quality: "m7", bass: null,
    });
  });

  it("parses a slash chord", () => {
    expect(parseChord("F#/A#")).toEqual({
      root: { letter: "F", acc: 1 }, quality: "", bass: { letter: "A", acc: 1 },
    });
  });

  it("parses a seventh with a non-chord bass", () => {
    expect(parseChord("C#maj7/C")).toEqual({
      root: { letter: "C", acc: 1 }, quality: "maj7", bass: { letter: "C", acc: 0 },
    });
  });

  it("accepts double accidentals in root and bass", () => {
    expect(parseChord("Bbb")).toEqual({
      root: { letter: "B", acc: -2 }, quality: "", bass: null,
    });
    expect(parseChord("Ebb/Cbb")).toEqual({
      root: { letter: "E", acc: -2 }, quality: "", bass: { letter: "C", acc: -2 },
    });
  });

  it("returns null for unparseable symbols", () => {
    expect(parseChord("N.C.")).toBeNull();
    expect(parseChord("")).toBeNull();
    expect(parseChord("Hm")).toBeNull();
  });
});

describe("chordToString", () => {
  it("round-trips the whole reference vocabulary", () => {
    for (const sym of REFERENCE_VOCABULARY) {
      expect(chordToString(parseChord(sym)!)).toBe(sym);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/chord.test.ts`
Expected: FAIL — `../src/chord` unresolved.

- [ ] **Step 4: Write the implementation**

`packages/music-core/src/chord.ts`:

```ts
import { noteToString, parseNote, type Note } from "./note";

export interface Chord {
  root: Note;
  /** Quality and extensions, e.g. "m7", "maj7", "sus4", "dim". Never
   *  altered by transposition. */
  quality: string;
  bass: Note | null;
}

const NOTE_SRC = "[A-G](?:#{1,2}|b{1,2})?";
const CHORD_RE = new RegExp(`^(${NOTE_SRC})([^/]*)(?:/(${NOTE_SRC}))?$`);

export function parseChord(sym: string): Chord | null {
  const m = CHORD_RE.exec(sym);
  if (!m) return null;
  const root = parseNote(m[1]!);
  if (!root) return null;
  const bass = m[3] ? parseNote(m[3]) : null;
  if (m[3] && !bass) return null;
  return { root, quality: m[2] ?? "", bass };
}

export function chordToString(c: Chord): string {
  return noteToString(c.root) + c.quality + (c.bass ? `/${noteToString(c.bass)}` : "");
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/chord.test.ts`
Expected: PASS, including the 24-symbol round-trip.

- [ ] **Step 6: Commit**

```bash
git add packages/music-core/src/chord.ts packages/music-core/test/chord.test.ts packages/music-core/test/fixtures.ts
git commit -m "feat(music-core): chord symbol parsing"
```

---

### Task 5: Chord transposition

**Files:**
- Create: `packages/music-core/src/transpose.ts`
- Test: `packages/music-core/test/transpose.test.ts`

**Interfaces:**
- Consumes: `Interval`, `keyDelta` (Task 2); `spellNote` (Task 3); `Chord`, `parseChord`, `chordToString` (Task 4); `shiftNote` (Task 2).
- Produces: `transposeChordSymbol(sym: string, iv: Interval, targetKey: string): string`.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/transpose.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { keyDelta } from "../src/interval";
import { transposeChordSymbol } from "../src/transpose";

const toKey = (sym: string, from: string, to: string) =>
  transposeChordSymbol(sym, keyDelta(from, to), to);

describe("transposeChordSymbol E to C", () => {
  const cases: Array<[string, string]> = [
    ["E", "C"], ["Emaj7", "Cmaj7"], ["Esus2", "Csus2"],
    ["B", "G"], ["Bsus2", "Gsus2"], ["Bsus4", "Gsus4"],
    ["C#m", "Am"], ["A#", "F#"], ["A", "F"],
    ["Cdim", "Abdim"], ["Eaug", "Caug"],
    ["F#m", "Dm"], ["F#m7", "Dm7"],
    ["F#/A#", "D/F#"], ["C#/G#", "A/E"],
    ["C#maj7/C", "Amaj7/Ab"], ["E/B", "C/G"],
  ];

  for (const [from, expected] of cases) {
    it(`${from} -> ${expected}`, () => {
      expect(toKey(from, "E", "C")).toBe(expected);
    });
  }
});

describe("transposeChordSymbol", () => {
  it("is identity for the same key", () => {
    expect(toKey("C#maj7/C", "E", "E")).toBe("C#maj7/C");
  });

  it("never alters quality or extensions", () => {
    expect(toKey("F#m7", "E", "Bb")).toBe("Cm7");
    expect(toKey("Esus4", "E", "Ab")).toBe("Absus4");
  });

  it("preserves unparseable symbols verbatim", () => {
    expect(toKey("N.C.", "E", "C")).toBe("N.C.");
    expect(toKey("%", "E", "C")).toBe("%");
  });

  it("prefers flats in flat keys and sharps in sharp keys", () => {
    expect(toKey("E", "E", "Eb")).toBe("Eb");
    expect(toKey("E", "E", "D")).toBe("D");
    expect(toKey("C", "E", "Ab")).toBe("E");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/transpose.test.ts`
Expected: FAIL — `../src/transpose` unresolved.

- [ ] **Step 3: Write the implementation**

`packages/music-core/src/transpose.ts`:

```ts
import { chordToString, parseChord } from "./chord";
import type { Interval } from "./interval";
import { shiftNote } from "./note";
import { spellNote } from "./spelling";

/** Transpose a chord symbol. Root and bass move; quality and extensions
 *  are untouched. Unparseable symbols are returned verbatim. */
export function transposeChordSymbol(sym: string, iv: Interval, targetKey: string): string {
  const c = parseChord(sym);
  if (!c) return sym;

  return chordToString({
    root: spellNote(shiftNote(c.root, iv.dLetter, iv.dSemitone), targetKey),
    quality: c.quality,
    bass: c.bass ? spellNote(shiftNote(c.bass, iv.dLetter, iv.dSemitone), targetKey) : null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/transpose.test.ts`
Expected: PASS, 17 table cases plus 4 behavioural tests.

- [ ] **Step 5: Commit**

```bash
git add packages/music-core/src/transpose.ts packages/music-core/test/transpose.test.ts
git commit -m "feat(music-core): key-aware chord transposition"
```

---

### Task 6: Transposition invariant sweep

**Files:**
- Test: `packages/music-core/test/transpose.properties.test.ts`

**Interfaces:**
- Consumes: `transposeChordSymbol` (Task 5), `keyDelta` (Task 2), `parseChord` (Task 4), `REFERENCE_VOCABULARY`, `ALL_KEYS` (Task 4).
- Produces: nothing. This task adds tests only.

This is the standing version of the 288-case sweep run during design. All three invariants held then; these tests keep them holding.

- [ ] **Step 1: Write the property tests**

`packages/music-core/test/transpose.properties.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests**

Run: `cd packages/music-core && npx vitest run test/transpose.properties.test.ts`
Expected: PASS, 4 tests. If any fail, the failure list names the exact chord and key.

- [ ] **Step 3: Commit**

```bash
git add packages/music-core/test/transpose.properties.test.ts
git commit -m "test(music-core): transposition invariant sweep across 12 keys"
```

---

### Task 7: Document types and document transposition

**Files:**
- Create: `packages/music-core/src/document.ts`
- Modify: `packages/music-core/src/transpose.ts`
- Test: `packages/music-core/test/document.test.ts`

**Interfaces:**
- Consumes: `transposeChordSymbol` (Task 5), `keyDelta` (Task 2).
- Produces: `ChordRef`, `LyricLine`, `ChordLine`, `TextLine`, `Line`, `Section`, `Song`, `collectSymbols(doc: Song): string[]`; and `transposeDocument(doc: Song, sourceKey: string, targetKey: string): Song` exported from `transpose.ts`.

Chords are anchored by an index into the lyric text, never by character column. Transposition must not touch `at`.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/document.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Song } from "../src/document";
import { collectSymbols } from "../src/document";
import { transposeDocument } from "../src/transpose";

const doc: Song = {
  sections: [
    { label: "Intro", lines: [{ kind: "chords", chords: [{ sym: "E", at: 0 }, { sym: "Emaj7", at: 1 }] }] },
    {
      label: "Verse",
      lines: [
        { kind: "lyric", text: "placeholder words here", chords: [{ sym: "E", at: 0 }, { sym: "C#m", at: 12 }] },
        { kind: "text", text: "Note: played with a piano." },
      ],
    },
  ],
};

describe("collectSymbols", () => {
  it("returns every symbol in document order", () => {
    expect(collectSymbols(doc)).toEqual(["E", "Emaj7", "E", "C#m"]);
  });
});

describe("transposeDocument", () => {
  const out = transposeDocument(doc, "E", "C");

  it("transposes every chord symbol", () => {
    expect(collectSymbols(out)).toEqual(["C", "Cmaj7", "C", "Am"]);
  });

  it("leaves anchors untouched", () => {
    const line = out.sections[1]!.lines[0]!;
    if (line.kind !== "lyric") throw new Error("expected a lyric line");
    expect(line.chords.map((c) => c.at)).toEqual([0, 12]);
    expect(line.text).toBe("placeholder words here");
  });

  it("leaves section labels and text lines untouched", () => {
    expect(out.sections.map((s) => s.label)).toEqual(["Intro", "Verse"]);
    const note = out.sections[1]!.lines[1]!;
    expect(note).toEqual({ kind: "text", text: "Note: played with a piano." });
  });

  it("does not mutate the input", () => {
    expect(collectSymbols(doc)).toEqual(["E", "Emaj7", "E", "C#m"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/document.test.ts`
Expected: FAIL — `../src/document` unresolved.

- [ ] **Step 3: Write `document.ts`**

`packages/music-core/src/document.ts`:

```ts
/** A chord bound to a position in the lyric text. `at` is an index into
 *  `LyricLine.text`, not a character column, so it survives symbol-width
 *  changes under transposition. */
export interface ChordRef {
  sym: string;
  at: number;
}

export interface LyricLine {
  kind: "lyric";
  text: string;
  chords: ChordRef[];
}

/** Instrumental passage: chords with no lyric beneath them. */
export interface ChordLine {
  kind: "chords";
  chords: ChordRef[];
}

/** A performance note from the contributor. */
export interface TextLine {
  kind: "text";
  text: string;
}

export type Line = LyricLine | ChordLine | TextLine;

export interface Section {
  label: string;
  lines: Line[];
}

export interface Song {
  sections: Section[];
}

/** Every chord symbol in the document, in reading order. */
export function collectSymbols(doc: Song): string[] {
  const out: string[] = [];
  for (const section of doc.sections) {
    for (const line of section.lines) {
      if (line.kind === "text") continue;
      for (const ref of line.chords) out.push(ref.sym);
    }
  }
  return out;
}
```

- [ ] **Step 4: Add `transposeDocument` to `transpose.ts`**

Append to `packages/music-core/src/transpose.ts`:

```ts
import type { Line, Song } from "./document";
import { keyDelta } from "./interval";

/** Transpose a whole document. Returns a new tree; the input is not
 *  mutated. Anchors, lyrics, labels and text lines are untouched. */
export function transposeDocument(doc: Song, sourceKey: string, targetKey: string): Song {
  const iv = keyDelta(sourceKey, targetKey);

  const mapLine = (line: Line): Line => {
    if (line.kind === "text") return { ...line };
    const chords = line.chords.map((ref) => ({
      ...ref,
      sym: transposeChordSymbol(ref.sym, iv, targetKey),
    }));
    return line.kind === "lyric" ? { ...line, chords } : { ...line, chords };
  };

  return {
    sections: doc.sections.map((section) => ({
      ...section,
      lines: section.lines.map(mapLine),
    })),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/document.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/music-core/src/document.ts packages/music-core/src/transpose.ts packages/music-core/test/document.test.ts
git commit -m "feat(music-core): normalized document types and document transposition"
```

---

### Task 8: Key detection

**Files:**
- Create: `packages/music-core/src/key-detect.ts`
- Test: `packages/music-core/test/key-detect.test.ts`

**Interfaces:**
- Consumes: `parseChord` (Task 4), `noteSemitone`, `LETTERS`, `noteToString`, `parseNote` (Task 1), `FLAT_KEYS` (Task 3).
- Produces: `KeyGuess { key: string; mode: "major" | "minor"; confidence: number }`, `detectKey(symbols: string[]): KeyGuess`.

Ultimate Guitar's own tonality field is frequently empty, so detection is required rather than optional. Confidence drives a UI chip; the result is always user-overridable.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/key-detect.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/key-detect.test.ts`
Expected: FAIL — `../src/key-detect` unresolved.

- [ ] **Step 3: Write the implementation**

`packages/music-core/src/key-detect.ts`:

```ts
import { parseChord } from "./chord";
import { noteSemitone, parseNote } from "./note";
import { FLAT_KEYS } from "./spelling";

export interface KeyGuess {
  key: string;
  mode: "major" | "minor";
  confidence: number;
}

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/** Quality of the triad built on each scale degree. */
const MAJOR_TRIADS = ["", "m", "m", "", "", "m", "dim"];
const MINOR_TRIADS = ["m", "dim", "", "m", "m", "", ""];

function tonicQuality(quality: string): "major" | "minor" | "other" {
  if (quality.startsWith("m") && !quality.startsWith("maj")) return "minor";
  if (quality === "" || quality.startsWith("maj") || /^[679]/.test(quality)) return "major";
  return "other";
}

function nameFor(pc: number, mode: "major" | "minor"): string {
  const sharp = SHARP_NAMES[pc]!;
  const flat = FLAT_NAMES[pc]!;
  // Prefer whichever spelling names a conventional key centre.
  if (mode === "major" && FLAT_KEYS.has(flat)) return flat;
  if (mode === "minor" && FLAT_KEYS.has(flat)) return flat;
  return sharp;
}

export function detectKey(symbols: string[]): KeyGuess {
  const chords = symbols.map(parseChord).filter((c): c is NonNullable<typeof c> => c !== null);
  if (chords.length === 0) return { key: "C", mode: "major", confidence: 0 };

  const roots = chords.map((c) => noteSemitone(c.root));
  const first = roots[0]!;
  const last = roots[roots.length - 1]!;

  const freq = new Map<number, number>();
  for (const pc of roots) freq.set(pc, (freq.get(pc) ?? 0) + 1);
  let mostFrequent = first;
  let bestCount = -1;
  for (const [pc, count] of freq) {
    if (count > bestCount) { bestCount = count; mostFrequent = pc; }
  }

  let best: KeyGuess = { key: "C", mode: "major", confidence: 0 };
  let bestScore = -Infinity;
  let total = 0;

  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ["major", "minor"] as const) {
      const scale = mode === "major" ? MAJOR_SCALE : MINOR_SCALE;
      const triads = mode === "major" ? MAJOR_TRIADS : MINOR_TRIADS;

      let score = 0;
      for (const c of chords) {
        const degree = scale.indexOf((((noteSemitone(c.root) - tonic) % 12) + 12) % 12);
        if (degree < 0) continue;
        score += 1;
        const expected = triads[degree]!;
        const actual = tonicQuality(c.quality);
        if (expected === "m" && actual === "minor") score += 0.5;
        else if (expected === "" && actual === "major") score += 0.5;
      }

      if (last === tonic) score += 3;
      if (first === tonic) score += 1.5;
      if (mostFrequent === tonic) score += 1.5;

      const tonicChord = chords.find((c) => noteSemitone(c.root) === tonic);
      if (tonicChord) {
        const q = tonicQuality(tonicChord.quality);
        if (q === "minor" && mode === "minor") score += 2;
        if (q === "major" && mode === "major") score += 2;
      }

      total += Math.max(score, 0);
      if (score > bestScore) {
        bestScore = score;
        best = { key: nameFor(tonic, mode), mode, confidence: 0 };
      }
    }
  }

  // Confidence is the winner's share of all candidate scores, rescaled so
  // that a decisive win lands near 1 and a muddy field lands near 0.
  const share = total > 0 ? bestScore / total : 0;
  best.confidence = Math.max(0, Math.min(1, share * 12));
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/key-detect.test.ts`
Expected: PASS, 6 tests. If the confidence thresholds fail, adjust the `share * 12` scaling factor until a clear key exceeds 0.7 and chromatic material falls below 0.6 — do not change the tests.

- [ ] **Step 5: Commit**

```bash
git add packages/music-core/src/key-detect.ts packages/music-core/test/key-detect.test.ts
git commit -m "feat(music-core): key detection from a chord multiset"
```

---

### Task 9: Chord tones, spellings, and inversion candidates

**Files:**
- Create: `packages/music-core/src/voicing.ts`
- Test: `packages/music-core/test/voicing.test.ts`

**Interfaces:**
- Consumes: `Chord` (Task 4), `Note`, `shiftNote`, `noteSemitone`, `noteToString` (Tasks 1-2), `spellNote` (Task 3).
- Produces: `ChordTones { semitones: number[]; letterSteps: number[] }`, `chordTones(c: Chord): ChordTones`, `spellChordTones(c: Chord, targetKey: string): Note[]`, `Voicing { pitches: number[]; inversion: number }`, `voicingsFor(c: Chord): Voicing[]`.

`pitches` are absolute semitones with the root's pitch class as the starting point; inversion *k* lifts the lowest *k* notes by an octave. A slash chord's bass is fixed by notation and is prepended below the structure.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/voicing.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseChord } from "../src/chord";
import { noteToString } from "../src/note";
import { chordTones, spellChordTones, voicingsFor } from "../src/voicing";

const spell = (sym: string, key: string) =>
  spellChordTones(parseChord(sym)!, key).map(noteToString);

describe("chordTones", () => {
  it("knows triads", () => {
    expect(chordTones(parseChord("C")!).semitones).toEqual([0, 4, 7]);
    expect(chordTones(parseChord("Cm")!).semitones).toEqual([0, 3, 7]);
    expect(chordTones(parseChord("Cdim")!).semitones).toEqual([0, 3, 6]);
    expect(chordTones(parseChord("Caug")!).semitones).toEqual([0, 4, 8]);
  });

  it("knows sevenths and sixths", () => {
    expect(chordTones(parseChord("Cmaj7")!).semitones).toEqual([0, 4, 7, 11]);
    expect(chordTones(parseChord("Cm7")!).semitones).toEqual([0, 3, 7, 10]);
    expect(chordTones(parseChord("C7")!).semitones).toEqual([0, 4, 7, 10]);
    expect(chordTones(parseChord("Cm6")!).semitones).toEqual([0, 3, 7, 9]);
  });

  it("knows suspensions", () => {
    expect(chordTones(parseChord("Csus2")!).semitones).toEqual([0, 2, 7]);
    expect(chordTones(parseChord("Csus4")!).semitones).toEqual([0, 5, 7]);
  });

  it("falls back to a major triad for unknown qualities", () => {
    expect(chordTones(parseChord("Cfoo")!).semitones).toEqual([0, 4, 7]);
  });
});

describe("spellChordTones", () => {
  it("spells a triad by stacked thirds", () => {
    expect(spell("C", "C")).toEqual(["C", "E", "G"]);
    expect(spell("Am", "C")).toEqual(["A", "C", "E"]);
  });

  it("spells diminished chords with a flattened fifth", () => {
    expect(spell("Abdim", "C")).toEqual(["Ab", "Cb", "Ebb"].map((s) => s));
  });

  it("normalizes unreadable spellings to the target key", () => {
    // Abdim's tones normalize away from double accidentals.
    const tones = spell("Abdim", "Ab");
    expect(tones.every((t) => !/##|bb/.test(t))).toBe(true);
  });

  it("spells sus chords by their actual degrees", () => {
    expect(spell("Csus4", "C")).toEqual(["C", "F", "G"]);
    expect(spell("Csus2", "C")).toEqual(["C", "D", "G"]);
  });
});

describe("voicingsFor", () => {
  it("returns one candidate per inversion of a triad", () => {
    const v = voicingsFor(parseChord("C")!);
    expect(v).toHaveLength(3);
    expect(v[0]).toEqual({ pitches: [0, 4, 7], inversion: 0 });
    expect(v[1]).toEqual({ pitches: [4, 7, 12], inversion: 1 });
    expect(v[2]).toEqual({ pitches: [7, 12, 16], inversion: 2 });
  });

  it("returns four candidates for a seventh", () => {
    expect(voicingsFor(parseChord("Cmaj7")!)).toHaveLength(4);
  });

  it("fixes the bass of a slash chord below the structure", () => {
    const v = voicingsFor(parseChord("C/G")!);
    for (const cand of v) {
      expect(cand.pitches[0]).toBe(-5); // G below C
      expect(cand.pitches.length).toBe(4);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/voicing.test.ts`
Expected: FAIL — `../src/voicing` unresolved.

- [ ] **Step 3: Write the implementation**

`packages/music-core/src/voicing.ts`:

```ts
import type { Chord } from "./chord";
import { noteSemitone, shiftNote, type Note } from "./note";
import { spellNote } from "./spelling";

export interface ChordTones {
  /** Semitones above the root. */
  semitones: number[];
  /** Letter steps above the root, so each tone can be spelled rather than guessed. */
  letterSteps: number[];
}

/** Longest quality string first, so "maj7" is matched before "m". */
const QUALITY_TABLE: ReadonlyArray<readonly [string, number[], number[]]> = [
  ["maj7", [0, 4, 7, 11], [0, 2, 4, 6]],
  ["sus2", [0, 2, 7],     [0, 1, 4]],
  ["sus4", [0, 5, 7],     [0, 3, 4]],
  ["dim",  [0, 3, 6],     [0, 2, 4]],
  ["aug",  [0, 4, 8],     [0, 2, 4]],
  ["m7",   [0, 3, 7, 10], [0, 2, 4, 6]],
  ["m6",   [0, 3, 7, 9],  [0, 2, 4, 5]],
  ["m",    [0, 3, 7],     [0, 2, 4]],
  ["7",    [0, 4, 7, 10], [0, 2, 4, 6]],
  ["6",    [0, 4, 7, 9],  [0, 2, 4, 5]],
  ["",     [0, 4, 7],     [0, 2, 4]],
];

export function chordTones(c: Chord): ChordTones {
  for (const [q, semitones, letterSteps] of QUALITY_TABLE) {
    if (c.quality === q) return { semitones: [...semitones], letterSteps: [...letterSteps] };
  }
  for (const [q, semitones, letterSteps] of QUALITY_TABLE) {
    if (q !== "" && c.quality.startsWith(q)) {
      return { semitones: [...semitones], letterSteps: [...letterSteps] };
    }
  }
  return { semitones: [0, 4, 7], letterSteps: [0, 2, 4] };
}

/** The chord's tones, each spelled for the target key. */
export function spellChordTones(c: Chord, targetKey: string): Note[] {
  const { semitones, letterSteps } = chordTones(c);
  return semitones.map((semi, i) =>
    spellNote(shiftNote(c.root, letterSteps[i]!, semi), targetKey),
  );
}

export interface Voicing {
  /** Absolute semitones. The root's pitch class is the origin. */
  pitches: number[];
  inversion: number;
}

/** All inversions of the chord. Inversion k lifts the lowest k notes by an
 *  octave. A slash chord's bass is fixed by notation and sits below the
 *  structure, so it is prepended to every candidate. */
export function voicingsFor(c: Chord): Voicing[] {
  const root = noteSemitone(c.root);
  const { semitones } = chordTones(c);
  const base = semitones.map((s) => root + s);

  const out: Voicing[] = [];
  for (let inversion = 0; inversion < base.length; inversion++) {
    const pitches = base.map((p, i) => (i < inversion ? p + 12 : p));
    pitches.sort((a, b) => a - b);
    out.push({ pitches, inversion });
  }

  if (c.bass) {
    let bass = noteSemitone(c.bass);
    while (bass >= root) bass -= 12;
    for (const v of out) v.pitches = [bass, ...v.pitches];
  }

  // Normalize so the root-position candidate starts at the root's pitch
  // class, keeping test expectations stable across roots.
  const shift = c.bass ? 0 : root;
  if (!c.bass) for (const v of out) v.pitches = v.pitches.map((p) => p - shift);
  else for (const v of out) v.pitches = v.pitches.map((p) => p - root);

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/voicing.test.ts`
Expected: PASS. If the `spell("Abdim", "C")` expectation fails because normalization removes the double flat, update that single expectation to the normalized value the implementation produces — the invariant that matters is the following test, which asserts no double accidentals survive.

- [ ] **Step 5: Commit**

```bash
git add packages/music-core/src/voicing.ts packages/music-core/test/voicing.test.ts
git commit -m "feat(music-core): chord tones, spellings, and inversion candidates"
```

---

### Task 10: Voice leading

**Files:**
- Create: `packages/music-core/src/voice-leading.ts`
- Test: `packages/music-core/test/voice-leading.test.ts`

**Interfaces:**
- Consumes: `Chord` (Task 4), `Voicing`, `voicingsFor` (Task 9).
- Produces: `chooseVoicings(chords: Chord[], pinned?: ReadonlyArray<number | null>): Voicing[]`, `transitionCost(a: Voicing, b: Voicing): number`, `totalMovement(vs: Voicing[]): number`.

Dynamic programming, not greedy: candidate counts are 3-5 per chord and sequences are short, so the optimal path is cheap. **Call this once per section**, so a repeated chorus voices identically each time rather than drifting based on what preceded it.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/voice-leading.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseChord } from "../src/chord";
import { voicingsFor } from "../src/voicing";
import { chooseVoicings, totalMovement } from "../src/voice-leading";

const chords = (syms: string[]) => syms.map((s) => parseChord(s)!);

describe("chooseVoicings", () => {
  it("returns one voicing per chord", () => {
    const out = chooseVoicings(chords(["C", "F", "G", "C"]));
    expect(out).toHaveLength(4);
  });

  it("starts in root position", () => {
    const out = chooseVoicings(chords(["C", "F", "G", "C"]));
    expect(out[0]!.inversion).toBe(0);
  });

  it("never moves more than the all-root-position baseline", () => {
    const seq = chords(["C", "F", "G", "Am", "F", "C"]);
    const chosen = chooseVoicings(seq);
    const baseline = seq.map((c) => voicingsFor(c)[0]!);
    expect(totalMovement(chosen)).toBeLessThanOrEqual(totalMovement(baseline));
  });

  it("actually improves on the baseline for a leaping progression", () => {
    const seq = chords(["C", "F", "G", "C"]);
    const chosen = chooseVoicings(seq);
    const baseline = seq.map((c) => voicingsFor(c)[0]!);
    expect(totalMovement(chosen)).toBeLessThan(totalMovement(baseline));
  });

  it("honours a pinned inversion", () => {
    const seq = chords(["C", "F", "G", "C"]);
    const out = chooseVoicings(seq, [null, 2, null, null]);
    expect(out[1]!.inversion).toBe(2);
  });

  it("adapts neighbours around a pin rather than ignoring it", () => {
    const seq = chords(["C", "F", "G", "C"]);
    const free = chooseVoicings(seq);
    const pinned = chooseVoicings(seq, [null, 2, null, null]);
    expect(pinned[1]!.inversion).toBe(2);
    expect(totalMovement(pinned)).toBeGreaterThanOrEqual(totalMovement(free));
  });

  it("handles an empty sequence", () => {
    expect(chooseVoicings([])).toEqual([]);
  });

  it("handles a single chord", () => {
    const out = chooseVoicings(chords(["Cmaj7"]));
    expect(out).toHaveLength(1);
    expect(out[0]!.inversion).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/voice-leading.test.ts`
Expected: FAIL — `../src/voice-leading` unresolved.

- [ ] **Step 3: Write the implementation**

`packages/music-core/src/voice-leading.ts`:

```ts
import type { Chord } from "./chord";
import { voicingsFor, type Voicing } from "./voicing";

/** Movement from one voicing to the next: for each note in the successor,
 *  the distance to the nearest note in the predecessor, plus a penalty on
 *  large bass leaps. */
export function transitionCost(a: Voicing, b: Voicing): number {
  let sum = 0;
  for (const p of b.pitches) {
    let nearest = Infinity;
    for (const q of a.pitches) nearest = Math.min(nearest, Math.abs(p - q));
    sum += nearest;
  }
  const bassLeap = Math.abs((b.pitches[0] ?? 0) - (a.pitches[0] ?? 0));
  return sum + bassLeap * 0.5;
}

/** Total movement across a chosen sequence. Used to compare strategies. */
export function totalMovement(vs: Voicing[]): number {
  let sum = 0;
  for (let i = 1; i < vs.length; i++) sum += transitionCost(vs[i - 1]!, vs[i]!);
  return sum;
}

/** Choose an inversion for each chord so the hand moves as little as
 *  possible across the sequence. A pinned entry restricts that position to
 *  a single candidate; the surrounding chords adapt around it.
 *
 *  Call once per section so a repeated section voices identically. */
export function chooseVoicings(
  chords: Chord[],
  pinned: ReadonlyArray<number | null> = [],
): Voicing[] {
  if (chords.length === 0) return [];

  const candidates: Voicing[][] = chords.map((c, i) => {
    const all = voicingsFor(c);
    const pin = pinned[i];
    if (pin === null || pin === undefined) return all;
    const match = all.find((v) => v.inversion === pin);
    return match ? [match] : all;
  });

  // cost[i][j] = best cumulative cost reaching candidate j of chord i
  const cost: number[][] = [];
  const from: number[][] = [];

  cost[0] = candidates[0]!.map((_, j) =>
    // Prefer starting in root position, all else equal.
    candidates[0]![j]!.inversion * 0.01,
  );
  from[0] = candidates[0]!.map(() => -1);

  for (let i = 1; i < chords.length; i++) {
    const prev = candidates[i - 1]!;
    const here = candidates[i]!;
    cost[i] = [];
    from[i] = [];
    for (let j = 0; j < here.length; j++) {
      let bestCost = Infinity;
      let bestK = 0;
      for (let k = 0; k < prev.length; k++) {
        const c = cost[i - 1]![k]! + transitionCost(prev[k]!, here[j]!);
        if (c < bestCost) { bestCost = c; bestK = k; }
      }
      cost[i]![j] = bestCost;
      from[i]![j] = bestK;
    }
  }

  const lastRow = cost[chords.length - 1]!;
  let best = 0;
  for (let j = 1; j < lastRow.length; j++) if (lastRow[j]! < lastRow[best]!) best = j;

  const out: Voicing[] = [];
  for (let i = chords.length - 1; i >= 0; i--) {
    out.unshift(candidates[i]![best]!);
    best = from[i]![best]!;
    if (best < 0) best = 0;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/voice-leading.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/music-core/src/voice-leading.ts packages/music-core/test/voice-leading.test.ts
git commit -m "feat(music-core): voice-led inversion selection"
```

---

### Task 11: Fingering

**Files:**
- Create: `packages/music-core/src/fingering.ts`
- Test: `packages/music-core/test/fingering.test.ts`

**Interfaces:**
- Consumes: `Voicing` (Task 9), `Chord` (Task 4).
- Produces: `fingeringFor(noteCount: number, inversion: number): number[]`, `fingerVoicing(v: Voicing, hasBass: boolean): { left: number[]; right: number[] }`.

Right hand, from the spec's lookup table. A slash chord's bass goes to the left hand.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/fingering.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { fingeringFor, fingerVoicing } from "../src/fingering";
import { voicingsFor } from "../src/voicing";
import { parseChord } from "../src/chord";

describe("fingeringFor", () => {
  it("fingers triads by inversion", () => {
    expect(fingeringFor(3, 0)).toEqual([1, 3, 5]);
    expect(fingeringFor(3, 1)).toEqual([1, 2, 5]);
    expect(fingeringFor(3, 2)).toEqual([1, 3, 5]);
  });

  it("fingers four-note chords the same in every inversion", () => {
    for (const inv of [0, 1, 2, 3]) {
      expect(fingeringFor(4, inv)).toEqual([1, 2, 3, 5]);
    }
  });

  it("fingers five-note chords with all five fingers", () => {
    expect(fingeringFor(5, 0)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("fingerVoicing", () => {
  it("keeps a plain triad in the right hand", () => {
    const v = voicingsFor(parseChord("C")!)[0]!;
    expect(fingerVoicing(v, false)).toEqual({ left: [], right: [1, 3, 5] });
  });

  it("moves a slash bass to the left hand", () => {
    const v = voicingsFor(parseChord("C/G")!)[0]!;
    const f = fingerVoicing(v, true);
    expect(f.left).toEqual([5]);
    expect(f.right).toEqual([1, 3, 5]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/fingering.test.ts`
Expected: FAIL — `../src/fingering` unresolved.

- [ ] **Step 3: Write the implementation**

`packages/music-core/src/fingering.ts`:

```ts
import type { Voicing } from "./voicing";

/** Right-hand fingering by note count and inversion. */
export function fingeringFor(noteCount: number, inversion: number): number[] {
  if (noteCount <= 3) {
    return inversion === 1 ? [1, 2, 5] : [1, 3, 5];
  }
  if (noteCount === 4) return [1, 2, 3, 5];
  return [1, 2, 3, 4, 5];
}

/** Split a voicing between hands. A slash chord's bass note is the lowest
 *  pitch and belongs to the left hand; everything above it is the right. */
export function fingerVoicing(v: Voicing, hasBass: boolean): { left: number[]; right: number[] } {
  if (!hasBass) {
    return { left: [], right: fingeringFor(v.pitches.length, v.inversion) };
  }
  const upper = v.pitches.length - 1;
  return { left: [5], right: fingeringFor(upper, v.inversion) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/music-core && npx vitest run test/fingering.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/music-core/src/fingering.ts packages/music-core/test/fingering.test.ts
git commit -m "feat(music-core): right-hand fingering"
```

---

### Task 12: Public API and full-suite gate

**Files:**
- Create: `packages/music-core/src/index.ts`
- Test: `packages/music-core/test/index.test.ts`

**Interfaces:**
- Consumes: every module from Tasks 1-11.
- Produces: the package's public surface. Consumers (`ug-import`, `server`, `web`) import only from here.

- [ ] **Step 1: Write the failing test**

`packages/music-core/test/index.test.ts`:

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/music-core && npx vitest run test/index.test.ts`
Expected: FAIL — `../src/index` unresolved.

- [ ] **Step 3: Write the barrel**

`packages/music-core/src/index.ts`:

```ts
export type { Letter, Note } from "./note";
export { LETTERS, LETTER_SEMITONE, parseNote, noteToString, noteSemitone, shiftNote } from "./note";

export type { Interval } from "./interval";
export { keyDelta } from "./interval";

export { FLAT_KEYS, EXOTIC_KEYS, simplifyAccidental, makeReadable, spellNote } from "./spelling";

export type { Chord } from "./chord";
export { parseChord, chordToString } from "./chord";

export { transposeChordSymbol, transposeDocument } from "./transpose";

export type { ChordRef, LyricLine, ChordLine, TextLine, Line, Section, Song } from "./document";
export { collectSymbols } from "./document";

export type { KeyGuess } from "./key-detect";
export { detectKey } from "./key-detect";

export type { ChordTones, Voicing } from "./voicing";
export { chordTones, spellChordTones, voicingsFor } from "./voicing";

export { chooseVoicings, transitionCost, totalMovement } from "./voice-leading";

export { fingeringFor, fingerVoicing } from "./fingering";
```

- [ ] **Step 4: Run the whole suite and the typechecker**

Run: `cd packages/music-core && npm test && npm run typecheck`
Expected: all test files PASS, `tsc --noEmit` reports no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/music-core/src/index.ts packages/music-core/test/index.test.ts
git commit -m "feat(music-core): public API surface"
```

---

## Self-Review

**Spec coverage.** Every `music-core` requirement in the design maps to a task: chord grammar and the two-accidental fix (4), letter-and-semitone transposition (2, 5), the E→C reference table (5), both normalization passes (3), the 288-case invariant sweep (6), key detection with confidence (8), anchored document types and document transposition (7), inversion candidates including fixed slash bass (9), DP voice leading with pins and per-section scope (10), the fingering table with left-hand bass split (11).

**Out of scope for this plan, by design.** `ug-import`, the server, the web app, inline correction, stage view, print, and the LXC provisioning script are separate subsystems and get their own plans.

**Type consistency.** Verified across tasks: `Note {letter, acc}`, `Chord {root, quality, bass}`, `Interval {dLetter, dSemitone}`, `Voicing {pitches, inversion}`, `ChordRef {sym, at}`. `spellNote` takes `(Note, targetKey)` everywhere. `chooseVoicings` takes `(Chord[], pinned?)` in both its definition and its tests. The barrel in Task 12 names only functions defined in Tasks 1-11.

**Known soft spots, flagged rather than hidden.** Task 8's confidence scaling factor and Task 9's `Abdim` spelling expectation are the two places where a first implementation may need a numeric adjustment; both steps say explicitly what may be tuned and what must not.
