export type { Letter, Note } from "./note.ts";
export { LETTERS, LETTER_SEMITONE, parseNote, noteToString, noteSemitone, shiftNote } from "./note.ts";

export type { Interval } from "./interval.ts";
export { keyDelta } from "./interval.ts";

export { FLAT_KEYS, EXOTIC_KEYS, simplifyAccidental, makeReadable, spellNote } from "./spelling.ts";

export type { Chord } from "./chord.ts";
export { parseChord, chordToString } from "./chord.ts";

export { transposeChordSymbol, transposeDocument } from "./transpose.ts";

export type { ChordRef, LyricLine, ChordLine, TextLine, Line, Section, Song } from "./document.ts";
export { collectSymbols } from "./document.ts";

export type { KeyGuess } from "./key-detect.ts";
export { detectKey } from "./key-detect.ts";

export type { ChordTones, Voicing } from "./voicing.ts";
export { chordTones, spellChordTones, voicingsFor } from "./voicing.ts";

export { chooseVoicings, transitionCost, totalMovement } from "./voice-leading.ts";

export { fingeringFor, fingerVoicing } from "./fingering.ts";
