import { describe, it, expect, afterEach, vi } from "vitest";
import { fetchAnnouncements } from "./api";

afterEach(() => vi.unstubAllGlobals());
const answer = (body: unknown, ok = true) => vi.stubGlobal("fetch", vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response));

describe("reading the home page's announcements", () => {
  it("returns what the shop says, with an empty Arabic text where there is none", async () => {
    answer({ announcements: [{ en: "A", ar: "ا" }, { en: "B" }], max: 5 });
    expect(await fetchAnnouncements()).toEqual([{ en: "A", ar: "ا" }, { en: "B", ar: "" }]);
  });
  it("CRITICAL: anything wrong means NO bar and never an error: the shop unreachable, an error answer, an odd answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    expect(await fetchAnnouncements()).toEqual([]);
    answer({}, false);
    expect(await fetchAnnouncements()).toEqual([]);
    for (const odd of [{}, { announcements: "text" }, null, { announcements: [null, { en: "" }, { ar: "x" }, { en: 5 }] }]) {
      answer(odd);
      expect(await fetchAnnouncements(), JSON.stringify(odd)).toEqual([]);
    }
  });
  it("CRITICAL: the website asks again at least every 30 seconds, so an admin's change shows within seconds (the list of products is cached much longer, this tiny setting is not)", async () => {
    answer({ announcements: [{ en: "A", ar: "" }] });
    await fetchAnnouncements();
    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as { next?: { revalidate?: number } };
    expect(init.next?.revalidate).toBeGreaterThan(0);
    expect(init.next?.revalidate).toBeLessThanOrEqual(30);
  });

  it("asks for the public list (no sign-in) and never takes more than 5", async () => {
    answer({ announcements: Array.from({ length: 9 }, (_, i) => ({ en: `L${i}`, ar: "" })) });
    expect(await fetchAnnouncements()).toHaveLength(5);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).toMatch(/\/platform-settings\/announcements$/);
    expect((init as RequestInit & { headers?: unknown }).headers).toBeUndefined();
  });
});
