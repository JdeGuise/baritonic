import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("defaults to a loopback bind and a local data directory", () => {
    const c = loadConfig({});
    expect(c.port).toBe(4173);
    expect(c.bindAddr).toBe("127.0.0.1");
    expect(c.dataDir).toBe("./data");
    expect(c.dbPath).toBe("data/music-ui.db");
  });

  it("reads overrides from the environment", () => {
    const c = loadConfig({ PORT: "8080", DATA_DIR: "/var/lib/music-ui", BIND_ADDR: "0.0.0.0" });
    expect(c.port).toBe(8080);
    expect(c.dataDir).toBe("/var/lib/music-ui");
    expect(c.bindAddr).toBe("0.0.0.0");
    expect(c.dbPath).toBe("/var/lib/music-ui/music-ui.db");
  });

  it("rejects a non-numeric port", () => {
    expect(() => loadConfig({ PORT: "http" })).toThrow(/PORT/);
  });

  it("rejects a port outside the valid range", () => {
    expect(() => loadConfig({ PORT: "0" })).toThrow(/PORT/);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/PORT/);
  });
});
