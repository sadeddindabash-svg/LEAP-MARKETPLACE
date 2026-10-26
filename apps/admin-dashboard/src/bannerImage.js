import { OUTPUT_W, OUTPUT_H } from "./bannerCrop";

/** Cuts the chosen part out of the picture and returns it as a 1250 x 500 JPEG (usually 80 to 250 KB). */
export function renderBannerCrop(image, rect) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_W; canvas.height = OUTPUT_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);          // a transparent PNG becomes white, not black, in a JPEG
  ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, OUTPUT_W, OUTPUT_H);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be prepared. Please try again."))), "image/jpeg", 0.88));
}
