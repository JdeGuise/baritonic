import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.ts";
import type { SongSummary } from "../api/types.ts";

const LOW_CONFIDENCE = 0.6;

function confidenceClass(s: SongSummary): string {
  const low = s.detectedKeyConfidence !== null && s.detectedKeyConfidence < LOW_CONFIDENCE;
  return low ? "chip low" : "chip key";
}

export function LibraryPage() {
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let live = true;
    api
      .listSongs()
      .then((rows) => {
        if (live) setSongs(rows);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Could not load the library");
      });
    return () => {
      live = false;
    };
  }, []);

  const visible = useMemo(() => {
    if (!songs) return [];
    const q = query.trim().toLowerCase();
    if (q === "") return songs;
    return songs.filter((s) =>
      [s.title, s.artist, s.effectiveKey ?? "", s.preferredKey ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [songs, query]);

  if (error) return <p className="notice">{error}</p>;
  if (!songs) return <p className="muted">Loading your library…</p>;

  if (songs.length === 0) {
    return (
      <div className="stack">
        <p className="muted">No songs yet.</p>
        <p>
          <Link to="/import" className="btn pri">
            Import your first song
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <input
        type="search"
        className="search"
        aria-label="Search songs"
        placeholder="Search title, artist, or key…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="lib">
        {visible.map((s) => (
          <li key={s.id} className="lib-row">
            <Link to={`/songs/${s.id}`} className="lib-title">
              <b>{s.title}</b>
              <span className="muted">{s.artist}</span>
            </Link>
            <div className="lib-keys">
              <span className={confidenceClass(s)}>{s.effectiveKey ?? "—"}</span>
              <span className="muted" aria-hidden="true">
                →
              </span>
              <span className={s.preferredKey ? "chip on" : "chip"}>{s.preferredKey ?? "—"}</span>
            </div>
          </li>
        ))}
      </ul>

      {visible.length === 0 && <p className="muted">Nothing matches “{query}”.</p>}
    </div>
  );
}
