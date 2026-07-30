import type { Voicing } from "@baritonic/music-core";
import { layoutKeyboard, type KeyShape } from "../music/keyboard.ts";

export interface PianoDiagramProps {
  symbol: string;
  voicing: Voicing;
  fingers: { left: number[]; right: number[] };
  tones: string[];
}

export function PianoDiagram({ symbol, voicing, fingers, tones }: PianoDiagramProps) {
  const layout = layoutKeyboard(voicing, fingers);
  const whites = layout.keys.filter((k) => k.white);
  const blacks = layout.keys.filter((k) => !k.white);

  const keyRect = (k: KeyShape) => {
    const classes = ["key", k.white ? "white" : "black"];
    if (k.finger !== null) classes.push("lit");
    if (k.isBass) classes.push("bass");
    return (
      <rect
        key={k.semitone}
        className={classes.join(" ")}
        x={k.x}
        y={0}
        width={k.width}
        height={k.height}
        rx={1.5}
      />
    );
  };

  const label = (k: KeyShape) =>
    k.finger === null ? null : (
      <text
        key={`f${k.semitone}`}
        x={k.x + k.width / 2}
        y={k.height - (k.white ? 7 : 5)}
        textAnchor="middle"
        className="finger"
      >
        {k.finger}
      </text>
    );

  return (
    <figure className="pd">
      <figcaption className="pd-name">{symbol}</figcaption>
      <svg
        viewBox={`-1 -1 ${layout.width + 2} ${layout.height + 2}`}
        role="img"
        aria-label={`${symbol}: ${tones.join(", ")}`}
      >
        {whites.map(keyRect)}
        {blacks.map(keyRect)}
        {whites.map(label)}
        {blacks.map(label)}
      </svg>
      <div className="pd-tones">{tones.join(" · ")}</div>
    </figure>
  );
}
