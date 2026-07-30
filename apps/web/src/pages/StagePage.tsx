import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { transposeDocument } from "@music-ui/music-core";
import { api } from "../api/client.ts";
import type { SongDetail } from "../api/types.ts";
import { ChordChart } from "../components/ChordChart.tsx";
import { useAutoScroll } from "../stage/useAutoScroll.ts";
import { useWakeLock } from "../stage/useWakeLock.ts";
import {
  DEFAULT_FONT_INDEX,
  DEFAULT_SPEED_INDEX,
  FONT_STEPS,
  SPEED_STEPS,
} from "../stage/scroll.ts";

export function StagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const songId = Number(id);

  const [song, setSong] = useState<SongDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [fontIndex, setFontIndex] = useState(DEFAULT_FONT_INDEX);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getSong(songId)
      .then((s) => {
        if (live) setSong(s);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Could not load this song");
      });
    return () => {
      live = false;
    };
  }, [songId]);

  const leave = useCallback(() => navigate(`/songs/${songId}`), [navigate, songId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
      if (e.key === " ") {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  const writtenKey = song?.keyOverride ?? song?.detectedKey ?? "C";
  const targetKey = song?.preferredKey ?? writtenKey;

  const transposed = useMemo(() => {
    if (!song) return null;
    return transposeDocument(song.document, writtenKey, targetKey);
  }, [song, writtenKey, targetKey]);

  const onReachEnd = useCallback(() => setRunning(false), []);
  useAutoScroll(scrollRef, { speed: SPEED_STEPS[speedIndex] ?? 30, running, onReachEnd });
  useWakeLock(running);

  if (error) return <p className="notice">{error}</p>;
  if (!song || !transposed) return <p className="muted">Loading…</p>;

  const scale = FONT_STEPS[fontIndex] ?? 1;

  return (
    <div className="stage" style={{ ["--stage-scale" as string]: String(scale) }}>
      <div className="stage-scroll" ref={scrollRef}>
        <header className="stage-head">
          <h1>{song.title}</h1>
          <p>
            {song.artist} · {targetKey}
          </p>
        </header>
        {/* No onChordClick: nothing is editable mid-performance. */}
        <ChordChart document={transposed} />
        <div className="stage-tail" />
      </div>

      <div className={running ? "stage-bar dim" : "stage-bar"}>
        <button type="button" className="btn pri" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Play"}
        </button>

        <label className="klabel" htmlFor="speed">
          Speed
        </label>
        <input
          id="speed"
          type="range"
          min={0}
          max={SPEED_STEPS.length - 1}
          value={speedIndex}
          aria-label="Scroll speed"
          onChange={(e) => setSpeedIndex(Number(e.target.value))}
        />

        <button
          type="button"
          className="btn"
          aria-label="Smaller type"
          onClick={() => setFontIndex((i) => Math.max(0, i - 1))}
        >
          A−
        </button>
        <button
          type="button"
          className="btn"
          aria-label="Larger type"
          onClick={() => setFontIndex((i) => Math.min(FONT_STEPS.length - 1, i + 1))}
        >
          A+
        </button>

        <button type="button" className="btn" onClick={leave}>
          Exit
        </button>
      </div>
    </div>
  );
}
