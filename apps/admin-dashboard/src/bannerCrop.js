// Choosing the part of a picture that becomes a banner photo: a wide frame (5 : 2, the shape of the box it fills on the home page). The picture covers the whole frame; it can be dragged and zoomed, never left with an empty edge.
// `offset` is where the picture's top-left corner is, in frame pixels (0 or negative); the saved photo is the part of the original inside the frame, resized to 1250 x 500.
export const OUTPUT_W = 1250;
export const OUTPUT_H = 500;           // the photo that is saved: 1250 x 500 (the server insists on exactly this)
export const FRAME_W = 500;
export const FRAME_H = 200;            // the frame on screen: the same shape (5 : 2)
export const MIN_SOURCE_W = 1000;
export const MIN_SOURCE_H = 400;       // a smaller picture would look blurry when stretched to 1250 x 500
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** The size at which the picture just covers the frame. */
export const baseScale = (width, height) => Math.max(FRAME_W / width, FRAME_H / height);
export const scaleFor = (width, height, zoom) => baseScale(width, height) * zoom;
/** Keeps the picture covering the frame: no empty edge on any side. */
export function clampOffset(offset, width, height, zoom) {
  const s = scaleFor(width, height, zoom);
  return { x: Math.min(0, Math.max(FRAME_W - width * s, offset.x)), y: Math.min(0, Math.max(FRAME_H - height * s, offset.y)) };
}
export function centeredOffset(width, height, zoom) {
  const s = scaleFor(width, height, zoom);
  return clampOffset({ x: (FRAME_W - width * s) / 2, y: (FRAME_H - height * s) / 2 }, width, height, zoom);
}
/** After zooming, the point of the picture that was in the middle of the frame stays in the middle. */
export function zoomKeepingCentre(offset, width, height, oldZoom, newZoom) {
  const before = scaleFor(width, height, oldZoom); const after = scaleFor(width, height, newZoom);
  const cx = (FRAME_W / 2 - offset.x) / before; const cy = (FRAME_H / 2 - offset.y) / before;
  return clampOffset({ x: FRAME_W / 2 - cx * after, y: FRAME_H / 2 - cy * after }, width, height, newZoom);
}
/** The chosen part, in the ORIGINAL picture's pixels. */
export function sourceRect(offset, width, height, zoom) {
  const s = scaleFor(width, height, zoom);
  return { sx: (0 - offset.x) / s, sy: (0 - offset.y) / s, sw: FRAME_W / s, sh: FRAME_H / s };          // (0 - x, not -x: so an offset of 0 gives 0, not minus zero)
}
