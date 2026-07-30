import { useMemo, useState } from "react";
import {
  fingerVoicing,
  noteToString,
  parseChord,
  spellChordTones,
  voicingsFor,
} from "@music-ui/music-core";
import { toWrittenKey } from "../music/editing.ts";
import { PianoDiagram } from "./PianoDiagram.tsx";

export interface ChordEditorProps {
  /** The symbol as currently displayed, in the target key. */
  symbol: string;
  targetKey: string;
  writtenKey: string;
  inversion: number | null;
  hasOverride: boolean;
  onSave: (value: { correctedSym: string | null; inversion: number | null }) => void;
  onRemove: () => void;
  onClose: () => void;
}

const ORDINALS = ["Root position", "1st inversion", "2nd inversion", "3rd inversion", "4th inversion"];

export function ChordEditor(props: ChordEditorProps) {
  const [text, setText] = useState(props.symbol);
  const [inversion, setInversion] = useState<number | null>(props.inversion);

  const chord = useMemo(() => parseChord(text.trim()), [text]);
  const valid = chord !== null;

  // Preview the chord as typed, in the key on screen. This is where an
  // inversion visibly takes effect — the reference strip below the chart
  // is voice-led across distinct chords and ignores positional pins.
  const preview = useMemo(() => {
    if (!chord) return null;
    const candidates = voicingsFor(chord);
    const voicing = candidates.find((v) => v.inversion === (inversion ?? 0)) ?? candidates[0]!;
    return {
      voicing,
      fingers: fingerVoicing(voicing, chord.bass !== null),
      tones: spellChordTones(chord, props.targetKey).map(noteToString),
    };
  }, [chord, inversion, props.targetKey]);

  const inversionCount = chord ? voicingsFor(chord).length : 3;

  const save = () => {
    if (!valid) return;
    const trimmed = text.trim();
    const changed = trimmed !== props.symbol;
    const stored = changed ? toWrittenKey(trimmed, props.targetKey, props.writtenKey) : null;
    props.onSave({ correctedSym: stored, inversion });
  };

  return (
    <div className="editor" role="dialog" aria-label={`Edit ${props.symbol}`}>
      <div className="field">
        <label htmlFor="chord-input">Chord</label>
        <input
          id="chord-input"
          className="input"
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") props.onClose();
            if (e.key === "Enter" && valid) save();
          }}
        />
        {!valid && <span className="editor-error">Not a chord we can read</span>}
      </div>

      <div className="field">
        <label htmlFor="inversion-input">Inversion</label>
        <select
          id="inversion-input"
          className="ksel"
          value={inversion === null ? "" : String(inversion)}
          onChange={(e) => setInversion(e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">Automatic</option>
          {Array.from({ length: inversionCount }, (_, i) => (
            <option key={i} value={i}>
              {ORDINALS[i] ?? `Inversion ${i}`}
            </option>
          ))}
        </select>
      </div>

      {preview && (
        <PianoDiagram
          symbol={text.trim()}
          voicing={preview.voicing}
          fingers={preview.fingers}
          tones={preview.tones}
        />
      )}

      <div className="row">
        <button type="button" className="btn pri" onClick={save} disabled={!valid}>
          Save
        </button>
        <button type="button" className="btn" onClick={props.onClose}>
          Cancel
        </button>
        {props.hasOverride && (
          <button type="button" className="btn editor-remove" onClick={props.onRemove}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
