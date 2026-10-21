import { OUTPUT_PX } from "./homePictureCrop";

// The two things the crop step needs from the browser (kept apart so the screen can be tested without a real canvas).
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Reads a chosen file as a picture: { image, url, width, height }. Rejects with a message the admin can act on. */
export async function loadImageFile(file) {
  if (!file || !ALLOWED_TYPES.includes(file.type)) throw new Error("Please choose a JPG, PNG or WebP picture.");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("This file could not be read as a picture. Please choose another."));
      img.src = url;
    });
    return { image, url, width: image.naturalWidth, height: image.naturalHeight };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

/** Cuts the chosen square out of the picture and returns it as a 600 x 600 JPEG (usually 60 to 150 KB). */
export function renderCrop(image, rect) {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_PX; canvas.height = OUTPUT_PX;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, OUTPUT_PX, OUTPUT_PX);          // a transparent PNG becomes white, not black, in a JPEG
  ctx.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, OUTPUT_PX, OUTPUT_PX);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be prepared. Please try again."))), "image/jpeg", 0.88));
}
