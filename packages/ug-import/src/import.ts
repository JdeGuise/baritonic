import { collectSymbols, detectKey } from "@music-ui/music-core";
import { parseBody } from "./body-parser";
import { foldCapo } from "./capo";
import { extractStore, getPageData } from "./extract";
import { fetchPage, type FetchLike } from "./fetch";
import { readBody, readMeta } from "./metadata";
import type { ImportResult, SongMeta } from "./types";

function assemble(meta: SongMeta, rawBody: string): ImportResult {
  const { document, unparseableChords } = parseBody(rawBody);
  const guess = detectKey(collectSymbols(document));
  return {
    meta,
    rawBody,
    document,
    detectedKey: foldCapo(guess.key, meta.capo),
    detectedMode: guess.mode,
    keyConfidence: guess.confidence,
    unparseableChords,
  };
}

export function importFromHtml(html: string): ImportResult {
  const data = getPageData(extractStore(html));
  return assemble(readMeta(data), readBody(data));
}

export function importFromText(input: {
  artist: string;
  title: string;
  body: string;
}): ImportResult {
  const meta: SongMeta = {
    ugTabId: null,
    ugVersion: null,
    artist: input.artist.trim() || "Unknown artist",
    title: input.title.trim() || "Untitled",
    tabType: null,
    tuning: null,
    capo: null,
    rating: null,
    votes: null,
    contributor: null,
    viewTotal: null,
  };
  return assemble(meta, input.body);
}

export async function importFromUrl(url: string, doFetch?: FetchLike): Promise<ImportResult> {
  return importFromHtml(await fetchPage(url, doFetch));
}
