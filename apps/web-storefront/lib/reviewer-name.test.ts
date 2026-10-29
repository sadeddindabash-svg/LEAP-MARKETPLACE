import { describe, expect, it } from "vitest";
import { maskReviewerName } from "./review";

describe("maskReviewerName: a reviewer's name is hidden on the product page", () => {
  it("shows the first 2 letters in capitals, ***, and the last 2", () => {
    expect(maskReviewerName("micheal")).toBe("MI***al");
    expect(maskReviewerName("michael")).toBe("MI***el");
    expect(maskReviewerName("Sarah")).toBe("SA***ah");
  });
  it("treats a full name as one (spaces ignored)", () => {
    expect(maskReviewerName("Mohammed Alharbi")).toBe("MO***bi");
    expect(maskReviewerName("  Ahmed  Ali ")).toBe("AH***li");
  });
  it("hides a short name (4 letters or fewer) almost completely", () => {
    expect(maskReviewerName("Ali")).toBe("A***");
    expect(maskReviewerName("omar")).toBe("O***");
    expect(maskReviewerName("x")).toBe("X***");
  });
  it("works for Arabic names", () => {
    expect(maskReviewerName("محمد العتيبي")).toBe("مح***بي");
    expect(maskReviewerName("علي")).toBe("ع***");
  });
  it("no name -> null, so the page shows 'Buyer'", () => {
    expect(maskReviewerName(null)).toBeNull();
    expect(maskReviewerName(undefined)).toBeNull();
    expect(maskReviewerName("")).toBeNull();
    expect(maskReviewerName("   ")).toBeNull();
  });
});
