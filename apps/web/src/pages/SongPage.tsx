import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  chooseVoicings,
  collectSymbols,
  fingerVoicing,
  keyDelta,
  noteToString,
  parseChord,
  spellChordTones,
  transposeDocument,
  type Chord,
  type Song,
} from "@baritonic/music-core";
import { api } from "../api/client.ts";
import type { ChordPosition, SongDetail } from "../api/types.ts";
import { ChordChart } from "../components/ChordChart.tsx";
import { ChordEditor } from "../components/ChordEditor.tsx";
import { PianoDiagram } from "../components/PianoDiagram.tsx";
import { KeySelector } from "../components/KeySelector.tsx";
import { findOverride, originalSymAt } from "../music/editing.ts";

const LOW_CONFIDENCE = 0.6;

/** The symbol as it currently appears on screen, in the target key. */
function displayedSymbolAt(doc: Song, at: ChordPosition): string | null {
  const line = doc.sections[at.sectionIdx]?.lines[at.lineIdx];
  if (!line || line.kind === "text") return null;
  return line.chords[at.chordIdx]?.sym ?? null;
}

export function SongPage() {
  const { id } = useParams();
  const songId = Number(id);

  const [song, setSong] = useState<SongDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ChordPosition | null>(null);
  const [printDiagrams, setPrintDiagrams] = useState(true);

  const load = useCallback(async () => {
    const s = await api.getSong(songId);
    setSong(s);
    // Keep whatever key the user is currently reading in across a reload.
    setTargetKey((current) => current ?? s.preferredKey ?? s.keyOverride ?? s.detectedKey ?? "C");
  }, [songId]);

  useEffect(() => {
    let live = true;
    load().catch((e: unknown) => {
      if (live) setError(e instanceof Error ? e.message : "Could not load this song");
    });
    return () => {
      live = false;
    };
  }, [load]);

  const writtenKey = song?.keyOverride ?? song?.detectedKey ?? "C";

  // Transposition is a pure recomputation — no request is made.
  const transposed = useMemo(() => {
    if (!song || targetKey === null) return null;
    return transposeDocument(song.document, writtenKey, targetKey);
  }, [song, writtenKey, targetKey]);

  const distance = useMemo(() => {
    if (targetKey === null) return 0;
    return keyDelta(writtenKey, targetKey).dSemitone;
  }, [writtenKey, targetKey]);

  const diagrams = useMemo(() => {
    if (!transposed || targetKey === null) return [];

    const seen = new Set<string>();
    const distinct: Chord[] = [];
    const symbols: string[] = [];
    for (const sym of collectSymbols(transposed)) {
      if (seen.has(sym)) continue;
      const chord = parseChord(sym);
      if (!chord) continue;
      seen.add(sym);
      distinct.push(chord);
      symbols.push(sym);
    }

    // Voice-led across the distinct set so the strip reads as a hand
    // moving rather than a list of unrelated shapes.
    const voicings = chooseVoicings(distinct);
    return symbols.map((symbol, i) => {
      const chord = distinct[i]!;
      const voicing = voicings[i]!;
      return {
        symbol,
        voicing,
        fingers: fingerVoicing(voicing, chord.bass !== null),
        tones: spellChordTones(chord, targetKey).map(noteToString),
      };
    });
  }, [transposed, targetKey]);

  const savePreferred = async () => {
    if (!song || targetKey === null) return;
    setSaving(true);
    try {
      const updated = await api.updateSong(song.id, { preferredKey: targetKey });
      setSong({ ...song, preferredKey: updated.preferredKey ?? targetKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the key");
    } finally {
      setSaving(false);
    }
  };

  const saveOverride = async (
    at: ChordPosition,
    value: { correctedSym: string | null; inversion: number | null },
  ) => {
    if (!song) return;
    // The server compares against the unmodified document, so this must be
    // the raw parsed symbol — not whatever is currently on screen.
    const originalSym = originalSymAt(song.overrides, song.document, at);
    if (originalSym === null) return;

    setEditing(null);
    try {
      await api.putOverride(song.id, at, { originalSym, ...value });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save that change");
    }
  };

  const removeOverride = async (at: ChordPosition) => {
    if (!song) return;
    setEditing(null);
    try {
      await api.deleteOverride(song.id, at);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove that change");
    }
  };

  const correctWritten = async (key: string) => {
    if (!song) return;
    try {
      const updated = await api.updateSong(song.id, { keyOverride: key });
      setSong({ ...song, keyOverride: updated.keyOverride ?? key });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the key");
    }
  };

  if (error) return <p className="notice">{error}</p>;
  if (!song || !transposed || targetKey === null) return <p className="muted">Loading…</p>;

  const lowConfidence =
    song.keyOverride === null &&
    song.detectedKeyConfidence !== null &&
    song.detectedKeyConfidence < LOW_CONFIDENCE;

  const orphanCount = song.orphanedOverrides.length;

  return (
    <div className={printDiagrams ? "stack" : "stack print-no-diagrams"}>
      {/* The chart bar is hidden on paper, so the key has to appear here. */}
      <div className="print-only print-head">
        {song.artist} — {song.title} · {targetKey}
      </div>

      <header>
        <h1 className="song-title">{song.title}</h1>
        <p className="muted">{song.artist}</p>
      </header>

      {orphanCount > 0 && (
        <div className="notice stack">
          <span>
            {orphanCount} saved correction{orphanCount === 1 ? "" : "s"} no longer match this chart
            and {orphanCount === 1 ? "was" : "were"} not applied.
          </span>
          {song.orphanedOverrides.map((o, i) => (
            <div className="row" key={i}>
              <code>
                {o.override.originalSym} → {o.override.correctedSym ?? "(inversion only)"}
              </code>
              <span className="muted">
                {o.reason === "symbol-changed"
                  ? `now reads ${o.foundSym}`
                  : "position no longer exists"}
              </span>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  void removeOverride({
                    sectionIdx: o.override.sectionIdx,
                    lineIdx: o.override.lineIdx,
                    chordIdx: o.override.chordIdx,
                  })
                }
              >
                Discard
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="chartbar">
        <KeySelector
          id="written"
          label="Written in"
          value={writtenKey}
          onChange={(k) => void correctWritten(k)}
        />
        {lowConfidence ? (
          <span className="chip low">unsure</span>
        ) : (
          <span className="chip ok">detected</span>
        )}

        <KeySelector
          id="target"
          label="Play in"
          value={targetKey}
          onChange={setTargetKey}
          emphasis
        />
        <span className="steps">
          {distance === 0
            ? "same key"
            : `${distance > 0 ? "+" : ""}${distance} semitone${Math.abs(distance) === 1 ? "" : "s"}`}
        </span>

        <button type="button" className="btn" onClick={() => void savePreferred()} disabled={saving}>
          {song.preferredKey === targetKey ? "Saved" : "Save as my key"}
        </button>

        <Link to={`/songs/${song.id}/stage`} className="btn no-print">
          Stage
        </Link>
        <button type="button" className="btn no-print" onClick={() => window.print()}>
          Print
        </button>
        <label className="klabel no-print">
          <input
            type="checkbox"
            checked={printDiagrams}
            aria-label="Diagrams on paper"
            onChange={(e) => setPrintDiagrams(e.target.checked)}
          />{" "}
          Diagrams on paper
        </label>
      </div>

      <ChordChart
        document={transposed}
        onChordClick={setEditing}
        pinnedPositions={song.overrides}
      />

      {editing && (
        <ChordEditor
          symbol={displayedSymbolAt(transposed, editing) ?? ""}
          targetKey={targetKey}
          writtenKey={writtenKey}
          inversion={findOverride(song.overrides, editing)?.inversion ?? null}
          hasOverride={findOverride(song.overrides, editing) !== undefined}
          onSave={(value) => void saveOverride(editing, value)}
          onRemove={() => void removeOverride(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="stack">
        <div className="eyebrow">Chords in this song</div>
        <div className="pianos">
          {diagrams.map((d) => (
            <PianoDiagram
              key={d.symbol}
              symbol={d.symbol}
              voicing={d.voicing}
              fingers={d.fingers}
              tones={d.tones}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
