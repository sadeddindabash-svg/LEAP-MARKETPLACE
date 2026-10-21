export { loadImageFile } from "./homePictureImage";

// A social media icon is saved as a 256 x 256 PNG (a PNG keeps a logo's transparent corners). The chosen picture must be at least 128 x 128 px.
export const ICON_PX = 256;
export const ICON_MIN_PX = 128;
export function renderIcon(image, rect) {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_PX; canvas.height = ICON_PX;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, ICON_PX, ICON_PX);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be prepared. Please try again."))), "image/png"));
}
