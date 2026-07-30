import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { parseChord } from "@music-ui/music-core";
import { HttpError } from "../http-errors";
import { createOverrideRepo } from "../repo/overrides";
import { createSongRepo } from "../repo/songs";

function index(raw: string | undefined, name: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new HttpError(400, `${name} must be a non-negative integer`);
  }
  return n;
}

function songId(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new HttpError(400, "Song id must be a positive integer");
  }
  return n;
}

export function createOverrideRoutes(deps: { db: DatabaseSync }): Router {
  const router = Router({ mergeParams: true });
  const songs = createSongRepo(deps.db);
  const overrides = createOverrideRepo(deps.db);

  router.put("/:sectionIdx/:lineIdx/:chordIdx", (req, res) => {
    const id = songId(req.params.id);
    if (!songs.get(id)) throw new HttpError(404, "Song not found");

    const at = {
      sectionIdx: index(req.params.sectionIdx, "sectionIdx"),
      lineIdx: index(req.params.lineIdx, "lineIdx"),
      chordIdx: index(req.params.chordIdx, "chordIdx"),
    };

    const body = (req.body ?? {}) as Record<string, unknown>;

    if (typeof body.originalSym !== "string" || body.originalSym === "") {
      throw new HttpError(400, "originalSym is required");
    }

    let correctedSym: string | null = null;
    if (body.correctedSym !== undefined && body.correctedSym !== null) {
      if (typeof body.correctedSym !== "string" || parseChord(body.correctedSym) === null) {
        throw new HttpError(400, `Not a readable chord symbol: ${String(body.correctedSym)}`);
      }
      correctedSym = body.correctedSym;
    }

    let inversion: number | null = null;
    if (body.inversion !== undefined && body.inversion !== null) {
      const n = body.inversion;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 4) {
        throw new HttpError(400, "inversion must be an integer between 0 and 4");
      }
      inversion = n;
    }

    if (correctedSym === null && inversion === null) {
      throw new HttpError(400, "Provide correctedSym, inversion, or both");
    }

    overrides.upsert(id, { ...at, originalSym: body.originalSym, correctedSym, inversion });
    res.status(204).end();
  });

  router.delete("/:sectionIdx/:lineIdx/:chordIdx", (req, res) => {
    const id = songId(req.params.id);
    if (!songs.get(id)) throw new HttpError(404, "Song not found");

    const removed = overrides.remove(id, {
      sectionIdx: index(req.params.sectionIdx, "sectionIdx"),
      lineIdx: index(req.params.lineIdx, "lineIdx"),
      chordIdx: index(req.params.chordIdx, "chordIdx"),
    });
    if (!removed) throw new HttpError(404, "No override at that position");
    res.status(204).end();
  });

  return router;
}
