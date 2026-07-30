import { describe, it, expect } from "vitest";
import {
  advance,
  atEnd,
  SPEED_STEPS,
  DEFAULT_SPEED_INDEX,
  FONT_STEPS,
  DEFAULT_FONT_INDEX,
} from "../src/stage/scroll.ts";

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
