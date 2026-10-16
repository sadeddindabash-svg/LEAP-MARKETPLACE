// Test only (never imported by the app): jsdom has no IntersectionObserver, which the scrolling grid uses to notice the end of the list. This stands in for it: the test says
// when the end of the list comes into view (reveal), or says it is ALWAYS in view (a tall screen), exactly as a real browser reports it.
import { vi } from "vitest";

export function installFakeObserver({ alwaysVisible = false }: { alwaysVisible?: boolean } = {}) {
  const watchers: Array<{ callback: (entries: Array<{ isIntersecting: boolean }>) => void; disconnected: boolean }> = [];
  class FakeObserver {
    private watcher: { callback: (entries: Array<{ isIntersecting: boolean }>) => void; disconnected: boolean };
    constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { this.watcher = { callback, disconnected: false }; watchers.push(this.watcher); }
    observe() { if (alwaysVisible) queueMicrotask(() => { if (!this.watcher.disconnected) this.watcher.callback([{ isIntersecting: true }]); }); }   // a real browser reports once as soon as it watches
    disconnect() { this.watcher.disconnected = true; }
    unobserve() {}
    takeRecords() { return []; }
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return {
    /** The end of the list scrolls into view. */
    reveal() { const live = watchers.filter((w) => !w.disconnected); live[live.length - 1]?.callback([{ isIntersecting: true }]); },
    /** How many watchers are listening right now (0 when the list has ended). */
    listening: () => watchers.filter((w) => !w.disconnected).length,
  };
}
