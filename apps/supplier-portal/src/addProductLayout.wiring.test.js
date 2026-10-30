import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Add product, the approved layout. Reads the source text.
describe("Add product layout", () => {
  const app = readFileSync("src/App.jsx", "utf8");
  const picker = readFileSync("src/VehiclePicker.jsx", "utf8");
  const ship = readFileSync("src/PartShippingBlock.jsx", "utf8");
  it("Vehicle Fitment: Brand, Model and Year side by side, the versions under them, as tall as the photo", () => {
    expect(picker).toContain('{ display: "flex", gap: 12 }');
    expect(picker).toContain("height: photoSize + 24");
    expect(picker).toContain('data-testid="picker-versions"');
    expect(app).toContain("<VehiclePicker cascade={cascade}>");
  });
  it("Product Details: three fields per line, the 320 x 320 Weight and size box beside them", () => {
    expect(app).toContain('gridTemplateColumns: "minmax(0, 1fr) 320px"');
    expect(app).toContain('gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16');
    expect(app).toContain('data-testid="weight-size-square" style={{ width: 320, height: 320');
    expect(app).toContain("<PartShippingBlock part={selectedPart} shipping={partShipping} square />");
    expect(ship).toContain("square = false");
  });
  it("Photos and video on one line", () => {
    expect(app).toContain('data-testid="photos-video-row"');
  });
});
