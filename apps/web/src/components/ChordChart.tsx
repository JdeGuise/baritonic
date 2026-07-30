import { parseChord, type Line, type Song } from "@baritonic/music-core";
import type { ChordPosition } from "../api/types.ts";
import { toUnits, type ChartUnit } from "../music/units.ts";

export interface ChordChartProps {
  document: Song;
  /** When supplied, chords become buttons that report their position. */
  onChordClick?: (at: ChordPosition) => void;
  pinnedPositions?: readonly ChordPosition[];
}

const samePosition = (a: ChordPosition, b: ChordPosition) =>
  a.sectionIdx === b.sectionIdx && a.lineIdx === b.lineIdx && a.chordIdx === b.chordIdx;

/** Units carry the chord's index within the line so a click can be traced
 *  back to a document position. When several chords share one anchor only
 *  the first is addressable. */
interface PositionedUnit extends ChartUnit {
  firstChordIdx: number | null;
}

function positionUnits(units: ChartUnit[]): PositionedUnit[] {
  let idx = 0;
  return units.map((u) => {
    const firstChordIdx = u.chords.length > 0 ? idx : null;
    idx += u.chords.length;
    return { ...u, firstChordIdx };
  });
}

function ChartLine({
  line,
  sectionIdx,
  lineIdx,
  onChordClick,
  pinnedPositions,
}: {
  line: Line;
  sectionIdx: number;
  lineIdx: number;
  onChordClick?: (at: ChordPosition) => void;
  pinnedPositions?: readonly ChordPosition[];
}) {
  if (line.kind === "text") return <p className="chart-note">{line.text}</p>;

  const base: ChartUnit[] =
    line.kind === "lyric"
      ? toUnits(line.text, line.chords)
      : line.chords.map((c) => ({ chords: [c.sym], text: "" }));
  const units = positionUnits(base);

  return (
    <div className={line.kind === "lyric" ? "chart-line" : "chart-line instrumental"}>
      {units.map((unit, i) => {
        const label = unit.chords.join(" ");
        const unreadable =
          unit.chords.length > 0 && unit.chords.every((c) => parseChord(c) === null);
        const at =
          unit.firstChordIdx === null
            ? null
            : { sectionIdx, lineIdx, chordIdx: unit.firstChordIdx };
        const pinned = at !== null && (pinnedPositions ?? []).some((p) => samePosition(p, at));

        const classes = ["unit-chord"];
        if (unreadable) classes.push("unknown");
        if (pinned) classes.push("pinned");

        return (
          <span className="unit" key={i}>
            {onChordClick && at !== null ? (
              <button
                type="button"
                className={classes.join(" ")}
                onClick={() => onChordClick(at)}
                title="Edit this chord"
              >
                {label}
              </button>
            ) : (
              <span
                className={classes.join(" ")}
                title={unreadable ? "This symbol could not be read as a chord" : undefined}
              >
                {label}
              </span>
            )}
            <span className="unit-text">{unit.text}</span>
          </span>
        );
      })}
    </div>
  );
}

export function ChordChart({ document, onChordClick, pinnedPositions }: ChordChartProps) {
  return (
    <div className="chart">
      {document.sections.map((section, si) => (
        <section key={si} className="chart-section">
          {section.label !== "" && <div className="eyebrow">{section.label}</div>}
          <div className="chart-lines">
            {section.lines.map((line, li) => (
              <ChartLine
                key={li}
                line={line}
                sectionIdx={si}
                lineIdx={li}
                onChordClick={onChordClick}
                pinnedPositions={pinnedPositions}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
