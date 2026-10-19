// The home page's moving announcement line: what an admin may save, and how what is stored is read back. Pure functions (no database), so they are tested on their own.
const MAX_ANNOUNCEMENTS = 5;
const MAX_LENGTH = 150;

// One line of plain text: control characters and runs of spaces/newlines become one space. (The website shows it as text, never as HTML.)
const clean = (value) => String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Checks what the admin sent. Returns { ok: true, value: [{ en, ar }] } or { ok: false, error }. English is required; Arabic may be empty (the Arabic site then shows the English). */
function validateAnnouncements(input) {
  if (!Array.isArray(input)) return { ok: false, error: 'announcements must be a list' };
  if (input.length > MAX_ANNOUNCEMENTS) return { ok: false, error: `You can have up to ${MAX_ANNOUNCEMENTS} announcements` };
  const value = [];
  for (const item of input) {
    if (!item || typeof item !== 'object' || typeof item.en !== 'string') return { ok: false, error: 'Each announcement needs English text' };
    if (item.ar !== undefined && typeof item.ar !== 'string') return { ok: false, error: 'The Arabic text must be text' };
    const en = clean(item.en);
    const ar = item.ar === undefined ? '' : clean(item.ar);
    if (en === '') return { ok: false, error: 'Each announcement needs English text' };
    if (en.length > MAX_LENGTH || ar.length > MAX_LENGTH) return { ok: false, error: `Each announcement can be at most ${MAX_LENGTH} characters` };
    value.push({ en, ar });
  }
  return { ok: true, value };
}

/** Reads the stored value back. Anything damaged or unexpected is treated as "no announcements", never as an error (the home page must always load). */
function parseStored(raw) {
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((x) => x && typeof x.en === 'string' && x.en.trim() !== '')
      .map((x) => ({ en: x.en.trim(), ar: typeof x.ar === 'string' ? x.ar.trim() : '' }))
      .slice(0, MAX_ANNOUNCEMENTS);
  } catch {
    return [];
  }
}

module.exports = { MAX_ANNOUNCEMENTS, MAX_LENGTH, validateAnnouncements, parseStored };
