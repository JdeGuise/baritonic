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
    const { sentinel, request } = stubWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await waitFor(() => expect(request).toHaveBeenCalled());
    unmount();
    await waitFor(() => expect(sentinel.release).toHaveBeenCalled());
  });

  it("swallows a rejected request", () => {
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
