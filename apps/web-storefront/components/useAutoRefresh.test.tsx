import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoRefresh } from "./useAutoRefresh";
import { REFRESH_MS } from "@/lib/refresh";

// The quiet 5-second refresh: while the tab is visible, at once when it comes back, never two at a time, errors ignored.
const setHidden = (hidden: boolean) => { Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden }); };
beforeEach(() => { vi.useFakeTimers(); setHidden(false); });
afterEach(() => { vi.useRealTimers(); setHidden(false); });

describe("useAutoRefresh", () => {
  it("CRITICAL: the default is every 5 seconds", async () => {
    expect(REFRESH_MS).toBe(5000); const refresh = vi.fn(async () => {}); renderHook(() => useAutoRefresh(refresh));
    await act(async () => { await vi.advanceTimersByTimeAsync(4999); }); expect(refresh).toHaveBeenCalledTimes(0); await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(refresh).toHaveBeenCalledTimes(1); await act(async () => { await vi.advanceTimersByTimeAsync(10000); }); expect(refresh).toHaveBeenCalledTimes(3);
  });
  it("CRITICAL: nothing is loaded while the tab is hidden; when it becomes visible again it loads AT ONCE", async () => {
    const refresh = vi.fn(async () => {}); renderHook(() => useAutoRefresh(refresh)); setHidden(true); await act(async () => { await vi.advanceTimersByTimeAsync(20000); }); expect(refresh).toHaveBeenCalledTimes(0);
    setHidden(false); await act(async () => { document.dispatchEvent(new Event("visibilitychange")); await vi.advanceTimersByTimeAsync(0); }); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("getting the window's focus loads at once too, but not while hidden", async () => {
    const refresh = vi.fn(async () => {}); renderHook(() => useAutoRefresh(refresh)); await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(0); }); expect(refresh).toHaveBeenCalledTimes(1); setHidden(true); await act(async () => { window.dispatchEvent(new Event("focus")); await vi.advanceTimersByTimeAsync(0); }); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("CRITICAL: never two at a time: a slow answer is waited for, not piled up", async () => {
    let finish: () => void = () => {}; const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })); renderHook(() => useAutoRefresh(refresh));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(refresh).toHaveBeenCalledTimes(1); await act(async () => { await vi.advanceTimersByTimeAsync(15000); }); expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); await vi.advanceTimersByTimeAsync(0); }); await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("CRITICAL: an error is ignored and the next tick still runs", async () => {
    const refresh = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(undefined); renderHook(() => useAutoRefresh(refresh)); await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(refresh).toHaveBeenCalledTimes(2);
  });
  it("it is off while `enabled` is false and starts when it becomes true", async () => {
    const refresh = vi.fn(async () => {}); const { rerender } = renderHook(({ on }) => useAutoRefresh(refresh, { enabled: on }), { initialProps: { on: false } }); await act(async () => { await vi.advanceTimersByTimeAsync(20000); }); expect(refresh).toHaveBeenCalledTimes(0);
    rerender({ on: true }); await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(refresh).toHaveBeenCalledTimes(1); rerender({ on: false }); await act(async () => { await vi.advanceTimersByTimeAsync(20000); }); expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("it always calls the LATEST function (no stale data), and unmounting stops it", async () => {
    const first = vi.fn(async () => {}); const second = vi.fn(async () => {}); const { rerender, unmount } = renderHook(({ fn }) => useAutoRefresh(fn), { initialProps: { fn: first } }); rerender({ fn: second }); await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(first).toHaveBeenCalledTimes(0); expect(second).toHaveBeenCalledTimes(1);
    unmount(); await act(async () => { await vi.advanceTimersByTimeAsync(20000); window.dispatchEvent(new Event("focus")); }); expect(second).toHaveBeenCalledTimes(1);
  });
  it("a different interval can be asked for", async () => { const refresh = vi.fn(async () => {}); renderHook(() => useAutoRefresh(refresh, { intervalMs: 1000 })); await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); expect(refresh).toHaveBeenCalledTimes(3); });
});
