import { ImportError } from "./errors.ts";
import { num, obj, str } from "./extract.ts";
import type { SongMeta } from "./types.ts";

export function readMeta(data: Record<string, unknown>): SongMeta {
  const tab = obj(data, "tab") ?? {};
  const view = obj(data, "tab_view") ?? {};
  const meta = obj(view, "meta") ?? {};
  const tuning = obj(meta, "tuning");
  const stats = obj(view, "stats") ?? {};

  return {
    ugTabId: num(tab, "id"),
    ugVersion: num(tab, "version"),
    artist: str(tab, "artist_name") ?? "Unknown artist",
    title: str(tab, "song_name") ?? "Untitled",
    tabType: str(tab, "type"),
    tuning: str(tuning, "value"),
    capo: num(meta, "capo"),
    rating: num(tab, "rating"),
    votes: num(tab, "votes"),
    contributor: str(tab, "username"),
    viewTotal: num(stats, "view_total"),
  };
}

export function readBody(data: Record<string, unknown>): string {
  const view = obj(data, "tab_view") ?? {};
  const wiki = obj(view, "wiki_tab");
  const content = str(wiki, "content");
  if (!content || content.trim() === "") {
    throw new ImportError({ kind: "pro-tab", message: "no tab body in payload" });
  }
  return content;
}
