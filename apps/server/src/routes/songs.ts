import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { parseNote } from "@baritonic/music-core";
import { importFromText, importFromUrl, type FetchLike } from "@baritonic/ug-import";
import { applyOverrides } from "../overlay.ts";
import { HttpError } from "../http-errors.ts";
import { createOverrideRepo } from "../repo/overrides.ts";
import { createSongRepo, type SongUpdate } from "../repo/songs.ts";

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(400, "Song id must be a positive integer");
  }
  return id;
}

function validKey(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || parseNote(value) === null) {
    throw new HttpError(400, `Not a valid key name: ${String(value)}`);
  }
  return value;
}

export function createSongRoutes(deps: { db: DatabaseSync; fetchImpl?: FetchLike }): Router {
  const router = Router();
  const songs = createSongRepo(deps.db);
  const overrides = createOverrideRepo(deps.db);

  router.get("/", (_req, res) => {
    res.json(songs.list());
  });

  router.post("/", (req, res, next) => {
    void (async () => {
      try {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const url = typeof body.url === "string" ? body.url.trim() : "";
        const rawBody = typeof body.rawBody === "string" ? body.rawBody : "";

        if (url === "" && rawBody.trim() === "") {
          throw new HttpError(400, "Provide either a url or rawBody");
        }

        if (url !== "") {
          if (songs.findBySourceUrl(url)) {
            throw new HttpError(409, "That tab has already been imported");
          }
          const result = await importFromUrl(url, deps.fetchImpl);
          const id = songs.insert(result, url);
          res.status(201).json(songs.get(id));
          return;
        }

        const result = importFromText({
          artist: typeof body.artist === "string" ? body.artist : "",
          title: typeof body.title === "string" ? body.title : "",
          body: rawBody,
        });
        const id = songs.insert(result, null);
        res.status(201).json(songs.get(id));
      } catch (e) {
        next(e);
      }
    })();
  });

  router.get("/:id", (req, res) => {
    const id = parseId(req.params.id);
    const song = songs.get(id);
    if (!song) throw new HttpError(404, "Song not found");

    const stored = overrides.listForSong(id);
    const overlay = applyOverrides(song.document, stored);
    res.json({
      ...song,
      document: overlay.document,
      // The raw list, so the client can recover a position's original
      // symbol after a correction has been applied over it. Without this,
      // re-correcting a chord would send the visible symbol as originalSym
      // and orphan its own override on the next load.
      overrides: stored,
      inversions: overlay.inversions,
      orphanedOverrides: overlay.orphaned,
    });
  });

  router.patch("/:id", (req, res) => {
    const id = parseId(req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: SongUpdate = {};

    if (body.artist !== undefined) {
      if (typeof body.artist !== "string" || body.artist.trim() === "") {
        throw new HttpError(400, "artist must be a non-empty string");
      }
      patch.artist = body.artist.trim();
    }
    if (body.title !== undefined) {
      if (typeof body.title !== "string" || body.title.trim() === "") {
        throw new HttpError(400, "title must be a non-empty string");
      }
      patch.title = body.title.trim();
    }
    if (body.keyOverride !== undefined) patch.keyOverride = validKey(body.keyOverride);
    if (body.preferredKey !== undefined) patch.preferredKey = validKey(body.preferredKey);

    if (!songs.get(id)) throw new HttpError(404, "Song not found");
    songs.update(id, patch);
    res.json(songs.get(id));
  });

  router.delete("/:id", (req, res) => {
    const id = parseId(req.params.id);
    if (!songs.remove(id)) throw new HttpError(404, "Song not found");
    res.status(204).end();
  });

  return router;
}
