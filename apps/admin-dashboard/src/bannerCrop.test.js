import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUTPUT_W, OUTPUT_H, FRAME_W, FRAME_H, MIN_SOURCE_W, MIN_SOURCE_H, MIN_ZOOM, MAX_ZOOM, baseScale, scaleFor, clampOffset, centeredOffset, zoomKeepingCentre, sourceRect } from './bannerCrop';

// Choosing the part of a picture that becomes a banner photo: a wide 5 : 2 frame, the picture always covering it.
describe('the sizes', () => {
  it('the saved photo is exactly what the server demands (1250 x 500), and the frame has the same shape (5 : 2)', () => {
    const server = readFileSync(join(__dirname, '../../../services/api/src/modules/platform-settings/homeBanner.js'), 'utf8');
    expect(Number(/const WIDTH_PX = (\d+)/.exec(server)[1])).toBe(OUTPUT_W); expect(Number(/HEIGHT_PX = (\d+)/.exec(server)[1])).toBe(OUTPUT_H); expect(FRAME_W / FRAME_H).toBe(OUTPUT_W / OUTPUT_H); expect(OUTPUT_W / OUTPUT_H).toBe(2.5);
  });
  it('a source picture must be big enough not to look blurry: at least 1000 x 400, which has the same shape', () => { expect(MIN_SOURCE_W / MIN_SOURCE_H).toBe(2.5); expect(MIN_SOURCE_W).toBeLessThanOrEqual(OUTPUT_W); });
});
describe('the picture covers the frame', () => {
  it('base scale: a wide picture is as tall as the frame, a tall picture as wide as the frame, a picture of the same shape fits exactly', () => {
    expect(baseScale(2000, 400)).toBe(0.5); expect(baseScale(1000, 2000)).toBe(0.5); expect(baseScale(1000, 400)).toBe(0.5); expect(baseScale(500, 200)).toBe(1); expect(scaleFor(500, 200, 2)).toBe(2);
  });
  it('the centred picture has no empty edge, and is centred along the side that is bigger than the frame', () => {
    const o = centeredOffset(2000, 800, 1); expect(o).toEqual({ x: 0, y: 0 });                           // same shape: exactly covers
    const tall = centeredOffset(1000, 2000, 1); expect(tall.x).toBe(0); expect(tall.y).toBe(-(2000 * 0.5 - 200) / 2);
    const wide = centeredOffset(4000, 800, 1); expect(wide.y).toBe(0); expect(wide.x).toBe((500 - 4000 * 0.25) / 2 === 0 ? 0 : -(4000 * 0.25 - 500) / 2);
  });
  it('dragging is stopped at the edges: never an empty strip on any side', () => {
    expect(clampOffset({ x: 50, y: 50 }, 2000, 800, 1)).toEqual({ x: 0, y: 0 }); expect(clampOffset({ x: -9999, y: -9999 }, 2000, 800, 2)).toEqual({ x: 500 - 2000 * 0.25 * 2, y: 200 - 800 * 0.25 * 2 }); expect(clampOffset({ x: -30, y: -20 }, 2000, 800, 2)).toEqual({ x: -30, y: -20 });
  });
  it('zooming keeps the middle of the frame on the same point of the picture', () => {
    const before = { x: -120, y: -40 }; const after = zoomKeepingCentre(before, 2000, 800, 2, 3); const centreBefore = [(250 - before.x) / scaleFor(2000, 800, 2), (100 - before.y) / scaleFor(2000, 800, 2)]; const centreAfter = [(250 - after.x) / scaleFor(2000, 800, 3), (100 - after.y) / scaleFor(2000, 800, 3)];
    expect(centreAfter[0]).toBeCloseTo(centreBefore[0], 6); expect(centreAfter[1]).toBeCloseTo(centreBefore[1], 6); const out = zoomKeepingCentre({ x: -500, y: -100 }, 2000, 800, 4, 1); expect(out).toEqual(clampOffset(out, 2000, 800, 1));
  });
  it('zoom goes from 1 to 4', () => { expect([MIN_ZOOM, MAX_ZOOM]).toEqual([1, 4]); });
});
describe('the chosen part, in the original picture\'s pixels', () => {
  it('is always 5 : 2, inside the picture, and smaller as you zoom in', () => {
    for (const [w, h, zoom, off] of [[2000, 800, 1, { x: 0, y: 0 }], [3000, 1500, 2, { x: -200, y: -150 }], [1000, 2000, 3, { x: -400, y: -900 }], [1250, 500, 1, { x: 0, y: 0 }]]) {
      const o = clampOffset(off, w, h, zoom); const r = sourceRect(o, w, h, zoom); expect(r.sw / r.sh).toBeCloseTo(2.5, 6); expect(r.sx).toBeGreaterThanOrEqual(-1e-9); expect(r.sy).toBeGreaterThanOrEqual(-1e-9); expect(r.sx + r.sw).toBeLessThanOrEqual(w + 1e-6); expect(r.sy + r.sh).toBeLessThanOrEqual(h + 1e-6);
    }
    expect(sourceRect({ x: 0, y: 0 }, 2000, 800, 2).sw).toBe(sourceRect({ x: 0, y: 0 }, 2000, 800, 1).sw / 2);
  });
  it('the whole picture at zoom 1 when it already has the shape', () => { expect(sourceRect({ x: 0, y: 0 }, 2500, 1000, 1)).toEqual({ sx: 0, sy: 0, sw: 2500, sh: 1000 }); });
});
