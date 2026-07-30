import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  parseChord,
  voicingsFor,
  fingerVoicing,
  spellChordTones,
  noteToString,
} from "@baritonic/music-core";
import { PianoDiagram } from "../src/components/PianoDiagram.tsx";

const renderChord = (sym: string, key = "C") => {
  const chord = parseChord(sym)!;
  const voicing = voicingsFor(chord)[0]!;
  return render(
    <PianoDiagram
      symbol={sym}
      voicing={voicing}
      fingers={fingerVoicing(voicing, chord.bass !== null)}
      tones={spellChordTones(chord, key).map(noteToString)}
    />,
  );
};

describe("PianoDiagram", () => {
  it("labels the chord", () => {
    const { getByText } = renderChord("Cmaj7");
    expect(getByText("Cmaj7")).toBeInTheDocument();
  });

  it("lists the spelled tones", () => {
    const { container } = renderChord("C");
    const tones = container.querySelector(".pd-tones")?.textContent ?? "";
    expect(tones).toContain("C");
    expect(tones).toContain("E");
    expect(tones).toContain("G");
  });

  it("draws a key per semitone and highlights the chord tones", () => {
    const { container } = renderChord("C");
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(20);
    expect(container.querySelectorAll("rect.lit")).toHaveLength(3);
  });

  it("prints a finger number on each sounding key", () => {
    const { container } = renderChord("C");
    const labels = [...container.querySelectorAll("text")].map((t) => t.textContent);
    expect(labels).toEqual(["1", "3", "5"]);
  });

  it("marks the bass key of a slash chord", () => {
    const { container } = renderChord("C/G");
    expect(container.querySelectorAll("rect.bass")).toHaveLength(1);
  });

  it("has an accessible label", () => {
    const { container } = renderChord("Cmaj7");
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toMatch(/Cmaj7/);
  });
});
