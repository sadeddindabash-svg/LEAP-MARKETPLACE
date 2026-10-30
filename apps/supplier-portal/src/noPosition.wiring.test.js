import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Position is not required any more: My Drafts never asks for it or lists it as missing. Reads the source text.
describe("Position not required (supplier portal)", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  it("My Drafts has no Position field", () => {
    expect(app).not.toContain("draft.missing.includes('position')");
    expect(app).not.toContain("cascadeLabel('位置', 'Position')}>");
  });
});
