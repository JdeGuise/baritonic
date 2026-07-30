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
