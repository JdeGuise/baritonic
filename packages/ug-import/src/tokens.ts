export interface ChordToken {
  sym: string;
  /** Column in the line as it renders with the markup removed. */
  column: number;
}

const CH_RE = /\[ch\]([\s\S]*?)\[\/ch\]/g;

/** [tab] and [/tab] only preserve monospace alignment; the anchor model
 *  makes them redundant. */
export function stripTabWrappers(body: string): string {
  return body.replace(/\[\/?tab\]/g, "");
}

export function hasChordTags(line: string): boolean {
  return /\[ch\]/.test(line);
}

/** Rebuild the line without markup, recording where each chord lands in
 *  the rebuilt text. */
export function scanChordLine(line: string): { text: string; chords: ChordToken[] } {
  const chords: ChordToken[] = [];
  let text = "";
  let last = 0;

  CH_RE.lastIndex = 0;
  for (let m = CH_RE.exec(line); m !== null; m = CH_RE.exec(line)) {
    text += line.slice(last, m.index);
    const sym = m[1]!.trim();
    chords.push({ sym, column: text.length });
    text += sym;
    last = m.index + m[0].length;
  }
  text += line.slice(last);

  return { text, chords };
}

const HEADER_RE = /^\[([^\][]+)\]$/;
const MARKUP = new Set(["ch", "/ch", "tab", "/tab"]);

/** A bare bracketed word on its own line is a section label. The markup
 *  tags are the only bracketed tokens that are not. */
export function isSectionHeader(line: string): string | null {
  const m = HEADER_RE.exec(line.trim());
  if (!m?.[1]) return null;
  const label = m[1].trim();
  if (MARKUP.has(label.toLowerCase())) return null;
  return label;
}
