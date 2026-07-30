import { ImportError, describeFailure, type ImportFailure } from "@music-ui/ug-import";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Import failures are the user's problem to act on, not server faults.
 *  A challenge or network failure is 502 (upstream), a Pro tab or schema
 *  drift is 422 (we reached it, we can't use it). */
export function statusForImportFailure(f: ImportFailure): number {
  switch (f.kind) {
    case "challenge":
    case "network":
      return 502;
    case "pro-tab":
    case "schema":
      return 422;
  }
}

export function toHttpError(e: unknown): HttpError {
  if (e instanceof HttpError) return e;
  if (e instanceof ImportError) {
    return new HttpError(statusForImportFailure(e.failure), describeFailure(e.failure), {
      kind: e.failure.kind,
    });
  }
  return new HttpError(500, "Internal server error");
}
