import { useEffect, useRef } from "react";

/** How often a screen that is open and visible quietly reloads what it shows. One place to change it. */
export const REFRESH_MS = 5000;

/**
 * Runs `refresh` every `intervalMs` (5 seconds) while the tab is open AND visible, and at once when the tab becomes visible again or the window gets focus. It is QUIET: nothing is shown while it loads, an error is ignored (the screen
 * keeps what it has), and never two run at a time. `refresh` should set state only from a successful answer. Turned off while `enabled` is false.
 */
export function useAutoRefresh(refresh, { intervalMs = REFRESH_MS, enabled = true } = {}) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;
    let running = false;
    let alive = true;
    const tick = async () => {
      if (!alive || running || document.hidden) return;
      running = true;
      try { await latest.current(); } catch { /* quiet: the screen keeps what it has */ } finally { running = false; }
    };
    const timer = setInterval(tick, intervalMs);
    const onWake = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onWake); window.removeEventListener("focus", onWake); };
  }, [enabled, intervalMs]);
}

/** True when two answers are the same data (so a refresh that changed nothing does not redraw the screen). */
export function sameData(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
}

/** `setter` wrapped so that it only changes the state when the new data is different: `.then(setIfChanged(setOrders))`. */
export function setIfChanged(setter) {
  return (next) => setter((previous) => (sameData(previous, next) ? previous : next));
}
