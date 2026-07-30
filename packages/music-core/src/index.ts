export type { Letter, Note } from "./note";
export { LETTERS, LETTER_SEMITONE, parseNote, noteToString, noteSemitone, shiftNote } from "./note";

export type { Interval } from "./interval";
export { keyDelta } from "./interval";

export { FLAT_KEYS, EXOTIC_KEYS, simplifyAccidental, makeReadable, spellNote } from "./spelling";

export type { Chord } from "./chord";
export { parseChord, chordToString } from "./chord";

export { transposeChordSymbol, transposeDocument } from "./transpose";

export type { ChordRef, LyricLine, ChordLine, TextLine, Line, Section, Song } from "./document";
export { collectSymbols } from "./document";

export type { KeyGuess } from "./key-detect";
export { detectKey } from "./key-detect";

export type { ChordTones, Voicing } from "./voicing";
export { chordTones, spellChordTones, voicingsFor } from "./voicing";

export { chooseVoicings, transitionCost, totalMovement } from "./voice-leading";

export { fingeringFor, fingerVoicing } from "./fingering";
