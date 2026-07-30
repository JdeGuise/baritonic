import type { ChordPosition, SongDetail, SongSummary } from "./types.ts";

export class ApiError extends Error {
  // Explicit field rather than a parameter property: the workspace bans
  // those so Node's type stripping can run the sources directly.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body
        ? { "content-type": "application/json", ...init.headers }
        : init?.headers,
    });
  } catch (e) {
    throw new ApiError(0, e instanceof Error ? e.message : "Network request failed");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") message = body.error;
    } catch {
      // Body was not JSON; the generic message stands.
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const body = (value: unknown) => JSON.stringify(value);

export const api = {
  listSongs: () => request<SongSummary[]>("/api/songs"),

  getSong: (id: number) => request<SongDetail>(`/api/songs/${id}`),

  importUrl: (url: string) =>
    request<SongDetail>("/api/songs", { method: "POST", body: body({ url }) }),

  importText: (input: { artist: string; title: string; rawBody: string }) =>
    request<SongDetail>("/api/songs", { method: "POST", body: body(input) }),

  updateSong: (
    id: number,
    patch: {
      artist?: string;
      title?: string;
      keyOverride?: string | null;
      preferredKey?: string | null;
    },
  ) => request<SongDetail>(`/api/songs/${id}`, { method: "PATCH", body: body(patch) }),

  deleteSong: (id: number) => request<void>(`/api/songs/${id}`, { method: "DELETE" }),

  putOverride: (
    id: number,
    at: ChordPosition,
    value: { originalSym: string; correctedSym?: string | null; inversion?: number | null },
  ) =>
    request<void>(`/api/songs/${id}/overrides/${at.sectionIdx}/${at.lineIdx}/${at.chordIdx}`, {
      method: "PUT",
      body: body(value),
    }),

  deleteOverride: (id: number, at: ChordPosition) =>
    request<void>(`/api/songs/${id}/overrides/${at.sectionIdx}/${at.lineIdx}/${at.chordIdx}`, {
      method: "DELETE",
    }),
};
