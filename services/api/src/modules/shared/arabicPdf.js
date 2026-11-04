/**
 * Arabic in PDFKit, the same on every computer: the letters JOINED and the words RIGHT TO LEFT, whatever PDFKit / fontkit version is installed
 * and whether or not it shapes Arabic itself.
 *   1. arabic-reshaper turns the letters into their joined forms (the Arabic presentation forms: one character per joined shape);
 *   2. bidi-js puts the line in VISUAL order (right to left, with numbers and Latin kept the right way round);
 *   3. each character is then drawn on its own, left to right, at its own width -- so nothing can be re-shaped, reversed or split into words again.
 * The font must have the presentation forms (Noto Sans Arabic does).
 */
const ArabicReshaper = require('arabic-reshaper');
const bidi = require('bidi-js')();

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

/** The line as it must be drawn, left to right. */
function visualArabic(text) {
  const shaped = ArabicReshaper.convertArabic(String(text));
  const levels = bidi.getEmbeddingLevels(shaped, 'rtl');
  let out = bidi.getReorderedString(shaped, levels);
  // brackets in right-to-left runs are shown mirrored, as in any Arabic text
  const mirrors = bidi.getMirroredCharactersMap ? bidi.getMirroredCharactersMap(shaped, levels) : null;
  if (mirrors && mirrors.size) {
    const chars = [...shaped];
    for (const [i, ch] of mirrors) chars[i] = ch;
    out = bidi.getReorderedString(chars.join(''), levels);
  }
  return out;
}

/** Width of a line in the current font and size. */
function arabicWidth(doc, text) {
  let w = 0;
  for (const ch of visualArabic(text)) w += doc.widthOfString(ch);
  return w;
}

/**
 * Draws one line (no wrapping) in the current font and size. options: { width, align: 'left' | 'center' | 'right' }. Returns its width.
 * Pick the font (doc.font(...).fontSize(...).fillColor(...)) before calling.
 */
function drawArabic(doc, text, x, y, { width, align = 'right' } = {}) {
  const chars = [...visualArabic(text)];
  const widths = chars.map((ch) => doc.widthOfString(ch));
  const total = widths.reduce((s, n) => s + n, 0);
  let cx = x;
  if (width && align === 'right') cx = x + width - total;
  else if (width && align === 'center') cx = x + (width - total) / 2;
  chars.forEach((ch, i) => {
    if (ch !== ' ') doc.text(ch, cx, y, { lineBreak: false });
    cx += widths[i];
  });
  return total;
}

module.exports = { ARABIC, visualArabic, arabicWidth, drawArabic };
