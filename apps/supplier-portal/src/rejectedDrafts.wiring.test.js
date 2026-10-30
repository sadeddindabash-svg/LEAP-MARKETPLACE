import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// My Drafts (Not published): the products Leap rejected, with why, fixed and resubmitted. Reads the source text.
describe("Rejected products in My Drafts", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("All / Rejected / Needs completion", () => {
    expect(app).toContain('data-testid="drafts-filter"');
    expect(app).toContain("filter === 'rejected' ? d.rejected : !d.rejected");
  });
  it("a rejected product shows its reasons and note, in Chinese or English", () => {
    expect(app).toContain("rejectionReasonsText(d.rejectionReasons, lang)");
    expect(app).toContain('wrong_category: { zh: "分类错误", en: "Wrong category" }');
  });
  it("it is fixed and sent back for review", () => {
    expect(app).toContain("resubmitRejectedProduct(getStoredToken(), draft.id");
    expect(app).toContain("cascadeLabel('修改并重新提交', 'Fix and resubmit')");
  });
});
