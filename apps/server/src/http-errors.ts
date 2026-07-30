import { ImportError, describeFailure, type ImportFailure } from "@baritonic/ug-import";

export class HttpError extends Error {
  // Declared explicitly rather than as constructor parameter properties:
  // Node's --experimental-strip-types rejects those, since they emit
  // runtime code rather than only types.
  readonly status: number;
  readonly detail?: unknown;

  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.detail = detail;
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
