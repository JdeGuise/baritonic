import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
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
} from "@music-ui/music-core";
import { api } from "../api/client.ts";
import type { SongDetail } from "../api/types.ts";
import { ChordChart } from "../components/ChordChart.tsx";
import { PianoDiagram } from "../components/PianoDiagram.tsx";
import { KeySelector } from "../components/KeySelector.tsx";

const LOW_CONFIDENCE = 0.6;

export function SongPage() {
  const { id } = useParams();
  const songId = Number(id);

  const [song, setSong] = useState<SongDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getSong(songId)
      .then((s) => {
        if (!live) return;
        setSong(s);
        setTargetKey(s.preferredKey ?? s.keyOverride ?? s.detectedKey ?? "C");
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Could not load this song");
      });
    return () => {
      live = false;
    };
  }, [songId]);

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
    <div className="stack">
      <header>
        <h1 className="song-title">{song.title}</h1>
        <p className="muted">{song.artist}</p>
      </header>

      {orphanCount > 0 && (
        <p className="notice">
          {orphanCount} saved correction{orphanCount === 1 ? "" : "s"} no longer match this chart
          and {orphanCount === 1 ? "was" : "were"} not applied.
        </p>
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
      </div>

      <ChordChart document={transposed} />

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
