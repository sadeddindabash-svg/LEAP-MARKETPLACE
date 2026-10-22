// How a picture is matched to the catalog: by its CODE, taken from the file name. "BRK.jpg" is the section Brakes, "BRK-001.png" the part BRK-001 (capitals, small letters, "_" for "-" and spaces are all fine).
const CODE_RE = /^[A-Z][A-Z0-9]{1,5}(-\d{1,4})?$/;
function codeFromFileName(name) {
  const base = String(name || '').split(/[\\/]/).pop().replace(/\.[A-Za-z0-9]{2,5}$/, '');
  const code = base.trim().toUpperCase().replace(/[_\s]+/g, '-');
  return CODE_RE.test(code) ? code : null;
}
const isPartCode = (code) => code.includes('-');
/** Parts that are the same thing in different sizes (Engine Oil 1 L, 4 L, 5 L) share one picture: they have the same section and the same sub-category name. */
const groupKey = (sectionId, subcategory, name) => `${sectionId}|${String(subcategory || name || '').trim().toLowerCase()}`;
module.exports = { codeFromFileName, isPartCode, groupKey, CODE_RE };
