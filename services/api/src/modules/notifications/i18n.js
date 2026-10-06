/**
 * Language helpers for notifications (migration 093).
 *
 * A notification is stored once with an English text (`title`, `body`) and, where one exists, an Arabic text
 * (`title_ar`, `body_ar`). Whoever reads it asks for a language and gets that language's text, falling back to
 * English FIELD BY FIELD: a notification whose Arabic title exists but whose Arabic body does not still shows
 * the Arabic title and the English body, never a blank. This file has no database dependency on purpose, so
 * the same rule is used by the API, by push delivery and by the tests.
 */

const SUPPORTED = ['en', 'ar'];

// Anything that is not exactly 'ar' is English. An unknown or missing language must never break a request.
function normalizeLanguage(value) {
  return value === 'ar' ? 'ar' : 'en';
}

// Whether the caller actually SAID which language it wants (as opposed to us defaulting to English).
function isSupportedLanguage(value) {
  return SUPPORTED.includes(value);
}

// Picks the text for `lang` from anything shaped { title, body, titleAr, bodyAr }.
function localize({ title, body, titleAr, bodyAr }, lang) {
  if (normalizeLanguage(lang) === 'ar') return { title: titleAr || title, body: bodyAr || body };
  return { title, body };
}

// ---- Arabic wording of numbers (Arabic changes the noun's form with the number) ----

// A duration in years as the OBJECT of "for": عام / عامين / 3 أعوام / 12 عامًا
function arabicYearsDuration(years) {
  if (years === 1) return 'عام';
  if (years === 2) return 'عامين';
  if (years >= 3 && years <= 10) return `${years} أعوام`;
  return `${years} عامًا`;
}

// "N new results": نتيجة جديدة واحدة / نتيجتان جديدتان / 3 نتائج جديدة / 12 نتيجة جديدة
function arabicNewResults(count) {
  if (count === 1) return 'نتيجة جديدة واحدة';
  if (count === 2) return 'نتيجتان جديدتان';
  if (count >= 3 && count <= 10) return `${count} نتائج جديدة`;
  return `${count} نتيجة جديدة`;
}

// Arabic wording of a return case's status, using the same words the mobile app already uses for these statuses.
const RETURN_STATUS_AR = {
  awaiting: 'قيد المراجعة',
  in_progress: 'قيد التنفيذ',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  completed: 'مكتمل',
};
function arabicReturnStatus(status) {
  return RETURN_STATUS_AR[status] || status;
}

module.exports = { normalizeLanguage, isSupportedLanguage, localize, arabicYearsDuration, arabicNewResults, arabicReturnStatus, RETURN_STATUS_AR };
