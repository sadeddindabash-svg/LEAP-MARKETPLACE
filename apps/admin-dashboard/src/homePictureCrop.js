// The crop step of "Home page pictures": the buyer-facing tiles are square, so the admin picks the square part of any picture. All the arithmetic is here (pure functions, tested on their own).
//   The frame is FRAME_PX wide and tall on the screen. At zoom 1 the picture's SHORTER side exactly fills the frame; zooming in makes it bigger. `offset` is where the picture's top-left corner
//   is, in frame pixels (0,0 = flush with the frame's top-left; it can only be 0 or negative, so the frame never shows empty space).
export const OUTPUT_PX = 600;       // the picture that is saved: 600 x 600
export const MIN_SOURCE_PX = 400;   // the chosen picture must be at least this big on both sides (smaller ones would look blurry)
export const FRAME_PX = 280;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
/** Screen pixels per picture pixel at zoom 1. */
export const baseScale = (width, height, frame = FRAME_PX) => frame / Math.min(width, height);
export const scaleFor = (width, height, zoom, frame = FRAME_PX) => baseScale(width, height, frame) * zoom;

/** Keeps the picture covering the whole frame. */
export function clampOffset(offset, width, height, zoom, frame = FRAME_PX) {
  const s = scaleFor(width, height, zoom, frame);
  return { x: clamp(offset.x, Math.min(0, frame - width * s), 0), y: clamp(offset.y, Math.min(0, frame - height * s), 0) };
}
/** The picture centred in the frame (where the crop starts). */
export function centeredOffset(width, height, zoom, frame = FRAME_PX) {
  const s = scaleFor(width, height, zoom, frame);
  return clampOffset({ x: (frame - width * s) / 2, y: (frame - height * s) / 2 }, width, height, zoom, frame);
}
/** Changes the zoom so that whatever is in the middle of the frame stays in the middle. */
export function zoomKeepingCentre(offset, width, height, oldZoom, newZoom, frame = FRAME_PX) {
  const before = scaleFor(width, height, oldZoom, frame); const after = scaleFor(width, height, newZoom, frame);
  const cx = (frame / 2 - offset.x) / before; const cy = (frame / 2 - offset.y) / before;
  return clampOffset({ x: frame / 2 - cx * after, y: frame / 2 - cy * after }, width, height, newZoom, frame);
}
/** The square that the frame shows, in the ORIGINAL picture's pixels: { sx, sy, size }. It never leaves the picture. */
export function sourceRect(offset, width, height, zoom, frame = FRAME_PX) {
  const s = scaleFor(width, height, zoom, frame); const size = Math.min(frame / s, width, height);
  return { sx: clamp(-offset.x / s, 0, width - size), sy: clamp(-offset.y / s, 0, height - size), size };
}
