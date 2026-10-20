// The two standard "photo coming soon" pictures (150 x 150): one for categories, one for parts. An imported category or part points at one of them until a real photo is added
// (the existing photo upload on the Categories page replaces it, with no screen changing). They are copied once into the uploads folder under fixed names, so every screen
// that already shows a photo shows the placeholder without any change, and the admin can count how many items still have no real photo.
const fs = require('fs');
const path = require('path');
const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
const FILES = { category: 'placeholder-category.png', part: 'placeholder-part.png' };

/** Copies the two pictures into the uploads folder (when they are not there yet) and returns their addresses. */
function ensurePlaceholders() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const urls = {};
  for (const [kind, file] of Object.entries(FILES)) {
    const target = path.join(UPLOAD_DIR, file);
    if (!fs.existsSync(target)) fs.copyFileSync(path.join(__dirname, 'assets', file), target);
    urls[kind] = `/uploads/${file}`;
  }
  return urls;
}
/** True for a photo address that is one of the placeholders (or empty): the item has no real photo yet. */
const isPlaceholder = (url) => !url || Object.values(FILES).some((f) => String(url).endsWith(f));

module.exports = { ensurePlaceholders, isPlaceholder, FILES };
