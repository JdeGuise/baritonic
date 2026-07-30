import { describe, it, expect } from "vitest";
import { ImportError, describeFailure } from "../src/errors";

describe("ImportError", () => {
  it("carries a structured failure", () => {
    const err = new ImportError({ kind: "pro-tab", message: "no body" });
    expect(err.failure.kind).toBe("pro-tab");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("describeFailure", () => {
  it("names the cause and the remedy for each kind", () => {
    expect(describeFailure({ kind: "challenge", status: 403, message: "" }))
      .toMatch(/challenge page/i);
    expect(describeFailure({ kind: "pro-tab", message: "" }))
      .toMatch(/pro tab/i);
    expect(describeFailure({ kind: "schema", message: "" }))
      .toMatch(/format may have changed/i);
    expect(describeFailure({ kind: "network", message: "timeout" }))
      .toMatch(/timeout/);
  });

  it("tells the user to paste when fetching is the problem", () => {
    for (const f of [
      { kind: "challenge" as const, status: 403, message: "" },
      { kind: "network" as const, message: "x" },
    ]) {
      expect(describeFailure(f)).toMatch(/past/i);
    }
  });
});
