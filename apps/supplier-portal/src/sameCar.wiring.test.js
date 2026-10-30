import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// One product per supplier + OE number + car: bulk upload asks with the batch's car. Reads the source text.
describe("Bulk upload: the same OE number for the same car", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const auth = readFileSync("src/auth.js", "utf8");
  it("the batch's car (with its versions) is sent with the OE numbers", () => {
    expect(auth).toContain("body: JSON.stringify({ names, oemNumbers, fitment }),");
    expect(app).toContain("items.map((it) => it.oemNumber), batchCar)");
  });
  it("a row for a car the product already has updates its price", () => {
    expect(app).toContain("Already yours for this car: price will be updated");
  });
});
