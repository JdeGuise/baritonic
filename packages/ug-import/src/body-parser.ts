import { parseChord, type Line, type Section, type Song } from "@music-ui/music-core";
import { hasChordTags, isSectionHeader, scanChordLine, stripTabWrappers } from "./tokens.ts";

export function parseBody(body: string): { document: Song; unparseableChords: string[] } {
  const lines = stripTabWrappers(body).split(/\r\n|\r|\n/);

  const sections: Section[] = [];
  let current: Section = { label: "", lines: [] };
  const unparseable = new Set<string>();

  const flush = () => {
    if (current.lines.length > 0) sections.push(current);
  };

  const note = (sym: string) => {
    if (parseChord(sym) === null) unparseable.add(sym);
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;

    const label = isSectionHeader(raw);
    if (label !== null) {
      flush();
      current = { label, lines: [] };
      continue;
    }

    if (raw.trim() === "") continue;

    if (!hasChordTags(raw)) {
      current.lines.push({ kind: "text", text: raw.trim() });
      continue;
    }

    const scanned = scanChordLine(raw);
    for (const c of scanned.chords) note(c.sym);

    const next = lines[i + 1];
    const pairs =
      next !== undefined &&
      next.trim() !== "" &&
      !hasChordTags(next) &&
      isSectionHeader(next) === null;

    if (pairs) {
      const text = next!.replace(/\s+$/, "");
      const line: Line = {
        kind: "lyric",
        text,
        chords: scanned.chords.map((c) => ({
          sym: c.sym,
          at: Math.min(c.column, text.length),
        })),
      };
      current.lines.push(line);
      i += 1; // the lyric line is consumed
    } else {
      current.lines.push({
        kind: "chords",
        chords: scanned.chords.map((c) => ({ sym: c.sym, at: c.column })),
      });
    }
  }

  flush();
  return { document: { sections }, unparseableChords: [...unparseable] };
}
