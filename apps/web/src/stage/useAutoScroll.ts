import { useEffect, type RefObject } from "react";
import { advance, atEnd } from "./scroll.ts";

export interface AutoScrollOptions {
  /** Pixels per second. Zero or less pauses without unmounting the loop. */
  speed: number;
  running: boolean;
  onReachEnd?: () => void;
}

/** Drive an element's scrollTop at a steady rate.
 *
 *  Position is tracked in a local float rather than read back from the
 *  element each frame, because browsers round scrollTop and the rounding
 *  error would otherwise accumulate into a visible drift over a song. */
export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  { speed, running, onReachEnd }: AutoScrollOptions,
): void {
  useEffect(() => {
    if (!running) return;
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    let last: number | null = null;
    let position = el.scrollTop;

    const tick = (now: number) => {
      const max = el.scrollHeight - el.clientHeight;
      if (last !== null) {
        position = advance(position, speed, now - last, max);
        el.scrollTop = position;
      }
      last = now;

      if (atEnd(position, max)) {
        onReachEnd?.();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ref, speed, running, onReachEnd]);
}
