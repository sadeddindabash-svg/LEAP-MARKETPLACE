// The Categories > Photos import, the parts that decide things (so they can be tested without a screen): reading a code from a file name, working out the STATUS of every picture before anything is saved, and cutting the
// pictures into batches. The same rules as the shop (services/api/src/modules/catalogPhotos): the shop checks everything again.
export const PHOTO_PX = 512;
export const MIN_SOURCE_PX = 400;       // a picture whose shortest side is smaller is too small to look good at 512
export const BATCH_SIZE = 20;           // pictures sent to the shop at a time (it accepts up to 40)
const CODE_RE = /^[A-Z][A-Z0-9]{1,5}(-\d{1,4})?$/;

export function codeFromFileName(name) {
  const base = String(name || "").split(/[\\/]/).pop().replace(/\.[A-Za-z0-9]{2,5}$/, "");
  const code = base.trim().toUpperCase().replace(/[_\s]+/g, "-");
  return CODE_RE.test(code) ? code : null;
}
/**
 * items: [{ file: "BRK-001.jpg", width, height, error? }] (what was read from each picture); coverage: what the shop sent (sections, parts with their `group`); replace: change real pictures too.
 * Gives each item a status: new | replaces | kept | unknown_code | bad_name | not_image | too_small | duplicate, and `applies` (the codes that would get the picture).
 */
export function classify(items, coverage, replace) {
  const sections = new Map(coverage.sections.map((s) => [s.code, s]));
  const parts = new Map(coverage.parts.map((p) => [p.code, p]));
  const byGroup = new Map();
  for (const p of coverage.parts) { if (!byGroup.has(p.group)) byGroup.set(p.group, []); byGroup.get(p.group).push(p); }
  const seen = new Set();
  return items.map((it) => {
    const code = codeFromFileName(it.file);
    const out = { ...it, code, status: null, applies: [] };
    if (!code) { out.status = "bad_name"; return out; }
    if (it.error) { out.status = "not_image"; return out; }
    if (seen.has(code)) { out.status = "duplicate"; return out; }
    seen.add(code);
    if (Math.min(it.width, it.height) < MIN_SOURCE_PX) { out.status = "too_small"; return out; }
    const targets = sections.has(code) ? [sections.get(code)] : parts.has(code) ? byGroup.get(parts.get(code).group) : null;
    if (!targets) { out.status = "unknown_code"; return out; }
    const change = targets.filter((t) => replace || !t.hasPhoto);
    if (change.length === 0) { out.status = "kept"; return out; }
    out.applies = change.map((t) => t.code);
    out.status = change.some((t) => t.hasPhoto) ? "replaces" : "new";
    return out;
  });
}
export const WILL_SAVE = ["new", "replaces"];
export const PROBLEMS = ["bad_name", "not_image", "too_small", "duplicate", "unknown_code"];
export const LABELS = { new: "new", replaces: "replaces a picture", kept: "has a picture: kept", unknown_code: "no such code", bad_name: "name is not a code", not_image: "not a picture", too_small: "too small", duplicate: "same code twice" };
/** { willSave, kept, problems } for the line above the preview. */
export const tally = (items) => ({ willSave: items.filter((i) => WILL_SAVE.includes(i.status)).length, kept: items.filter((i) => i.status === "kept").length, problems: items.filter((i) => PROBLEMS.includes(i.status)).length });
export function inBatches(list, size = BATCH_SIZE) { const out = []; for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size)); return out; }
/** The new random id of one import (all its batches share it, so one Undo undoes all of them). */
export const newBatchId = () => `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// ---- in the browser: read a picture, cut the centre square, save it at 512 x 512 as a JPEG (a transparent background becomes white)
export async function prepareImage(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap; const side = Math.min(width, height);
    const canvas = document.createElement("canvas"); canvas.width = PHOTO_PX; canvas.height = PHOTO_PX;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, PHOTO_PX, PHOTO_PX); ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, (width - side) / 2, (height - side) / 2, side, side, 0, 0, PHOTO_PX, PHOTO_PX);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The picture could not be prepared"))), "image/jpeg", 0.86));
    return { width, height, blob };
  } finally { bitmap.close?.(); }
}
