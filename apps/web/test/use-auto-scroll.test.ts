import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useAutoScroll } from "../src/stage/useAutoScroll.ts";

/** jsdom reports zero for every layout property, so a scrollable element
 *  has to be faked. This verifies the hook's contract, not its looks —
 *  the visual result is checked in a browser. */
function scrollableDiv(scrollHeight = 2000, clientHeight = 1000): HTMLDivElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  let top = 0;
  Object.defineProperty(el, "scrollTop", {
    get: () => top,
    set: (v: number) => {
      top = v;
    },
    configurable: true,
  });
  return el;
}

let frames: Array<(t: number) => void>;

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: (t: number) => void) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

/** Run every pending frame with the given timestamp. */
const step = (ms: number) => {
  const pending = frames.splice(0, frames.length);
  for (const f of pending) f(ms);
};

const setup = (el: HTMLElement | null, speed: number, running: boolean) =>
  renderHook(() => {
    const ref = useRef<HTMLElement | null>(el);
    useAutoScroll(ref, { speed, running });
  });

describe("useAutoScroll", () => {
  it("requests no frames when not running", () => {
    setup(scrollableDiv(), 60, false);
    expect(frames).toHaveLength(0);
  });

  it("requests a frame when running", () => {
    setup(scrollableDiv(), 60, true);
    expect(frames.length).toBeGreaterThan(0);
  });

  it("does not throw when the ref is empty", () => {
    expect(() => setup(null, 60, true)).not.toThrow();
  });

  it("advances scrollTop over successive frames", () => {
    const el = scrollableDiv();
    setup(el, 60, true);
    step(0);
    step(1000);
    expect(el.scrollTop).toBeGreaterThan(0);
  });

  it("stops requesting frames once it reaches the end", () => {
    // 20px of travel at 120px/s is gone in well under a second.
    const el = scrollableDiv(1020, 1000);
    setup(el, 120, true);
    step(0);
    step(1000);
    expect(frames).toHaveLength(0);
  });

  it("reports reaching the end", () => {
    const onReachEnd = vi.fn();
    const el = scrollableDiv(1020, 1000);
    renderHook(() => {
      const ref = useRef<HTMLElement | null>(el);
      useAutoScroll(ref, { speed: 120, running: true, onReachEnd });
    });
    step(0);
    step(1000);
    expect(onReachEnd).toHaveBeenCalled();
  });

  it("stops when running becomes false", () => {
    const el = scrollableDiv();
    const { rerender } = renderHook(
      ({ running }: { running: boolean }) => {
        const ref = useRef<HTMLElement | null>(el);
        useAutoScroll(ref, { speed: 60, running });
      },
      { initialProps: { running: true } },
    );
    frames.length = 0;
    rerender({ running: false });
    expect(frames).toHaveLength(0);
  });
});
