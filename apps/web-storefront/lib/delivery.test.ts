import { describe, it, expect, vi, afterEach } from "vitest";
import { deliveryDateLabel, deliveryLine, SHOP_TIME_ZONE } from "./delivery";

// "Delivery: Oct. 29": today plus the estimated days, counted on the calendar of the shop's own time zone (Saudi time), the same for every visitor.
const at = (iso: string) => new Date(iso);
afterEach(() => { vi.useRealTimers(); });

describe("the delivery date", () => {
  it("is today plus the days: 7 days from 22 October is Oct. 29 (English) and 29 أكتوبر (Arabic)", () => {
    const now = at("2026-10-22T09:00:00Z"); expect(deliveryDateLabel(7, "en", now)).toBe("Oct. 29"); expect(deliveryDateLabel(7, "ar", now)).toBe("29 أكتوبر");
  });
  it("0 days is today; fractions round to the nearest day", () => { const now = at("2026-10-22T09:00:00Z"); expect(deliveryDateLabel(0, "en", now)).toBe("Oct. 22"); expect(deliveryDateLabel(2.6, "en", now)).toBe("Oct. 25"); expect(deliveryDateLabel(2.4, "en", now)).toBe("Oct. 24"); });
  it("goes over the end of a month, a year and a leap February correctly", () => {
    expect(deliveryDateLabel(7, "en", at("2026-10-28T09:00:00Z"))).toBe("Nov. 4"); expect(deliveryDateLabel(5, "en", at("2026-12-28T09:00:00Z"))).toBe("Jan. 2");
    expect(deliveryDateLabel(3, "en", at("2028-02-27T09:00:00Z"))).toBe("Mar. 1"); expect(deliveryDateLabel(3, "en", at("2027-02-27T09:00:00Z"))).toBe("Mar. 2");
    expect(deliveryDateLabel(40, "en", at("2026-12-20T09:00:00Z"))).toBe("Jan. 29");
  });
  it("uses the SHOP's calendar (Saudi time, 3 hours ahead of UTC), not the server's or the visitor's: just after midnight in Riyadh it is already the next day", () => {
    expect(SHOP_TIME_ZONE).toBe("Asia/Riyadh");
    expect(deliveryDateLabel(0, "en", at("2026-10-22T20:59:59Z"))).toBe("Oct. 22");           // 23:59:59 in Riyadh
    expect(deliveryDateLabel(0, "en", at("2026-10-22T21:00:00Z"))).toBe("Oct. 23");           // midnight in Riyadh
    expect(deliveryDateLabel(7, "en", at("2026-10-22T22:30:00Z"))).toBe("Oct. 30");           // 01:30 on the 23rd in Riyadh
  });
  it("every month has its own English and Arabic name (May has no full stop)", () => {
    const en = new Set<string>(); const ar = new Set<string>(); for (let m = 0; m < 12; m++) { const now = at(new Date(Date.UTC(2026, m, 10, 9)).toISOString()); en.add(deliveryDateLabel(0, "en", now)!.split(" ")[0]); ar.add(deliveryDateLabel(0, "ar", now)!.split(" ")[1]); }
    expect(en.size).toBe(12); expect(ar.size).toBe(12); expect(deliveryDateLabel(0, "en", at("2026-05-05T09:00:00Z"))).toBe("May 5"); expect(deliveryDateLabel(0, "ar", at("2026-01-05T09:00:00Z"))).toBe("5 يناير");
  });
  it("is nothing when there is no estimate (or a nonsense one)", () => { for (const d of [null, undefined, NaN, Infinity, -1]) expect(deliveryDateLabel(d as never, "en")).toBeNull(); });
  it("uses today's real date when no date is given", () => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(at("2026-10-22T09:00:00Z")); expect(deliveryDateLabel(7, "en")).toBe("Oct. 29"); vi.setSystemTime(at("2026-10-23T09:00:00Z")); expect(deliveryDateLabel(7, "en")).toBe("Oct. 30"); });
});
describe("the delivery line", () => {
  it("says \"Delivery: Oct. 29\" in English and \"التسليم: 29 أكتوبر\" in Arabic, and nothing without an estimate", () => {
    const now = at("2026-10-22T09:00:00Z"); expect(deliveryLine(7, "en", now)).toBe("Delivery: Oct. 29"); expect(deliveryLine(7, "ar", now)).toBe("التسليم: 29 أكتوبر"); expect(deliveryLine(null, "en", now)).toBeNull(); expect(deliveryLine(undefined, "ar", now)).toBeNull();
  });
});
