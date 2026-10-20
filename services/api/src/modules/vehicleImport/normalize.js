// Some programs (for example ones built on Microsoft's Open XML SDK) write a perfectly valid .xlsx whose XML tags carry a PREFIX for the main spreadsheet namespace:
//   <x:workbook xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheets>...      instead of Excel's      <workbook xmlns="..."><sheets>...
// Excel, LibreOffice and most tools read both. The library used here (exceljs) only understands Excel's style and fails on the other with a vague error.
// This rewrites such a file IN MEMORY into Excel's style (the uploaded file itself is never changed): each part that uses a prefix for that namespace gets its prefix removed
// and the namespace made the default one. Parts that are already in Excel's style, and every other namespace (drawings, relationships), are left exactly as they are.
const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

/** Rewrites one XML text. Returns it unchanged when it does not use a prefix for the main namespace (or uses it in a way this cannot rewrite safely). */
function unprefixMainNamespace(xml) {
  const root = xml.match(/<(\w+):\w+[^>]*\sxmlns:(\w+)="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/);
  if (!root) return xml;
  const prefix = root[2];
  if (/<\w+[^>]*\sxmlns="/.test(xml.slice(0, 600))) return xml;                              // it already has a default namespace: not this case
  if (new RegExp(`\\s${prefix}:\\w+=`).test(xml)) return xml;                                // the prefix is also used on attributes: leave it alone rather than break it
  return xml
    .replace(new RegExp(`\\sxmlns:${prefix}="${MAIN_NS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), ` xmlns="${MAIN_NS}"`)
    .replace(new RegExp(`<(/?)${prefix}:`, 'g'), '<$1');
}

/** Returns a new package (a Buffer) with such parts rewritten, or null when nothing needed rewriting or the package cannot be read. */
async function normalizeWorkbookPackage(buffer) {
  let JSZip;
  try { JSZip = require('jszip'); } catch { return null; }                                     // not installed: the caller keeps its own error
  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch { return null; }
  let changed = 0;
  for (const name of Object.keys(zip.files)) {
    if (zip.files[name].dir || !/^xl\/.*\.xml$/.test(name) || name.startsWith('xl/drawings/')) continue;
    const before = await zip.file(name).async('string');
    const after = unprefixMainNamespace(before.replace(/^\uFEFF/, ''));
    if (after !== before.replace(/^\uFEFF/, '')) { zip.file(name, after); changed++; }
  }
  if (changed === 0) return null;
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { normalizeWorkbookPackage, unprefixMainNamespace };
