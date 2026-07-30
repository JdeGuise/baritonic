import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import type { FetchLike } from "@music-ui/ug-import";
import { HttpError, toHttpError } from "./http-errors.ts";
import { createOverrideRoutes } from "./routes/overrides.ts";
import { createSongRoutes } from "./routes/songs.ts";

export interface AppDeps {
  db: DatabaseSync;
  /** Injected so tests never reach the network. */
  fetchImpl?: FetchLike;
  /** Directory of built web assets. Absent until the web app is built —
   *  the API still works without it. */
  staticDir?: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // The more specific path must mount first.
  app.use("/api/songs/:id/overrides", createOverrideRoutes({ db: deps.db }));
  app.use("/api/songs", createSongRoutes({ db: deps.db, fetchImpl: deps.fetchImpl }));

  app.use("/api", (_req, _res, next) => {
    next(new HttpError(404, "Not found"));
  });

  const staticDir = deps.staticDir;
  if (staticDir !== undefined) {
    app.use(express.static(staticDir));
    // Client-side routes resolve to index.html. /api is excluded so it
    // keeps returning JSON 404s from the handler above.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile("index.html", { root: staticDir });
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // express.json throws a SyntaxError with a body property for malformed input.
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "Request body is not valid JSON" });
      return;
    }
    const httpErr = toHttpError(err);
    res.status(httpErr.status).json({ error: httpErr.message, detail: httpErr.detail });
  });

  return app;
}
