import { ImportError } from "./errors";

const STORE_RE = /<div class="js-store" data-content="([\s\S]*?)"><\/div>/;

const ENTITIES: Record<string, string> = {
  "&quot;": '"', "&#34;": '"', "&apos;": "'", "&#39;": "'",
  "&lt;": "<", "&gt;": ">", "&amp;": "&",
};

function unescapeHtml(s: string): string {
  // &amp; must resolve last, or "&amp;quot;" would become a quote.
  return s
    .replace(/&(?:quot|#34|apos|#39|lt|gt);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Pull the embedded JSON payload out of a tab page. */
export function extractStore(html: string): unknown {
  const m = STORE_RE.exec(html);
  if (!m?.[1]) {
    throw new ImportError({ kind: "schema", message: "js-store element not found" });
  }
  try {
    return JSON.parse(unescapeHtml(m[1]));
  } catch {
    throw new ImportError({ kind: "schema", message: "js-store payload is not valid JSON" });
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Defensive accessors. The embedded schema is undocumented and changes
 *  without notice, so a missing or wrongly-typed field yields null. */
export function str(src: unknown, key: string): string | null {
  if (!isRecord(src)) return null;
  const v = src[key];
  return typeof v === "string" ? v : null;
}

export function num(src: unknown, key: string): number | null {
  if (!isRecord(src)) return null;
  const v = src[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function obj(src: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(src)) return null;
  const v = src[key];
  return isRecord(v) ? v : null;
}

export function getPageData(store: unknown): Record<string, unknown> {
  const data = obj(obj(obj(store, "store"), "page"), "data");
  if (!data) {
    throw new ImportError({ kind: "schema", message: "store.page.data not found" });
  }
  return data;
}
