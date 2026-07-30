import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.ts";

type Mode = "url" | "paste";

export function ImportPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [artist, setArtist] = useState("");
  const [title, setTitle] = useState("");
  const [rawBody, setRawBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = mode === "url" ? url.trim() !== "" : rawBody.trim() !== "";

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const song =
        mode === "url"
          ? await api.importUrl(url.trim())
          : await api.importText({ artist, title, rawBody });
      navigate(`/songs/${song.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="eyebrow">Import a song</div>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "url"}
          className="tab"
          onClick={() => setMode("url")}
        >
          From URL
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          className="tab"
          onClick={() => setMode("paste")}
        >
          Paste text
        </button>
      </div>

      {mode === "url" ? (
        <div className="field">
          <label htmlFor="url">Ultimate Guitar URL</label>
          <input
            id="url"
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tabs.ultimate-guitar.com/tab/…"
          />
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="artist">Artist</label>
            <input
              id="artist"
              className="input"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="body">Tab text</label>
            <textarea
              id="body"
              className="input"
              rows={12}
              value={rawBody}
              onChange={(e) => setRawBody(e.target.value)}
            />
          </div>
        </>
      )}

      <div className="row">
        <button type="button" className="btn pri" disabled={!ready || busy} onClick={() => void submit()}>
          {busy ? "Importing…" : "Import"}
        </button>
        <span className="muted">Fetched once, then stored locally.</span>
      </div>

      {error && <p className="notice">{error}</p>}
    </div>
  );
}
