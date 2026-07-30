# Stage view and print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-screen performance view with large type, auto-scroll, and a screen wake lock; plus clean paper output at the key currently on screen.

**Architecture:** The scroll arithmetic is a pure module with no React and no DOM, tested exhaustively. The hooks around it stay thin. Print is a stylesheet plus one toggle — CSS that cannot be unit-tested, so it gets a manual verification step instead of a fake one.

**Tech Stack:** Unchanged — React 19, TypeScript 5, Vitest, Testing Library.

## Global Constraints

- Everything from earlier phases still applies: no parameter properties, explicit `.ts`/`.tsx` extensions, `strict` with `noUncheckedIndexedAccess`, tokens-based styling, invented placeholder lyrics in fixtures.
- The stage route reuses `ChordChart` unchanged — **editing affordances are off** there, which happens automatically by omitting `onChordClick`.
- Changing key still issues no network request.
- **No new runtime dependencies.** Wake Lock and `requestAnimationFrame` are platform APIs; both must degrade silently where unsupported.
- `prefers-reduced-motion` is already honoured globally; auto-scroll is user-initiated so it is exempt, but it must never start on its own.
- Commit after every task using the message given in that task's final step.

## What is and isn't testable here

jsdom has **no layout engine**. `scrollHeight`, `clientHeight`, and `getBoundingClientRect` are all zero, and `@media print` rules are never evaluated. Two consequences, both handled honestly:

- The scroll **arithmetic** lives in `src/stage/scroll.ts` as pure functions and is tested exhaustively. The hook that drives it is tested for its contract — starts when running, stops when not, survives a null ref — with `requestAnimationFrame` stubbed.
- The print **stylesheet** is verified by eye in Task 6. What *is* tested is the state it depends on: the diagram toggle flips a class, and the print button calls `window.print`.

Do not write tests that assert layout values in jsdom. They pass without meaning anything.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/web/src/stage/scroll.ts` | Scroll arithmetic and speed table (pure) |
| `apps/web/src/stage/useAutoScroll.ts` | rAF loop driving an element's `scrollTop` |
| `apps/web/src/stage/useWakeLock.ts` | Screen wake lock, degrading where unsupported |
| `apps/web/src/pages/StagePage.tsx` | Full-screen performance view |
| `apps/web/src/pages/SongPage.tsx` | Stage link, print button, diagram toggle |
| `apps/web/src/styles/stage.css` | Stage layout and the print stylesheet |
| `apps/web/src/App.tsx` | The `/songs/:id/stage` route |

---

### Task 1: Scroll arithmetic

**Files:**
- Create: `apps/web/src/stage/scroll.ts`
- Test: `apps/web/test/scroll.test.ts`

**Interfaces:**
- Produces: `SPEED_STEPS`, `DEFAULT_SPEED_INDEX`, `advance(position, speedPxPerSec, deltaMs, maxScroll)`, `atEnd(position, maxScroll)`, `FONT_STEPS`, `DEFAULT_FONT_INDEX`.

Speeds are in pixels per second, chosen as a coarse geometric-ish ladder because chord tabs carry no reliable tempo data — the user sets this by feel, so a slider with 200 positions would be worse than seven good ones.

- [ ] **Step 1: Write the failing test**

`apps/web/test/scroll.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { advance, atEnd, SPEED_STEPS, DEFAULT_SPEED_INDEX, FONT_STEPS, DEFAULT_FONT_INDEX } from "../src/stage/scroll.ts";

describe("advance", () => {
  it("moves proportionally to elapsed time", () => {
    expect(advance(0, 60, 1000, 1000)).toBe(60);
    expect(advance(0, 60, 500, 1000)).toBe(30);
  });

  it("accumulates from the current position", () => {
    expect(advance(100, 60, 1000, 1000)).toBe(160);
  });

  it("keeps sub-pixel progress rather than rounding it away", () => {
    // At 10px/s a 16ms frame is 0.16px; rounding would stall completely.
    expect(advance(0, 10, 16, 1000)).toBeCloseTo(0.16, 5);
  });

  it("does not move at zero speed", () => {
    expect(advance(50, 0, 1000, 1000)).toBe(50);
  });

  it("ignores a negative or zero delta", () => {
    expect(advance(50, 60, 0, 1000)).toBe(50);
    expect(advance(50, 60, -100, 1000)).toBe(50);
  });

  it("clamps at the bottom of the scrollable area", () => {
    expect(advance(990, 60, 1000, 1000)).toBe(1000);
  });

  it("never returns a negative position", () => {
    expect(advance(-50, 0, 1000, 1000)).toBe(0);
  });

  it("handles content shorter than the viewport", () => {
    expect(advance(0, 60, 1000, 0)).toBe(0);
    expect(advance(0, 60, 1000, -20)).toBe(0);
  });
});

describe("atEnd", () => {
  it("reports the end once the position reaches the maximum", () => {
    expect(atEnd(1000, 1000)).toBe(true);
    expect(atEnd(999.9, 1000)).toBe(true);
  });

  it("is false partway down", () => {
    expect(atEnd(500, 1000)).toBe(false);
  });

  it("is true when there is nothing to scroll", () => {
    expect(atEnd(0, 0)).toBe(true);
  });
});

describe("tables", () => {
  it("offers ascending speeds", () => {
    expect([...SPEED_STEPS]).toEqual([...SPEED_STEPS].sort((a, b) => a - b));
    expect(SPEED_STEPS.length).toBeGreaterThanOrEqual(5);
  });

  it("has a usable default speed", () => {
    expect(SPEED_STEPS[DEFAULT_SPEED_INDEX]).toBeGreaterThan(0);
  });

  it("offers ascending font scales with a default in range", () => {
    expect([...FONT_STEPS]).toEqual([...FONT_STEPS].sort((a, b) => a - b));
    expect(FONT_STEPS[DEFAULT_FONT_INDEX]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/scroll.test.ts`
Expected: FAIL — `../src/stage/scroll.ts` unresolved.

- [ ] **Step 3: Write the implementation**

`apps/web/src/stage/scroll.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/scroll.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): auto-scroll arithmetic"
```

---

### Task 2: The auto-scroll hook

**Files:**
- Create: `apps/web/src/stage/useAutoScroll.ts`
- Test: `apps/web/test/use-auto-scroll.test.ts`

**Interfaces:**
- Consumes: `advance`, `atEnd` (Task 1).
- Produces: `useAutoScroll(ref, options: { speed: number; running: boolean; onReachEnd?: () => void })`.

The hook owns the rAF loop and nothing else. Its tests stub `requestAnimationFrame` and define the layout properties jsdom leaves at zero — that is enough to verify the **contract**, not the visual result.

- [ ] **Step 1: Write the failing test**

`apps/web/test/use-auto-scroll.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useAutoScroll } from "../src/stage/useAutoScroll.ts";

/** jsdom reports zero for every layout property, so a scrollable element
 *  has to be faked. This verifies the hook's contract, not its looks. */
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

/** Run one frame `ms` after the previous timestamp. */
const step = (ms: number, base = 0) => {
  const pending = frames.splice(0, frames.length);
  for (const f of pending) f(base + ms);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/use-auto-scroll.test.ts`
Expected: FAIL — `../src/stage/useAutoScroll.ts` unresolved.

- [ ] **Step 3: Write the implementation**

`apps/web/src/stage/useAutoScroll.ts`:

```ts
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
 *  error would otherwise accumulate into a visible drift. */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/use-auto-scroll.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): auto-scroll hook"
```

---

### Task 3: The wake lock hook

**Files:**
- Create: `apps/web/src/stage/useWakeLock.ts`
- Test: `apps/web/test/use-wake-lock.test.ts`

**Interfaces:**
- Produces: `useWakeLock(active: boolean): { supported: boolean }`.

Wake Lock is absent in jsdom, absent in Firefox until recently, and absent over plain HTTP on some browsers — so unsupported is the *normal* path, not an edge case, and must never throw or warn.

- [ ] **Step 1: Write the failing test**

`apps/web/test/use-wake-lock.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useWakeLock } from "../src/stage/useWakeLock.ts";

interface FakeSentinel {
  released: boolean;
  release: () => Promise<void>;
}

function stubWakeLock() {
  const sentinel: FakeSentinel = {
    released: false,
    release: vi.fn(async () => {
      sentinel.released = true;
    }),
  };
  const request = vi.fn(async () => sentinel);
  Object.defineProperty(navigator, "wakeLock", {
    value: { request },
    configurable: true,
    writable: true,
  });
  return { sentinel, request };
}

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "wakeLock");
  vi.restoreAllMocks();
});

describe("useWakeLock", () => {
  it("reports unsupported when the API is absent", () => {
    const { result } = renderHook(() => useWakeLock(true));
    expect(result.current.supported).toBe(false);
  });

  it("does not throw when the API is absent", () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("reports supported when the API exists", () => {
    stubWakeLock();
    const { result } = renderHook(() => useWakeLock(false));
    expect(result.current.supported).toBe(true);
  });

  it("requests a screen lock when active", async () => {
    const { request } = stubWakeLock();
    renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalledWith("screen"));
  });

  it("does not request a lock when inactive", () => {
    const { request } = stubWakeLock();
    renderHook(() => useWakeLock(false));
    expect(request).not.toHaveBeenCalled();
  });

  it("releases the lock on unmount", async () => {
    const { sentinel } = stubWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(sentinel.release).not.toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(sentinel.release).toHaveBeenCalled());
  });

  it("swallows a rejected request", async () => {
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        request: vi.fn(async () => {
          throw new Error("denied");
        }),
      },
      configurable: true,
      writable: true,
    });
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/use-wake-lock.test.ts`
Expected: FAIL — `../src/stage/useWakeLock.ts` unresolved.

- [ ] **Step 3: Write the implementation**

`apps/web/src/stage/useWakeLock.ts`:

```ts
import { useEffect, useState } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

interface WakeLockLike {
  request: (type: "screen") => Promise<WakeLockSentinelLike>;
}

function wakeLockApi(): WakeLockLike | null {
  const nav = navigator as unknown as { wakeLock?: WakeLockLike };
  return nav.wakeLock ?? null;
}

/** Hold a screen wake lock while `active`.
 *
 *  Absence is the normal case — no support in some browsers, and none at
 *  all over plain HTTP — so every failure path is silent. The lock is
 *  also re-acquired when the tab becomes visible again, because browsers
 *  drop it automatically when the page is hidden. */
export function useWakeLock(active: boolean): { supported: boolean } {
  const [supported] = useState(() => wakeLockApi() !== null);

  useEffect(() => {
    if (!active) return;
    const api = wakeLockApi();
    if (!api) return;

    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await api.request("screen");
        if (cancelled) {
          void lock.release();
          return;
        }
        sentinel = lock;
      } catch {
        // Denied or unavailable. Nothing to do and nothing worth saying.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release();
    };
  }, [active]);

  return { supported };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/use-wake-lock.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): screen wake lock hook"
```

---

### Task 4: The stage page

**Files:**
- Create: `apps/web/src/pages/StagePage.tsx`, `apps/web/src/styles/stage.css`
- Modify: `apps/web/src/App.tsx`, `src/main.tsx`
- Test: `apps/web/test/stage-page.test.tsx`

**Interfaces:**
- Consumes: `api`, `ChordChart`, `useAutoScroll`, `useWakeLock`, `transposeDocument`, the speed and font tables.
- Produces: `StagePage()` at `/songs/:id/stage`.

The stage renders the chart **without** `onChordClick`, so editing affordances are off — chords stay plain text and nothing is clickable mid-song. Controls dim while scrolling and return on hover or focus, which is the "minimal chrome" requirement without a timer to get wrong.

- [ ] **Step 1: Write the failing test**

`apps/web/test/stage-page.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StagePage } from "../src/pages/StagePage.tsx";
import { api, ApiError } from "../src/api/client.ts";
import type { SongDetail } from "../src/api/types.ts";

const detail = (over: Partial<SongDetail> = {}): SongDetail => ({
  id: 1,
  sourceUrl: null,
  artist: "Demo Artist",
  title: "Placeholder Song",
  tabType: "Chords",
  detectedKey: "E",
  detectedKeyConfidence: 0.9,
  keyOverride: null,
  preferredKey: null,
  tuning: null,
  document: {
    sections: [
      {
        label: "Verse",
        lines: [
          {
            kind: "lyric",
            text: "placeholder words here",
            chords: [
              { sym: "E", at: 0 },
              { sym: "C#m", at: 12 },
            ],
          },
        ],
      },
    ],
  },
  ugMeta: null,
  overrides: [],
  inversions: [],
  orphanedOverrides: [],
  importedAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
  ...over,
});

const show = () =>
  render(
    <MemoryRouter initialEntries={["/songs/1/stage"]}>
      <Routes>
        <Route path="/songs/:id/stage" element={<StagePage />} />
        <Route path="/songs/:id" element={<p>song page</p>} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => vi.restoreAllMocks());

describe("StagePage", () => {
  it("shows the chart in the preferred key", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail({ preferredKey: "C" }));
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect([...container.querySelectorAll(".unit-chord")].map((n) => n.textContent)).toEqual([
      "C",
      "Am",
    ]);
  });

  it("falls back to the written key", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect([...container.querySelectorAll(".unit-chord")].map((n) => n.textContent)).toEqual([
      "E",
      "C#m",
    ]);
  });

  it("does not make chords editable", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(container.querySelectorAll("button.unit-chord")).toHaveLength(0);
  });

  it("starts paused", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("toggles between play and pause", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");

    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("offers a scroll speed control", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    const speed = screen.getByLabelText(/speed/i);
    fireEvent.change(speed, { target: { value: "5" } });
    expect(speed).toHaveValue("5");
  });

  it("offers a type size control", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");

    const before = container.querySelector(".stage")?.getAttribute("style");
    fireEvent.click(screen.getByRole("button", { name: /larger/i }));
    expect(container.querySelector(".stage")?.getAttribute("style")).not.toBe(before);
  });

  it("dims the controls while scrolling", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");

    expect(container.querySelector(".stage-bar.dim")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(container.querySelector(".stage-bar.dim")).toBeTruthy();
  });

  it("leaves on Escape", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(await screen.findByText("song page")).toBeInTheDocument();
  });

  it("has an exit control", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.click(screen.getByRole("button", { name: /exit/i }));
    expect(await screen.findByText("song page")).toBeInTheDocument();
  });

  it("toggles play with the space bar", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
  });

  it("shows an error when the song cannot be loaded", async () => {
    vi.spyOn(api, "getSong").mockRejectedValue(new ApiError(404, "Song not found"));
    show();
    expect(await screen.findByText(/Song not found/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run test/stage-page.test.tsx`
Expected: FAIL — `../src/pages/StagePage.tsx` unresolved.

- [ ] **Step 3: Write the page**

`apps/web/src/pages/StagePage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { transposeDocument } from "@music-ui/music-core";
import { api } from "../api/client.ts";
import type { SongDetail } from "../api/types.ts";
import { ChordChart } from "../components/ChordChart.tsx";
import { useAutoScroll } from "../stage/useAutoScroll.ts";
import { useWakeLock } from "../stage/useWakeLock.ts";
import {
  DEFAULT_FONT_INDEX,
  DEFAULT_SPEED_INDEX,
  FONT_STEPS,
  SPEED_STEPS,
} from "../stage/scroll.ts";

export function StagePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const songId = Number(id);

  const [song, setSong] = useState<SongDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [fontIndex, setFontIndex] = useState(DEFAULT_FONT_INDEX);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let live = true;
    api
      .getSong(songId)
      .then((s) => {
        if (live) setSong(s);
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : "Could not load this song");
      });
    return () => {
      live = false;
    };
  }, [songId]);

  const leave = useCallback(() => navigate(`/songs/${songId}`), [navigate, songId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
      if (e.key === " ") {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leave]);

  const writtenKey = song?.keyOverride ?? song?.detectedKey ?? "C";
  const targetKey = song?.preferredKey ?? writtenKey;

  const transposed = useMemo(() => {
    if (!song) return null;
    return transposeDocument(song.document, writtenKey, targetKey);
  }, [song, writtenKey, targetKey]);

  const onReachEnd = useCallback(() => setRunning(false), []);
  useAutoScroll(scrollRef, { speed: SPEED_STEPS[speedIndex] ?? 30, running, onReachEnd });
  useWakeLock(running);

  if (error) return <p className="notice">{error}</p>;
  if (!song || !transposed) return <p className="muted">Loading…</p>;

  const scale = FONT_STEPS[fontIndex] ?? 1;

  return (
    <div className="stage" style={{ ["--stage-scale" as string]: String(scale) }}>
      <div className="stage-scroll" ref={scrollRef}>
        <header className="stage-head">
          <h1>{song.title}</h1>
          <p>
            {song.artist} · {targetKey}
          </p>
        </header>
        {/* No onChordClick: nothing is editable mid-performance. */}
        <ChordChart document={transposed} />
        <div className="stage-tail" />
      </div>

      <div className={running ? "stage-bar dim" : "stage-bar"}>
        <button type="button" className="btn pri" onClick={() => setRunning((r) => !r)}>
          {running ? "Pause" : "Play"}
        </button>

        <label className="klabel" htmlFor="speed">
          Speed
        </label>
        <input
          id="speed"
          type="range"
          min={0}
          max={SPEED_STEPS.length - 1}
          value={speedIndex}
          aria-label="Scroll speed"
          onChange={(e) => setSpeedIndex(Number(e.target.value))}
        />

        <button
          type="button"
          className="btn"
          aria-label="Smaller type"
          onClick={() => setFontIndex((i) => Math.max(0, i - 1))}
        >
          A−
        </button>
        <button
          type="button"
          className="btn"
          aria-label="Larger type"
          onClick={() => setFontIndex((i) => Math.min(FONT_STEPS.length - 1, i + 1))}
        >
          A+
        </button>

        <button type="button" className="btn" onClick={leave}>
          Exit
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the stage stylesheet**

`apps/web/src/styles/stage.css`:

```css
.stage {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: var(--ivory);
  color: var(--ink);
}

.stage-scroll {
  flex: 1;
  overflow-y: auto;
  padding: var(--s6) var(--s5);
  scroll-behavior: auto;
}

.stage-head { margin-bottom: var(--s6); }
.stage-head h1 {
  font-family: var(--mono); font-weight: 600; letter-spacing: -0.03em;
  margin: 0; font-size: calc(1.4rem * var(--stage-scale));
}
.stage-head p { margin: 0; color: var(--muted); font-size: calc(0.85rem * var(--stage-scale)); }

/* The chart scales as one system so chords and lyrics keep proportion. */
.stage .unit-chord { font-size: calc(0.82rem * var(--stage-scale)); }
.stage .unit-text { font-size: calc(1rem * var(--stage-scale)); }
.stage .eyebrow { font-size: calc(0.7rem * var(--stage-scale)); }
.stage .chart-note { font-size: calc(0.9rem * var(--stage-scale)); }

/* Room to scroll the last line up to a comfortable reading height. */
.stage-tail { height: 60vh; }

.stage-bar {
  display: flex; align-items: center; gap: var(--s3);
  flex-wrap: wrap;
  padding: var(--s3) var(--s5);
  border-top: 1px solid var(--hair);
  background: var(--panel);
  transition: opacity 240ms ease;
}
.stage-bar.dim { opacity: 0.25; }
.stage-bar.dim:hover,
.stage-bar.dim:focus-within { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .stage-bar { transition: none; }
}
```

- [ ] **Step 5: Add the route and import the stylesheet**

In `apps/web/src/App.tsx` add the import and route:

```tsx
import { StagePage } from "./pages/StagePage.tsx";
```

```tsx
        <Route path="/songs/:id/stage" element={<StagePage />} />
```

In `apps/web/src/main.tsx`, add after the other stylesheet imports:

```tsx
import "./styles/stage.css";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/web && npx vitest run test/stage-page.test.tsx`
Expected: PASS, 12 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat(web): full-screen stage view with auto-scroll and wake lock"
```

---

### Task 5: Print output and the stage link

**Files:**
- Modify: `apps/web/src/pages/SongPage.tsx`, `apps/web/src/styles/stage.css`
- Test: `apps/web/test/song-page.test.tsx`

**Interfaces:**
- Produces: a stage link, a print button, and a "diagrams on paper" toggle on the song page.

The print rules cannot be exercised in jsdom. What is tested is the state they key off: the toggle flips a class, and the button calls `window.print`. Task 6 checks the actual output by eye.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/test/song-page.test.tsx`:

```tsx
describe("SongPage stage and print", () => {
  it("links to the stage view", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    show();
    await screen.findByText("Placeholder Song");
    expect(screen.getByRole("link", { name: /stage/i })).toHaveAttribute(
      "href",
      "/songs/1/stage",
    );
  });

  it("prints on demand", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const print = vi.fn();
    vi.stubGlobal("print", print);
    show();
    await screen.findByText("Placeholder Song");
    fireEvent.click(screen.getByRole("button", { name: /print/i }));
    expect(print).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("includes diagrams on paper by default", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    expect(container.querySelector(".print-no-diagrams")).toBeNull();
  });

  it("can suppress diagrams on paper", async () => {
    vi.spyOn(api, "getSong").mockResolvedValue(detail());
    const { container } = show();
    await screen.findByText("Placeholder Song");
    fireEvent.click(screen.getByLabelText(/diagrams on paper/i));
    expect(container.querySelector(".print-no-diagrams")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run test/song-page.test.tsx`
Expected: FAIL — no stage link, no print button.

- [ ] **Step 3: Add the controls to `SongPage`**

Add state near the other `useState` calls:

```tsx
  const [printDiagrams, setPrintDiagrams] = useState(true);
```

Add `Link` to the react-router import. Wrap the returned tree's outermost `div` class:

```tsx
    <div className={printDiagrams ? "stack" : "stack print-no-diagrams"}>
```

Add to the `chartbar`, after the save button:

```tsx
        <Link to={`/songs/${song.id}/stage`} className="btn no-print">
          Stage
        </Link>
        <button type="button" className="btn no-print" onClick={() => window.print()}>
          Print
        </button>
        <label className="klabel no-print">
          <input
            type="checkbox"
            checked={printDiagrams}
            aria-label="Diagrams on paper"
            onChange={(e) => setPrintDiagrams(e.target.checked)}
          />{" "}
          Diagrams on paper
        </label>
```

Add a print-only header just inside the outer div, since the chartbar is hidden on paper:

```tsx
      <div className="print-only print-head">
        {song.artist} — {song.title} · {targetKey}
      </div>
```

- [ ] **Step 4: Write the print stylesheet**

Append to `apps/web/src/styles/stage.css`:

```css
.print-only { display: none; }

@media print {
  /* Paper is white; the screen palette is not. */
  body { background: #fff; color: #000; font-size: 11pt; }

  .topbar,
  .chartbar,
  .no-print,
  .search,
  .editor,
  .notice { display: none !important; }

  .print-only { display: block; }
  .print-head {
    font-family: var(--mono);
    font-weight: 700;
    margin-bottom: 12pt;
    padding-bottom: 6pt;
    border-bottom: 1pt solid #000;
  }

  .shell { max-width: none; padding: 0; }

  /* Keep a section whole where it fits on the page. */
  .chart-section { break-inside: avoid; page-break-inside: avoid; }
  .chart-line { break-inside: avoid; page-break-inside: avoid; }

  .unit-chord { color: #000; font-weight: 700; }
  .unit-chord.pinned { text-decoration: none; }
  .eyebrow { color: #000; }

  .pd { break-inside: avoid; page-break-inside: avoid; border-color: #999; }
  .pd-name { color: #000; }
  .key.lit { fill: #555; }
  .key.white { fill: #fff; stroke: #000; }
  .key.black { fill: #000; }

  .print-no-diagrams .pianos,
  .print-no-diagrams .eyebrow + .pianos { display: none !important; }
}
```

- [ ] **Step 5: Run the whole suite and the typechecker**

Run: `cd apps/web && npm test && npm run typecheck`
Expected: all files PASS, `tsc --noEmit` clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web
git commit -m "feat(web): print stylesheet, stage link, and paper diagram toggle"
```

---

### Task 6: Manual verification

**Files:** none. Verification only.

The two features in this phase are layout-dependent, so this step is the real test.

- [ ] **Step 1: Build and boot**

```bash
cd apps/web && npm run build
cd ../server && rm -rf /tmp/music-ui-stage && DATA_DIR=/tmp/music-ui-stage PORT=4202 npm start
```

- [ ] **Step 2: Seed a song long enough to scroll**

```bash
B=http://127.0.0.1:4202
python3 - <<'PY' > /tmp/stage-body.json
import json
lines = []
for i in range(1, 9):
    lines += [f"[Verse {i}]",
              "[ch]E[/ch]      [ch]C#m[/ch]",
              "placeholder line of text for layout",
              "[ch]A[/ch]      [ch]B[/ch]",
              "another placeholder line of text",
              ""]
print(json.dumps({"artist": "Demo", "title": "Stage Check",
                  "rawBody": "\r\n".join(lines)}))
PY
curl -s -X POST $B/api/songs -H 'content-type: application/json' -d @/tmp/stage-body.json \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('id',d['id'],'key',d['detectedKey'])"
curl -s -X PATCH $B/api/songs/1 -H 'content-type: application/json' -d '{"preferredKey":"C"}' > /dev/null
```

- [ ] **Step 3: Check the stage view by eye**

Open `http://127.0.0.1:4202/songs/1/stage` and confirm:

- The chart is in C, not E — the preferred key is honoured.
- Chords are **not** clickable and no editor appears.
- **Play** starts a smooth scroll; the control bar dims and returns on hover.
- The speed slider changes the rate noticeably at both extremes.
- **A+** and **A−** rescale chords and lyrics together, keeping alignment.
- Scrolling stops on its own at the bottom and the button returns to **Play**.
- Space toggles play; Escape returns to the song page.

- [ ] **Step 4: Check the print output by eye**

On `http://127.0.0.1:4202/songs/1`, use the browser's Print preview and confirm:

- The header, chart bar, and buttons are gone; the print-only header shows artist, title, and key.
- Chords are black and legible, and sit above the right words.
- No section is split across a page break where it would fit whole.
- Unchecking **Diagrams on paper** removes the piano diagrams from the preview.

- [ ] **Step 5: Clean up and verify every suite**

```bash
pkill -f "src/server.ts"; rm -rf /tmp/music-ui-stage /tmp/stage-body.json
```

Then run `npm test` and `npm run typecheck` in all four packages.

- [ ] **Step 6: Commit any fixes**

Only if Steps 3-4 required changes. Note what the browser revealed that the tests could not.

---

## Self-Review

**Spec coverage.** All four stage-view requirements the spec selected are covered: large type with minimal chrome (4), auto-scroll with speed control (1, 2, 4), keep screen awake (3, 4), and a print stylesheet (5). Print renders at the currently selected key, avoids breaking sections across pages, and offers the diagram toggle the spec asked for.

**Type consistency.** `useAutoScroll` takes `(ref, {speed, running, onReachEnd})` in both its definition and every call; `SPEED_STEPS`/`FONT_STEPS` are indexed with bounds-checked fallbacks because `noUncheckedIndexedAccess` is on; `useWakeLock(active)` returns `{supported}` and is called with a plain boolean.

**Known soft spots, stated rather than hidden.** Three. First, auto-scroll and print are layout-dependent and jsdom has no layout engine — Task 6 is the real verification and the plan says so instead of asserting zeros. Second, `.stage-tail` reserves 60vh so the final line can scroll to a comfortable height; if that feels wrong in practice it is one number to change. Third, the print rule that hides diagrams targets `.pianos` under a wrapper class, which works because the diagram strip is the only element with that class — if a second diagram group is ever added, the selector needs revisiting rather than duplicating.
