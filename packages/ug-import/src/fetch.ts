import { ImportError } from "./errors.ts";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const ALLOWED_HOSTS = new Set(["tabs.ultimate-guitar.com", "www.ultimate-guitar.com"]);

/** Markers of an interstitial served with a 200. */
const CHALLENGE_MARKERS = [
  "checking your browser",
  "cf-browser-verification",
  "just a moment",
  "enable javascript and cookies",
];

/** The only function in this package that performs I/O. `doFetch` is a
 *  parameter so every other stage — and every test — runs offline. */
export async function fetchPage(url: string, doFetch: FetchLike = fetch): Promise<string> {
  let host: string;
  try {
    host = new URL(url).host;
  } catch {
    throw new ImportError({ kind: "network", message: `not a valid URL: ${url}` });
  }
  if (!ALLOWED_HOSTS.has(host)) {
    throw new ImportError({
      kind: "network",
      message: `refusing to fetch from ${host}; expected an ultimate-guitar.com URL`,
    });
  }

  let res: Response;
  try {
    res = await doFetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      redirect: "follow",
    });
  } catch (e) {
    throw new ImportError({
      kind: "network",
      message: e instanceof Error ? e.message : String(e),
    });
  }

  if (res.status === 403 || res.status === 429 || res.status === 503) {
    throw new ImportError({
      kind: "challenge",
      status: res.status,
      message: `HTTP ${res.status}`,
    });
  }
  if (!res.ok) {
    throw new ImportError({ kind: "network", message: `HTTP ${res.status}` });
  }

  const html = await res.text();
  const lower = html.slice(0, 4000).toLowerCase();
  if (CHALLENGE_MARKERS.some((m) => lower.includes(m))) {
    throw new ImportError({
      kind: "challenge",
      status: res.status,
      message: "interstitial page served",
    });
  }

  return html;
}
