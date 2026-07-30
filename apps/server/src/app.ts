import express, { type Express, type NextFunction, type Request, type Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import type { FetchLike } from "@music-ui/ug-import";
import { HttpError, toHttpError } from "./http-errors";

export interface AppDeps {
  db: DatabaseSync;
  /** Injected so tests never reach the network. */
  fetchImpl?: FetchLike;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Routes are mounted here by later tasks.

  app.use("/api", (_req, _res, next) => {
    next(new HttpError(404, "Not found"));
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // express.json throws a SyntaxError with a body property for malformed input.
    if (err instanceof SyntaxError && "body" in err) {
      res.status(400).json({ error: "Request body is not valid JSON" });
      return;
    }
    const httpErr = toHttpError(err);
    res.status(httpErr.status).json({ error: httpErr.message, detail: httpErr.detail });
  });

  void deps;
  return app;
}
