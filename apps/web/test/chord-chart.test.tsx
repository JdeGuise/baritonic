import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Song } from "@music-ui/music-core";
import { transposeDocument } from "@music-ui/music-core";
import { ChordChart } from "../src/components/ChordChart.tsx";

const doc: Song = {
  sections: [
    {
      label: "Verse",
      lines: [
        {
          kind: "lyric",
          text: "placeholder words here",
          chords: [
            { sym: "E", at: 0 },
            { sym: "C#m", at: 12 },
          ],
        },
        { kind: "text", text: "a performance note" },
      ],
    },
    {
      label: "Intro",
      lines: [
        {
          kind: "chords",
          chords: [
            { sym: "E", at: 0 },
            { sym: "B", at: 4 },
          ],
        },
      ],
    },
  ],
};

const pairs = (container: HTMLElement) =>
  [...container.querySelectorAll(".unit")].map((u) => ({
    chord: u.querySelector(".unit-chord")?.textContent ?? "",
    text: u.querySelector(".unit-text")?.textContent ?? "",
  }));

describe("ChordChart", () => {
  it("renders section labels", () => {
    render(<ChordChart document={doc} />);
    expect(screen.getByText("Verse")).toBeInTheDocument();
    expect(screen.getByText("Intro")).toBeInTheDocument();
  });

  it("renders lyrics and their chords", () => {
    const { container } = render(<ChordChart document={doc} />);
    expect(pairs(container)).toEqual([
      { chord: "E", text: "placeholder " },
      { chord: "C#m", text: "words here" },
      { chord: "E", text: "" },
      { chord: "B", text: "" },
    ]);
  });

  it("renders performance notes as text", () => {
    render(<ChordChart document={doc} />);
    expect(screen.getByText("a performance note")).toBeInTheDocument();
  });

  it("keeps every chord over the same lyric fragment after transposition", () => {
    const before = render(<ChordChart document={doc} />);
    const beforePairs = pairs(before.container);
    before.unmount();

    const after = render(<ChordChart document={transposeDocument(doc, "E", "C")} />);
    const afterPairs = pairs(after.container);

    // Symbols change; the text each one sits above does not.
    expect(afterPairs.map((p) => p.text)).toEqual(beforePairs.map((p) => p.text));
    expect(afterPairs.map((p) => p.chord)).toEqual(["C", "Am", "C", "G"]);
  });

  it("holds alignment when a symbol grows in width", () => {
    const narrow: Song = {
      sections: [
        {
          label: "V",
          lines: [
            {
              kind: "lyric",
              text: "short words",
              chords: [
                { sym: "E", at: 0 },
                { sym: "B", at: 6 },
              ],
            },
          ],
        },
      ],
    };
    const { container } = render(<ChordChart document={transposeDocument(narrow, "E", "Db")} />);
    // E -> Db and B -> Ab: both symbols widen, anchors must not move.
    expect(pairs(container).map((p) => p.text)).toEqual(["short ", "words"]);
  });

  it("marks an unreadable chord symbol", () => {
    const odd: Song = {
      sections: [{ label: "V", lines: [{ kind: "chords", chords: [{ sym: "N.C.", at: 0 }] }] }],
    };
    const { container } = render(<ChordChart document={odd} />);
    expect(container.querySelector(".unit-chord.unknown")).toBeTruthy();
  });

  it("renders an empty document without crashing", () => {
    const { container } = render(<ChordChart document={{ sections: [] }} />);
    expect(container.querySelectorAll(".unit")).toHaveLength(0);
  });
});

describe("ChordChart editing affordances", () => {
  it("renders plain spans when no handler is given", () => {
    const { container } = render(<ChordChart document={doc} />);
    expect(container.querySelectorAll("button.unit-chord")).toHaveLength(0);
  });

  it("renders chords as buttons when a handler is given", () => {
    const { container } = render(<ChordChart document={doc} onChordClick={() => {}} />);
    expect(container.querySelectorAll("button.unit-chord").length).toBeGreaterThan(0);
  });

  it("reports the position of the clicked chord", () => {
    const onChordClick = vi.fn();
    render(<ChordChart document={doc} onChordClick={onChordClick} />);
    fireEvent.click(screen.getAllByRole("button", { name: "C#m" })[0]!);
    expect(onChordClick).toHaveBeenCalledWith({ sectionIdx: 0, lineIdx: 0, chordIdx: 1 });
  });

  it("reports positions on instrumental lines too", () => {
    const onChordClick = vi.fn();
    render(<ChordChart document={doc} onChordClick={onChordClick} />);
    fireEvent.click(screen.getAllByRole("button", { name: "B" })[0]!);
    expect(onChordClick).toHaveBeenCalledWith({ sectionIdx: 1, lineIdx: 0, chordIdx: 1 });
  });

  it("marks pinned positions", () => {
    const { container } = render(
      <ChordChart
        document={doc}
        onChordClick={() => {}}
        pinnedPositions={[{ sectionIdx: 0, lineIdx: 0, chordIdx: 0 }]}
      />,
    );
    expect(container.querySelectorAll(".unit-chord.pinned")).toHaveLength(1);
  });

  it("does not mark anything when nothing is pinned", () => {
    const { container } = render(<ChordChart document={doc} onChordClick={() => {}} />);
    expect(container.querySelectorAll(".unit-chord.pinned")).toHaveLength(0);
  });
});
