/** Auto-scroll speeds in pixels per second.
 *
 *  Chord tabs carry no reliable tempo, so this is set by feel. A short
 *  ladder of good values beats a continuous slider nobody can aim. */
export const SPEED_STEPS = [10, 20, 30, 45, 60, 90, 120] as const;
export const DEFAULT_SPEED_INDEX = 2;

/** Type scale multipliers for the stage view. */
export const FONT_STEPS = [1, 1.25, 1.5, 1.85, 2.25, 2.75] as const;
export const DEFAULT_FONT_INDEX = 2;

/** The next scroll position after `deltaMs` at `speedPxPerSec`.
 *
 *  Fractional progress is deliberately preserved: at the slowest speed a
 *  60fps frame advances well under a pixel, and rounding each frame would
 *  stall the scroll entirely. */
export function advance(
  position: number,
  speedPxPerSec: number,
  deltaMs: number,
  maxScroll: number,
): number {
  const limit = Math.max(maxScroll, 0);
  if (speedPxPerSec <= 0 || deltaMs <= 0) {
    return Math.min(Math.max(position, 0), limit);
  }
  const next = position + (speedPxPerSec * deltaMs) / 1000;
  return Math.min(Math.max(next, 0), limit);
}

/** Within half a pixel of the bottom, or nothing to scroll at all. */
export function atEnd(position: number, maxScroll: number): boolean {
  return position >= Math.max(maxScroll, 0) - 0.5;
}
