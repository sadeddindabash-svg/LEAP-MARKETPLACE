// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// The backend module is plain CommonJS with no database dependency, so it can be tested directly.
const require = createRequire(import.meta.url);
const { toEnglish, containsArabic, romanizeWord } = require('../../../services/api/src/modules/addressEnglish/transliterate.js');

const HAS_ARABIC = /[\u0600-\u06FF\u0750-\u077F]/;

describe('Arabic -> English for delivery addresses', () => {
  it('CRITICAL: countries, cities and common names come out the way they are written in English (from the dictionary, not guessed)', () => {
    expect(toEnglish('السعودية')).toBe('Saudi Arabia');
    expect(toEnglish('المملكة العربية السعودية')).toBe('Saudi Arabia');
    expect(toEnglish('الإمارات العربية المتحدة')).toBe('United Arab Emirates');
    expect(toEnglish('الرياض')).toBe('Riyadh');
    expect(toEnglish('جدة')).toBe('Jeddah');
    expect(toEnglish('المدينة المنورة')).toBe('Madinah');
    expect(toEnglish('مكة المكرمة')).toBe('Makkah');
    expect(toEnglish('أبو ظبي')).toBe('Abu Dhabi');
    expect(toEnglish('رأس الخيمة')).toBe('Ras Al Khaimah');
    expect(toEnglish('محمد العتيبي')).toBe('Mohammed Al-Otaibi');
    expect(toEnglish('فاطمة أحمد الزهراني')).toBe('Fatima Ahmed Al-Zahrani');
    expect(toEnglish('عبدالله بن سعود')).toBe('Abdullah Bin Saud');
  });

  it('CRITICAL: a full street address reads like an English address: the type word moves AFTER the name, numbers are converted, words are translated', () => {
    expect(toEnglish('شارع الملك فهد، حي العليا، مبنى رقم ١٢٣، الطابق ٤')).toBe('King Fahad Street, Al-Olaya District, Building No. 123, Floor 4');
    expect(toEnglish('حي النخيل، شارع الأمير سلطان')).toBe('Al-Nakheel District, Prince Sultan Street');
    expect(toEnglish('طريق الشيخ زايد، برج الفطيم')).toBe('Sheikh Zayed Road, Al-Futtaim Tower');
    expect(toEnglish('مجمع الواحة السكني')).toBe('Al-Waha Residential Complex');
    expect(toEnglish('بجانب مسجد النور')).toBe('Next to Al-Nour Mosque');
    expect(toEnglish('خلف مستشفى الملك خالد')).toBe('Behind King Khalid Hospital');
  });

  it('a type word followed by a NUMBER stays where it is ("Street 10", "Block 3", "Floor 4")', () => {
    expect(toEnglish('شارع ٥')).toBe('Street 5');
    expect(toEnglish('قطعة ٣ شارع ١٠')).toBe('Block 3 Street 10');
  });

  it('P.O. Box is recognised even though it is written with dots', () => {
    expect(toEnglish('ص.ب ٤٥٦٧')).toBe('P.O. Box 4567');
    expect(toEnglish('ص. ب 99')).toBe('P.O. Box 99');
  });

  it('Arabic-Indic and Persian digits become ordinary digits, and Arabic punctuation becomes ordinary punctuation', () => {
    expect(toEnglish('٠٥٥ ١٢٣ ٤٥٦٧')).toBe('055 123 4567');
    expect(toEnglish('۱۲۳')).toBe('123');
    expect(toEnglish('رقم ٧، الدور ٢؟')).toBe('No. 7, Floor 2?');
  });

  it('CRITICAL: text that is already English is NOT touched: not reordered, not altered', () => {
    for (const text of ['Park Avenue, 5th Floor', 'Already English Street 5', '123 Main St, Springfield', 'Building 12']) expect(toEnglish(text)).toBe(text);
  });

  it('mixed Arabic and English: only the Arabic part is converted, and only an Arabic clause is reordered', () => {
    expect(toEnglish('شارع الملك فهد, Building 12')).toBe('King Fahad Street, Building 12');
    expect(toEnglish('Park Avenue, شارع الملك فهد')).toBe('Park Avenue, King Fahad Street');
  });

  it('CRITICAL: whatever the Arabic, the English version never contains an Arabic letter (unknown words are romanised by rule)', () => {
    const unknown = ['بستان', 'كتاب', 'المنتزه', 'الشروق', 'الأندلس', 'قرطبة', 'المرجان', 'لؤلؤة', 'سلوى', 'الصحافة', 'معرض', 'نهر', 'تلال', 'ياسمين', 'الدرعية', 'ورود', 'گلشن', 'پارک', 'ڤيلا ١٢', 'ءأإآ', 'ـــ', 'مُحَمَّد'];
    for (const word of unknown) {
      const english = toEnglish(`شارع ${word}، ${word}`);
      expect(HAS_ARABIC.test(english), `${word} -> ${english}`).toBe(false);
      expect(english.length).toBeGreaterThan(0);
    }
  });

  it('the rule-based fallback is APPROXIMATE but readable and stable (Arabic leaves short vowels unwritten, so a vowel is inserted between consonants)', () => {
    expect(romanizeWord('وادي')).toBe('Wadi');
    expect(toEnglish('بستان')).toBe('Basatan');
    expect(toEnglish('الغدير')).toBe('Al-Ghadir');
    expect(toEnglish('الشروق')).toBe('Al-Sharuq');
    expect(toEnglish('حديقة الورد')).toBe('Al-Warad Park');
  });

  it('short-vowel marks, shadda and tatweel are ignored, so a fully written name matches the dictionary', () => {
    expect(toEnglish('مُحَمَّد')).toBe('Mohammed');
    expect(toEnglish('الـرِّيَاض')).toBe('Riyadh');
  });

  it('spelling variants of the same word still match (alef, ya, ta-marbuta written differently)', () => {
    expect(toEnglish('الامارات')).toBe('United Arab Emirates');
    expect(toEnglish('فاطمه')).toBe('Fatima');
    expect(toEnglish('مصطفي')).toBe('Mustafa');
  });

  it('it is stable: converting an already-converted address changes nothing', () => {
    for (const text of ['شارع الملك فهد، حي العليا، مبنى رقم ١٢٣', 'محمد العتيبي', 'بستان الورد']) {
      const once = toEnglish(text);
      expect(toEnglish(once)).toBe(once);
    }
  });

  it('empty, missing and non-text values are handled without error', () => {
    expect(toEnglish('')).toBe('');
    expect(toEnglish('   ')).toBe('');
    expect(toEnglish(null)).toBeNull();
    expect(toEnglish(undefined)).toBeUndefined();
    expect(toEnglish(42)).toBe(42);
  });

  it('containsArabic is exact', () => {
    expect(containsArabic('الرياض')).toBe(true);
    expect(containsArabic('Riyadh الرياض')).toBe(true);
    expect(containsArabic('Riyadh')).toBe(false);
    expect(containsArabic('123 ,.')).toBe(false);
    expect(containsArabic('')).toBe(false);
    expect(containsArabic(null)).toBe(false);
  });
});
