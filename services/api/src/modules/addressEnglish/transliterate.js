/**
 * Arabic -> English for DELIVERY ADDRESSES (migration 094).
 *
 * WHY: the people at the inspection hub cannot read Arabic, but a buyer may type their address in Arabic. The hub needs an
 * English version to ship to and to print on the label.
 *
 * HOW, in order of trust:
 *   1. A DICTIONARY of countries, cities, address words (street, district, building...) and common first / family names. These come out
 *      exactly as the English world writes them ("الرياض" -> "Riyadh", not "Alriyad").
 *   2. Anything not in the dictionary is ROMANISED by rules. Arabic is normally written WITHOUT its short vowels, so this is only
 *      approximate: it gives a readable Latin spelling ("Hamara"), not necessarily the official one. That is why every automatically
 *      produced address is marked 'auto', can be corrected by admin, and is meant to be confirmed by the buyer.
 *   3. Digits and punctuation are converted exactly (Arabic-Indic digits "١٢٣" -> "123"; "،" -> ",").
 *
 * Text that is already Latin passes through untouched, so a mixed address ("شارع الملك فهد, Building 12") works.
 *
 * This file has no database dependency on purpose, so it is unit-tested directly.
 */

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F]/;
const DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g; // short-vowel marks, shadda, tatweel

function containsArabic(text) {
  return typeof text === 'string' && ARABIC_RANGE.test(text);
}

// Spelling-insensitive form used ONLY to look words up (alef / ya / ta-marbuta variants are written inconsistently by people).
function normKey(word) {
  return word
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Dictionary: [Arabic, English]. Multi-word entries are allowed (matched longest-first).
// ---------------------------------------------------------------------------------------------------------------------------------------
const COUNTRIES = [
  ['المملكة العربية السعودية', 'Saudi Arabia'], ['السعودية', 'Saudi Arabia'], ['الإمارات العربية المتحدة', 'United Arab Emirates'], ['الإمارات', 'United Arab Emirates'],
  ['الكويت', 'Kuwait'], ['دولة الكويت', 'Kuwait'], ['قطر', 'Qatar'], ['دولة قطر', 'Qatar'], ['البحرين', 'Bahrain'], ['مملكة البحرين', 'Bahrain'],
  ['سلطنة عمان', 'Oman'], ['عمان', 'Oman'], ['الأردن', 'Jordan'], ['مصر', 'Egypt'], ['العراق', 'Iraq'], ['لبنان', 'Lebanon'], ['سوريا', 'Syria'],
  ['فلسطين', 'Palestine'], ['اليمن', 'Yemen'], ['ليبيا', 'Libya'], ['تونس', 'Tunisia'], ['الجزائر', 'Algeria'], ['المغرب', 'Morocco'], ['السودان', 'Sudan'],
  ['تركيا', 'Turkey'], ['الصين', 'China'], ['الهند', 'India'], ['باكستان', 'Pakistan'], ['إيران', 'Iran'],
];

const CITIES = [
  // Saudi Arabia
  ['الرياض', 'Riyadh'], ['جدة', 'Jeddah'], ['مكة المكرمة', 'Makkah'], ['مكة', 'Makkah'], ['المدينة المنورة', 'Madinah'], ['المدينة', 'Madinah'], ['الدمام', 'Dammam'],
  ['الخبر', 'Khobar'], ['الظهران', 'Dhahran'], ['الطائف', 'Taif'], ['تبوك', 'Tabuk'], ['أبها', 'Abha'], ['بريدة', 'Buraydah'], ['حائل', 'Hail'], ['نجران', 'Najran'],
  ['جازان', 'Jazan'], ['الجبيل', 'Jubail'], ['ينبع', 'Yanbu'], ['الأحساء', 'Al Ahsa'], ['الهفوف', 'Hofuf'], ['الخرج', 'Al Kharj'], ['القطيف', 'Qatif'], ['خميس مشيط', 'Khamis Mushait'],
  // UAE
  ['دبي', 'Dubai'], ['أبو ظبي', 'Abu Dhabi'], ['أبوظبي', 'Abu Dhabi'], ['الشارقة', 'Sharjah'], ['عجمان', 'Ajman'], ['رأس الخيمة', 'Ras Al Khaimah'], ['الفجيرة', 'Fujairah'],
  ['أم القيوين', 'Umm Al Quwain'], ['العين', 'Al Ain'],
  // Kuwait, Qatar, Bahrain, Oman
  ['مدينة الكويت', 'Kuwait City'], ['حولي', 'Hawalli'], ['السالمية', 'Salmiya'], ['الفروانية', 'Farwaniya'], ['الجهراء', 'Jahra'], ['الأحمدي', 'Ahmadi'],
  ['الدوحة', 'Doha'], ['الوكرة', 'Al Wakrah'], ['الخور', 'Al Khor'], ['الريان', 'Al Rayyan'], ['المنامة', 'Manama'], ['المحرق', 'Muharraq'], ['الرفاع', 'Riffa'],
  ['مسقط', 'Muscat'], ['صلالة', 'Salalah'], ['صحار', 'Sohar'], ['نزوى', 'Nizwa'],
  // Jordan, Egypt, Iraq, Lebanon and others
  ['عمّان', 'Amman'], ['إربد', 'Irbid'], ['الزرقاء', 'Zarqa'], ['العقبة', 'Aqaba'], ['القاهرة', 'Cairo'], ['الإسكندرية', 'Alexandria'], ['الجيزة', 'Giza'], ['بغداد', 'Baghdad'],
  ['البصرة', 'Basra'], ['أربيل', 'Erbil'], ['الموصل', 'Mosul'], ['بيروت', 'Beirut'], ['دمشق', 'Damascus'], ['حلب', 'Aleppo'], ['صنعاء', 'Sanaa'], ['عدن', 'Aden'],
  ['طرابلس', 'Tripoli'], ['تونس العاصمة', 'Tunis'], ['الرباط', 'Rabat'], ['الدار البيضاء', 'Casablanca'], ['الخرطوم', 'Khartoum'],
];

// Words that appear in addresses. (English side is what a courier / label expects.)
const ADDRESS_WORDS = [
  ['شارع', 'Street'], ['طريق', 'Road'], ['حي', 'District'], ['مبنى', 'Building'], ['عمارة', 'Building'], ['برج', 'Tower'], ['مجمع', 'Complex'], ['رقم', 'No.'],
  ['شقة', 'Apartment'], ['فيلا', 'Villa'], ['منزل', 'House'], ['بيت', 'House'], ['بجانب', 'Next to'], ['بالقرب من', 'Near'], ['قرب', 'Near'], ['خلف', 'Behind'], ['مقابل', 'Opposite'],
  ['أمام', 'In front of'], ['ص.ب', 'P.O. Box'], ['صندوق بريد', 'P.O. Box'], ['الطابق', 'Floor'], ['الدور', 'Floor'], ['مكتب', 'Office'], ['منطقة', 'Area'], ['قطعة', 'Block'],
  ['جادة', 'Avenue'], ['ميدان', 'Square'], ['دوار', 'Roundabout'], ['مدينة', 'City'], ['محافظة', 'Governorate'], ['ولاية', 'Wilayat'], ['منطقة', 'Area'], ['شمال', 'North'],
  ['جنوب', 'South'], ['شرق', 'East'], ['غرب', 'West'], ['وسط', 'Central'], ['الصناعية', 'Industrial'], ['السكني', 'Residential'], ['مول', 'Mall'], ['مركز', 'Center'],
  ['مستشفى', 'Hospital'], ['مسجد', 'Mosque'], ['جامعة', 'University'], ['مدرسة', 'School'], ['سوق', 'Market'], ['محطة', 'Station'], ['مطار', 'Airport'], ['حديقة', 'Park'],
  ['الشيخ', 'Sheikh'], ['الملك', 'King'], ['الأمير', 'Prince'], ['الأميرة', 'Princess'], ['السلطان', 'Sultan'], ['الإمام', 'Imam'], ['الجامعة', 'University'], ['الأول', 'First'],
  ['الثاني', 'Second'], ['الثالث', 'Third'], ['الرئيسي', 'Main'], ['العام', 'Public'], ['الجديد', 'New'], ['الجديدة', 'New'], ['القديم', 'Old'], ['القديمة', 'Old'],
  ['بن', 'Bin'], ['ابن', 'Ibn'], ['أبو', 'Abu'], ['أم', 'Umm'], ['آل', 'Al'], ['و', 'and'],
];

const NAMES = [
  // men
  ['محمد', 'Mohammed'], ['أحمد', 'Ahmed'], ['علي', 'Ali'], ['عمر', 'Omar'], ['عثمان', 'Othman'], ['خالد', 'Khalid'], ['فهد', 'Fahad'], ['سعد', 'Saad'], ['سعود', 'Saud'],
  ['سلمان', 'Salman'], ['عبدالله', 'Abdullah'], ['عبد الله', 'Abdullah'], ['عبدالرحمن', 'Abdulrahman'], ['عبد الرحمن', 'Abdulrahman'], ['عبدالعزيز', 'Abdulaziz'],
  ['عبد العزيز', 'Abdulaziz'], ['عبدالكريم', 'Abdulkarim'], ['عبدالمجيد', 'Abdulmajeed'], ['فيصل', 'Faisal'], ['ناصر', 'Nasser'], ['يوسف', 'Yousef'], ['إبراهيم', 'Ibrahim'],
  ['حسن', 'Hassan'], ['حسين', 'Hussein'], ['مصطفى', 'Mustafa'], ['محمود', 'Mahmoud'], ['سامي', 'Sami'], ['ماجد', 'Majed'], ['طارق', 'Tariq'], ['زياد', 'Ziad'], ['ياسر', 'Yasser'],
  ['بدر', 'Badr'], ['تركي', 'Turki'], ['نايف', 'Naif'], ['مشعل', 'Meshaal'], ['سلطان', 'Sultan'], ['راشد', 'Rashid'], ['حمد', 'Hamad'], ['جاسم', 'Jassim'], ['منصور', 'Mansour'],
  ['وليد', 'Waleed'], ['هشام', 'Hisham'], ['كريم', 'Karim'], ['أنس', 'Anas'], ['عادل', 'Adel'], ['صالح', 'Saleh'], ['إسماعيل', 'Ismail'], ['موسى', 'Musa'], ['عيسى', 'Issa'],
  ['سليمان', 'Sulaiman'], ['بندر', 'Bandar'], ['ريان', 'Rayan'], ['مازن', 'Mazen'], ['رامي', 'Rami'], ['باسم', 'Basem'], ['جمال', 'Jamal'], ['كمال', 'Kamal'], ['نبيل', 'Nabil'],
  // women
  ['فاطمة', 'Fatima'], ['عائشة', 'Aisha'], ['مريم', 'Maryam'], ['سارة', 'Sara'], ['نورة', 'Noura'], ['هند', 'Hind'], ['ليلى', 'Layla'], ['زينب', 'Zainab'], ['خديجة', 'Khadija'],
  ['منى', 'Mona'], ['ريم', 'Reem'], ['لمى', 'Lama'], ['دانة', 'Dana'], ['أمل', 'Amal'], ['هدى', 'Huda'], ['سلمى', 'Salma'], ['نادية', 'Nadia'], ['رنا', 'Rana'], ['لينا', 'Lina'],
  ['دعاء', 'Dua'], ['آمنة', 'Amna'], ['أسماء', 'Asma'], ['حنان', 'Hanan'], ['سمية', 'Sumaya'], ['رحمة', 'Rahma'], ['ملاك', 'Malak'], ['جود', 'Joud'], ['شهد', 'Shahd'],
  // family names (with "Al-")
  ['العتيبي', 'Al-Otaibi'], ['القحطاني', 'Al-Qahtani'], ['الغامدي', 'Al-Ghamdi'], ['الزهراني', 'Al-Zahrani'], ['الشمري', 'Al-Shammari'], ['الدوسري', 'Al-Dosari'],
  ['المطيري', 'Al-Mutairi'], ['الحربي', 'Al-Harbi'], ['العنزي', 'Al-Anazi'], ['السبيعي', 'Al-Subaie'], ['الشهري', 'Al-Shahri'], ['البلوي', 'Al-Balawi'], ['الجهني', 'Al-Juhani'],
  ['الشريف', 'Al-Sharif'], ['الخالدي', 'Al-Khalidi'], ['الكعبي', 'Al-Kaabi'], ['المنصوري', 'Al-Mansouri'], ['النعيمي', 'Al-Nuaimi'], ['الهاجري', 'Al-Hajri'], ['المري', 'Al-Marri'],
  ['الكبيسي', 'Al-Kubaisi'], ['الحسيني', 'Al-Husseini'], ['السيد', 'Al-Sayed'], ['العلي', 'Al-Ali'], ['الأحمد', 'Al-Ahmad'], ['الصباح', 'Al-Sabah'], ['المهندس', 'Al-Mohandes'],
];

// Very common district / landmark names. Not exhaustive: anything else is romanised by rule and flagged 'auto'.
const PLACES = [
  ['الروضة', 'Al-Rawda'], ['الحمراء', 'Al-Hamra'], ['النخيل', 'Al-Nakheel'], ['العليا', 'Al-Olaya'], ['الملز', 'Al-Malaz'], ['السلام', 'Al-Salam'], ['الصفا', 'Al-Safa'],
  ['المروة', 'Al-Marwa'], ['النزهة', 'Al-Nuzha'], ['الورود', 'Al-Wurud'], ['الياسمين', 'Al-Yasmin'], ['الفيحاء', 'Al-Fayha'], ['الزهور', 'Al-Zuhur'], ['العزيزية', 'Al-Aziziyah'],
  ['الرحاب', 'Al-Rehab'], ['النور', 'Al-Nour'], ['الواحة', 'Al-Waha'], ['الخليج', 'Al-Khaleej'], ['جميرا', 'Jumeirah'], ['ديرة', 'Deira'], ['البرشاء', 'Al Barsha'], ['الكرامة', 'Al Karama'],
  ['زايد', 'Zayed'], ['الفطيم', 'Al-Futtaim'], ['التحلية', 'Al-Tahlia'], ['الكورنيش', 'Corniche'], ['الشاطئ', 'Al-Shati'], ['السالم', 'Al-Salem'], ['حطين', 'Hittin'], ['الملقا', 'Al-Malqa'],
];

// word-sequence -> English, longest match first. Later lists win on a clash, so names do not override address words.
const DICTIONARY = new Map();
let MAX_WORDS = 1;
for (const list of [NAMES, PLACES, ADDRESS_WORDS, CITIES, COUNTRIES]) {
  for (const [ar, en] of list) {
    const key = normKey(ar).split(/\s+/).filter(Boolean).join(' ');
    DICTIONARY.set(key, en);
    MAX_WORDS = Math.max(MAX_WORDS, key.split(' ').length);
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Rule-based romanisation (for words the dictionary does not know). Approximate by nature: Arabic omits short vowels.
// ---------------------------------------------------------------------------------------------------------------------------------------
const CONSONANTS = {
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
  'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h',
  'پ': 'p', 'چ': 'ch', 'گ': 'g', 'ڤ': 'v', 'ک': 'k', 'ی': 'y', 'ں': 'n',
};

function romanizeWord(word) {
  const chars = [...word.replace(DIACRITICS, '')];
  const isLetter = (c) => c !== undefined && (c in CONSONANTS || 'اأإآٱىةءؤئوعي'.includes(c));
  const parts = []; // { v: is a vowel, s: text }
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i];
    const prev = parts[parts.length - 1];
    const next = chars[i + 1];
    const nextIsConsonantOrEnd = next === undefined || (next in CONSONANTS);
    if (c in CONSONANTS) parts.push({ v: false, s: CONSONANTS[c] });
    else if (c === 'ا' || c === 'ٱ' || c === 'أ' || c === 'ى' || c === 'ة') parts.push({ v: true, s: 'a' });
    else if (c === 'إ') parts.push({ v: true, s: 'i' });
    else if (c === 'آ') parts.push({ v: true, s: 'aa' });
    else if (c === 'ع') parts.push({ v: true, s: 'a' });
    else if (c === 'ء') { if (next !== undefined) parts.push({ v: false, s: "'" }); } // a final hamza is not written
    else if (c === 'ؤ') parts.push({ v: true, s: 'u' });
    else if (c === 'ئ') parts.push({ v: true, s: 'i' });
    else if (c === 'و') parts.push(prev && !prev.v && nextIsConsonantOrEnd ? { v: true, s: 'u' } : { v: false, s: 'w' });
    else if (c === 'ي') parts.push(prev && !prev.v && nextIsConsonantOrEnd ? { v: true, s: 'i' } : { v: false, s: 'y' });
    else if (!isLetter(c)) parts.push({ v: true, s: c });
  }
  let out = '';
  parts.forEach((p, i) => {
    out += p.s;
    // two consonants in a row: Arabic leaves a short vowel unwritten, so put an "a" between them
    if (!p.v && p.s !== "'" && parts[i + 1] && !parts[i + 1].v) out += 'a';
  });
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function romanizeWithArticle(word) {
  const bare = word.replace(DIACRITICS, '');
  // "ال" (the): Al-Something
  if (bare.length > 3 && bare.startsWith('ال')) {
    const rest = bare.slice(2);
    const known = DICTIONARY.get(normKey(rest));
    return `Al-${known || romanizeWord(rest)}`;
  }
  return romanizeWord(bare);
}

// Arabic puts the kind of place first ("شارع الملك فهد" = street King Fahad); English puts it after ("King Fahad Street").
const TYPE_WORDS = new Set(['Street', 'Road', 'Avenue', 'District', 'Square', 'Tower', 'Complex', 'Mall', 'Hospital', 'Mosque', 'University', 'School', 'Park', 'Station', 'Airport', 'Market', 'Center', 'Roundabout']);
function reorderTypeWords(words) {
  const out = [];
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    // a type word followed by a NAME (not a number, and not another type word) moves to the end of that name
    if (TYPE_WORDS.has(w) && words[i + 1] !== undefined && !/^[\d(]/.test(words[i + 1]) && words[i + 1] !== 'No.' && !TYPE_WORDS.has(words[i + 1])) {
      let j = i + 1;
      const name = [];
      while (j < words.length && !/^\d/.test(words[j]) && words[j] !== 'No.' && !TYPE_WORDS.has(words[j]) && !['Next', 'Near', 'Behind', 'Opposite', 'In'].includes(words[j])) { name.push(words[j]); j += 1; }
      out.push(...name, w);
      i = j - 1;
    } else out.push(w);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Whole-text conversion
// ---------------------------------------------------------------------------------------------------------------------------------------
const DIGITS = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
const PUNCTUATION = { '،': ',', '؛': ';', '؟': '?', '٫': '.', '٬': ',', '«': '"', '»': '"' };

function convertSymbols(text) {
  return text.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d]).replace(/[،؛؟٫٬«»]/g, (p) => PUNCTUATION[p]);
}

// One comma-separated clause that contains Arabic.
function clauseToEnglish(clause) {
  // "P.O. Box" is written ص.ب with dots, which would otherwise split it into letters
  const text = convertSymbols(clause.replace(/ص\s*\.\s*ب\.?/g, ' P.O. Box '));
  const tokens = text.match(/[\u0600-\u06FF\u0750-\u077F]+|[^\u0600-\u06FF\u0750-\u077F]+/g) || [];
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!ARABIC_RANGE.test(token)) { out.push(token); continue; }
    // gather following Arabic words separated only by single spaces, to match multi-word entries ("المدينة المنورة")
    const run = [token];
    let j = i;
    while (tokens[j + 1] === ' ' && tokens[j + 2] && ARABIC_RANGE.test(tokens[j + 2]) && run.length < MAX_WORDS) { run.push(tokens[j + 2]); j += 2; }
    let matched = false;
    for (let len = run.length; len >= 1; len -= 1) {
      const english = DICTIONARY.get(run.slice(0, len).map(normKey).join(' '));
      if (english !== undefined) { out.push(english); i += (len - 1) * 2; matched = true; break; }
    }
    if (!matched) out.push(romanizeWithArticle(token));
  }
  const words = out.join('').replace(/\s+/g, ' ').trim().split(' ');
  return reorderTypeWords(words).join(' ');
}

// The English version of any text. Latin text, digits and punctuation pass through; Arabic words become English.
function toEnglish(text) {
  if (typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (!containsArabic(trimmed)) return convertSymbols(trimmed);
  return trimmed
    .split(/[,،]/)
    .map((clause) => (containsArabic(clause) ? clauseToEnglish(clause) : convertSymbols(clause).trim()))
    .filter((clause) => clause !== '')
    .join(', ');
}

module.exports = { containsArabic, toEnglish, romanizeWord, normKey, convertSymbols };
