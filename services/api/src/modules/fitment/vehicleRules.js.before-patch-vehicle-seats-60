// The rules for the new vehicle fields, in one place, so the manual form and the Excel import cannot disagree. Pure functions (no database).
const OLDEST_YEAR = 1950;
const MAX_NAME_LENGTH = 120;
const MAX_ENGINE_LENGTH = 200;
const MIN_SEATS = 1;
const MAX_SEATS = 12;

/** Arabic-Indic and Persian digits become English digits (the project writes every year and number in English digits). */
function toEnglishDigits(text) {
  return String(text ?? '')
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

/** One line of plain text: control characters and runs of spaces/new lines become one space. */
function cleanLine(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** The key two names are compared by: capitals and extra spaces do not make two names different. */
function nameKey(value) {
  return cleanLine(value).toLowerCase();
}

/** A year as a whole number from OLDEST_YEAR to next year, or null. Accepts 2024, "2024", "٢٠٢٤". */
function parseYear(value) {
  const text = toEnglishDigits(typeof value === 'number' ? String(value) : value).trim();
  if (!/^\d{4}$/.test(text)) return null;
  const year = Number(text);
  return year >= OLDEST_YEAR && year <= new Date().getFullYear() + 1 ? year : null;
}

/** A whole number of seats from MIN_SEATS to MAX_SEATS, or null. Accepts 5, "5", "٥"; refuses 5.5, 0, 13, "five". */
function parseSeats(value) {
  const text = toEnglishDigits(typeof value === 'number' ? String(value) : value).trim();
  if (!/^\d{1,2}$/.test(text)) return null;
  const seats = Number(text);
  return seats >= MIN_SEATS && seats <= MAX_SEATS ? seats : null;
}

const VERSION_TEXT_FIELDS = [
  ['name', 'Version name (English)', MAX_NAME_LENGTH], ['nameAr', 'Version name (Arabic)', MAX_NAME_LENGTH], ['nameZh', 'Version name (Chinese)', MAX_NAME_LENGTH],
  ['engine', 'Engine (English)', MAX_ENGINE_LENGTH], ['engineAr', 'Engine (Arabic)', MAX_ENGINE_LENGTH], ['engineZh', 'Engine (Chinese)', MAX_ENGINE_LENGTH],
];

/** Checks the fields of a version. Returns { ok: true, value } with every text tidied, or { ok: false, error, field } naming the first thing wrong. */
function validateVersionFields(input) {
  const body = input && typeof input === 'object' ? input : {};
  const value = {};
  for (const [field, label, max] of VERSION_TEXT_FIELDS) {
    const text = cleanLine(body[field]);
    if (text === '') return { ok: false, field, error: `${field} is required (${label})` };
    if (text.length > max) return { ok: false, field, error: `${field} can be at most ${max} characters (${label})` };
    value[field] = text;
  }
  const seats = parseSeats(body.seats);
  if (seats === null) return { ok: false, field: 'seats', error: `seats must be a whole number from ${MIN_SEATS} to ${MAX_SEATS}` };
  value.seats = seats;
  return { ok: true, value };
}

/** A Chinese (or Arabic) name sent with a brand or model: a tidy non-empty line, or null when it was not sent. */
function optionalName(value) {
  if (value === undefined || value === null) return null;
  const text = cleanLine(value);
  return text === '' ? undefined : text;     // undefined = sent but blank: the caller refuses it
}

module.exports = { OLDEST_YEAR, MAX_NAME_LENGTH, MAX_ENGINE_LENGTH, MIN_SEATS, MAX_SEATS, toEnglishDigits, cleanLine, nameKey, parseYear, parseSeats, validateVersionFields, optionalName };
