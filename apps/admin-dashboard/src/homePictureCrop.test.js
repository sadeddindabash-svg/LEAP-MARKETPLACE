import { describe, it, expect } from "vitest";
import { OUTPUT_PX, MIN_SOURCE_PX, FRAME_PX, baseScale, clampOffset, centeredOffset, zoomKeepingCentre, sourceRect } from "./homePictureCrop";

// The arithmetic of the crop step. A 3000 x 2000 picture in a 280 px frame: at zoom 1 the shorter side (2000) fills the frame, so one picture pixel is 0.14 screen pixels.
const near = (o, x, y) => { expect(o.x).toBeCloseTo(x, 6); expect(o.y).toBeCloseTo(y, 6); };
describe("the crop arithmetic", () => {
  it("the saved picture is 600 x 600 and a chosen picture must be at least 400 x 400", () => { expect(OUTPUT_PX).toBe(600); expect(MIN_SOURCE_PX).toBe(400); });
  it("at zoom 1 the shorter side exactly fills the frame", () => {
    expect(baseScale(3000, 2000)).toBeCloseTo(0.14, 6); expect(baseScale(2000, 3000)).toBeCloseTo(0.14, 6); expect(3000 * baseScale(3000, 2000)).toBeCloseTo(420, 6);
  });
  it("starts centred: a wide picture is centred sideways, a tall one up and down, a square one needs no moving", () => {
    near(centeredOffset(3000, 2000, 1), -70, 0);
    const tall = centeredOffset(2000, 3000, 1); expect(tall.x).toBeCloseTo(0, 6); expect(tall.y).toBeCloseTo(-70, 6);
    near(centeredOffset(1000, 1000, 1), 0, 0);
  });
  it("the crop at zoom 1 is the biggest centred square: 2000 x 2000 of a 3000 x 2000 picture", () => {
    const r = sourceRect(centeredOffset(3000, 2000, 1), 3000, 2000, 1); expect(r.size).toBeCloseTo(2000, 4); expect(r.sx).toBeCloseTo(500, 4); expect(r.sy).toBeCloseTo(0, 4);
  });
  it("zooming in makes the crop smaller: zoom 2 takes a 1000 x 1000 square from the middle, zoom 4 a 500 x 500", () => {
    const c2 = sourceRect(centeredOffset(3000, 2000, 2), 3000, 2000, 2); expect(c2.size).toBeCloseTo(1000, 4); expect(c2.sx).toBeCloseTo(1000, 4); expect(c2.sy).toBeCloseTo(500, 4);
    expect(sourceRect(centeredOffset(3000, 2000, 4), 3000, 2000, 4).size).toBeCloseTo(500, 4);
  });
  it("the picture can never be dragged off the frame: no empty space on any side", () => {
    near(clampOffset({ x: 50, y: 50 }, 3000, 2000, 1), 0, 0);                     // dragged right/down too far
    near(clampOffset({ x: -5000, y: -5000 }, 3000, 2000, 1), -140, 0);            // dragged left too far (420 - 280 = 140); no room up/down at zoom 1
    near(clampOffset({ x: -5000, y: -5000 }, 3000, 2000, 2), -560, -280);
  });
  it("zooming keeps whatever is in the middle of the frame in the middle", () => {
    const off = { x: -100, y: -40 }; const centre = (o, z) => { const s = baseScale(3000, 2000) * z; return [(FRAME_PX / 2 - o.x) / s, (FRAME_PX / 2 - o.y) / s]; };
    const after = zoomKeepingCentre(off, 3000, 2000, 2, 3); const [bx, by] = centre(off, 2); const [ax, ay] = centre(after, 3);
    expect(ax).toBeCloseTo(bx, 4); expect(ay).toBeCloseTo(by, 4);
  });
  it("zooming back out to 1 puts the picture back inside the frame", () => {
    const out = zoomKeepingCentre({ x: -560, y: -280 }, 3000, 2000, 2, 1); const again = clampOffset(out, 3000, 2000, 1); near(out, again.x, again.y);
  });
  it("whatever the picture, zoom and drag, the crop square always lies inside the picture and is never bigger than it", () => {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 400; i++) {
      const w = 400 + Math.floor(rnd() * 5000); const h = 400 + Math.floor(rnd() * 5000); const zoom = 1 + rnd() * 3;
      const off = clampOffset({ x: (rnd() - 1) * 6000, y: (rnd() - 1) * 6000 }, w, h, zoom); const r = sourceRect(off, w, h, zoom);
      expect(r.sx).toBeGreaterThanOrEqual(0); expect(r.sy).toBeGreaterThanOrEqual(0); expect(r.sx + r.size).toBeLessThanOrEqual(w + 1e-6); expect(r.sy + r.size).toBeLessThanOrEqual(h + 1e-6); expect(r.size).toBeLessThanOrEqual(Math.min(w, h) + 1e-6);
    }
  });
});
