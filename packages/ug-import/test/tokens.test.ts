import { describe, it, expect } from "vitest";
import { stripTabWrappers, scanChordLine, isSectionHeader, hasChordTags } from "../src/tokens";

describe("stripTabWrappers", () => {
  it("removes [tab] and [/tab] without touching content", () => {
    expect(stripTabWrappers("[tab][ch]C[/ch]\nwords[/tab]")).toBe("[ch]C[/ch]\nwords");
  });

  it("leaves section headers alone", () => {
    expect(stripTabWrappers("[Intro]\n[tab]x[/tab]")).toBe("[Intro]\nx");
  });
});

describe("scanChordLine", () => {
  it("records the rendered column of each chord", () => {
    const r = scanChordLine("[ch]C[/ch]          [ch]Am[/ch]");
    expect(r.text).toBe("C          Am");
    expect(r.chords).toEqual([
      { sym: "C", column: 0 },
      { sym: "Am", column: 11 },
    ]);
  });

  it("handles leading whitespace", () => {
    const r = scanChordLine("    [ch]G[/ch]");
    expect(r.chords).toEqual([{ sym: "G", column: 4 }]);
  });

  it("handles a slash chord", () => {
    const r = scanChordLine("[ch]C#maj7/C[/ch]");
    expect(r.chords).toEqual([{ sym: "C#maj7/C", column: 0 }]);
  });

  it("returns no chords for a plain line", () => {
    const r = scanChordLine("just some words");
    expect(r.chords).toEqual([]);
    expect(r.text).toBe("just some words");
  });

  it("handles two chords with no gap", () => {
    const r = scanChordLine("[ch]C[/ch][ch]G[/ch]");
    expect(r.chords).toEqual([
      { sym: "C", column: 0 },
      { sym: "G", column: 1 },
    ]);
  });
});

describe("isSectionHeader", () => {
  it("recognizes bracketed headers", () => {
    expect(isSectionHeader("[Intro]")).toBe("Intro");
    expect(isSectionHeader("[Verse 1]")).toBe("Verse 1");
    expect(isSectionHeader("  [Chorus]  ")).toBe("Chorus");
  });

  it("does not treat markup tags as headers", () => {
    expect(isSectionHeader("[ch]C[/ch]")).toBeNull();
    expect(isSectionHeader("[tab]")).toBeNull();
    expect(isSectionHeader("[/tab]")).toBeNull();
  });

  it("does not treat lyric text as a header", () => {
    expect(isSectionHeader("words [in] brackets")).toBeNull();
    expect(isSectionHeader("")).toBeNull();
  });
});

describe("hasChordTags", () => {
  it("detects chord markup", () => {
    expect(hasChordTags("[ch]C[/ch] words")).toBe(true);
    expect(hasChordTags("plain words")).toBe(false);
  });
});
