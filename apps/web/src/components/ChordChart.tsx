import { parseChord, type Line, type Song } from "@music-ui/music-core";
import { toUnits, type ChartUnit } from "../music/units.ts";

function Unit({ unit }: { unit: ChartUnit }) {
  const label = unit.chords.join(" ");
  const unreadable = unit.chords.length > 0 && unit.chords.every((c) => parseChord(c) === null);
  return (
    <span className="unit">
      <span
        className={unreadable ? "unit-chord unknown" : "unit-chord"}
        title={unreadable ? "This symbol could not be read as a chord" : undefined}
      >
        {label}
      </span>
      <span className="unit-text">{unit.text}</span>
    </span>
  );
}

function ChartLine({ line }: { line: Line }) {
  if (line.kind === "text") return <p className="chart-note">{line.text}</p>;

  const units: ChartUnit[] =
    line.kind === "lyric"
      ? toUnits(line.text, line.chords)
      : line.chords.map((c) => ({ chords: [c.sym], text: "" }));

  return (
    <div className={line.kind === "lyric" ? "chart-line" : "chart-line instrumental"}>
      {units.map((unit, i) => (
        <Unit key={i} unit={unit} />
      ))}
    </div>
  );
}

export function ChordChart({ document }: { document: Song }) {
  return (
    <div className="chart">
      {document.sections.map((section, si) => (
        <section key={si} className="chart-section">
          {section.label !== "" && <div className="eyebrow">{section.label}</div>}
          <div className="chart-lines">
            {section.lines.map((line, li) => (
              <ChartLine key={li} line={line} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
