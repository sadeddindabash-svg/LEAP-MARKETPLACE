import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Catalog moderation: a reject asks for its reasons (one product, and the selected ones). Reads the source text.
describe("Reject with a reason", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("Reject opens the reasons instead of rejecting at once", () => {
    expect(app).toContain("onClick={() => { setReviewingId(null); setRejectingId(m.id); }}");
    expect(app).not.toContain('moderateProduct(getStoredToken(), productId, "reject");');
  });
  it("the reasons go with the reject, for one and for the selected", () => {
    expect(app).toContain("rejectionReasons: reasons");
    expect(app).toContain('action: "reject", rejectionReasons: reasons');
    expect(app).toContain("onClick={() => setBulkRejecting(true)}");
  });
  it("the list of reasons", () => {
    for (const k of ["wrong_category", "wrong_photos", "wrong_part", "wrong_fitment", "wrong_oe", "wrong_price", "unclear_text", "duplicate", "other"]) expect(app).toContain(`"${k}"`);
  });
});
