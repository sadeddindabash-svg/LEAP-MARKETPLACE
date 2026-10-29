"use client";

import { useEffect, useRef } from "react";
import { REFRESH_MS } from "@/lib/refresh";

/**
 * Runs `refresh` every `intervalMs` (5 seconds) while the page is open AND visible, and at once when the tab becomes visible again or the window gets focus. It is QUIET: nothing is shown while it loads, and an error is ignored
 * (the page keeps what it has). Never two at a time (a slow server is not piled up). `refresh` should set state only from a successful answer. Turned off while `enabled` is false.
 */
export function useAutoRefresh(refresh: () => void | Promise<unknown>, { intervalMs = REFRESH_MS, enabled = true }: { intervalMs?: number; enabled?: boolean } = {}): void {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let running = false;
    let alive = true;
    const tick = async () => {
      if (!alive || running || document.hidden) return;
      running = true;
      try { await latest.current(); } catch { /* quiet: the page keeps what it has */ } finally { running = false; }
    };
    const timer = setInterval(tick, intervalMs);
    const onWake = () => { if (!document.hidden) void tick(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onWake); window.removeEventListener("focus", onWake); };
  }, [enabled, intervalMs]);
}
