import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DICTIONARIES } from "@/lib/i18n";

// Proof of delivery for the buyer (migration 120): the order page shows the code for the driver, the attempt notice and "This isn't my parcel".
describe("order page: delivery code and proof (wiring)", () => {
  const page = readFileSync(join(__dirname, "orders", "[id]", "page.tsx"), "utf8");
  it("shows the code only while it is on its way, and the report button with the proof", () => {
    expect(page).toContain('data-testid="delivery-code"');
    expect(page).toContain("so.hubShipment?.deliveryCode");
    expect(page).toContain('data-testid="not-my-parcel"');
    expect(page).toContain("createSupportTicket(");
  });
  it("every new text has English and Arabic", () => {
    for (const key of ["delivery_code_title", "delivery_code_text", "delivery_attempt_not_home", "delivery_attempt_wrong_address", "delivery_attempt_refused", "delivery_attempt_other", "received_by_line", "received_with_code", "not_my_parcel", "not_my_parcel_sent"] as const) {
      expect(DICTIONARIES.en[key]).toBeTruthy();
      expect(DICTIONARIES.ar[key]).toMatch(/[\u0600-\u06FF]/);
    }
  });
});
