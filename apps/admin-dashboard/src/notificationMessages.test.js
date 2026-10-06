// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// The backend modules are plain CommonJS with no database dependency, so they can be tested directly.
const require = createRequire(import.meta.url);
const messages = require('../../../services/api/src/modules/notifications/messages.js');
const i18n = require('../../../services/api/src/modules/notifications/i18n.js');

const HAS_ARABIC = /[\u0600-\u06FF]/;
// English words the templates use; none of them may leak into an Arabic text.
const ENGLISH_TEMPLATE_WORDS = /\b(Order|Return|Your|has shipped|delivered|Tracking|Thanks|Happy|Price drop|Back in stock|Someone|Use code|reply|update|inspection hub|referral)\b/;

// One example of every buyer notification, with the values a real one would carry.
const SAMPLES = {
  orderShipped: messages.orderShipped('LP-1001', 'HUB-999'),
  orderDelivered: messages.orderDelivered('LP-1001'),
  orderToInspectionHub: messages.orderToInspectionHub('LP-1001'),
  orderDelayed: messages.orderDelayed('LP-1001'),
  returnUpdatedWithStatus: messages.returnUpdated('RC-7', 'approved'),
  returnUpdatedNoStatus: messages.returnUpdated('RC-7', null),
  returnCaseMessage: messages.returnCaseMessage({ en: 'We are refunding $10.00.', ar: 'سيتم استرداد مبلغ 10.00$.' }),
  accountAnniversary: messages.accountAnniversary(3),
  priceDrop: messages.priceDrop({ name: 'Brake Disc', nameAr: 'قرص فرامل', price: 30, was: 40 }),
  backInStock: messages.backInStock({ name: 'Brake Disc', nameAr: 'قرص فرامل' }),
  savedSearchMatch: messages.savedSearchMatch({ label: 'brakes', total: 5, matchNames: ['A', 'B', 'C'] }),
  referralReward: messages.referralReward('REF-AB12', 10),
  ticketReply: messages.ticketReply('Late parcel', 'We are on it.'),
};

describe('notification messages — every buyer notification has an English and an Arabic text', () => {
  it('CRITICAL: every one has all four texts; the English is English and the Arabic is Arabic with no English template words left in it', () => {
    for (const [name, m] of Object.entries(SAMPLES)) {
      for (const key of ['title', 'body', 'titleAr', 'bodyAr']) expect(m[key], `${name}.${key}`).toBeTruthy();
      expect(HAS_ARABIC.test(m.title), `${name}: English title has Arabic`).toBe(false);
      expect(HAS_ARABIC.test(m.titleAr), `${name}: Arabic title has no Arabic`).toBe(true);
      expect(ENGLISH_TEMPLATE_WORDS.test(m.titleAr), `${name}: English wording in the Arabic title: ${m.titleAr}`).toBe(false);
      // The ONE exception: a support reply's body is the admin's own words, so it is deliberately the same in both languages
      // (asserted by its own test below). Every other body must be genuinely Arabic.
      if (name === 'ticketReply') continue;
      expect(HAS_ARABIC.test(m.bodyAr), `${name}: Arabic body has no Arabic`).toBe(true);
      expect(ENGLISH_TEMPLATE_WORDS.test(m.bodyAr), `${name}: English wording in the Arabic body: ${m.bodyAr}`).toBe(false);
    }
  });

  it('the English wording is exactly what these notifications said before they had an Arabic version', () => {
    expect(SAMPLES.orderShipped).toMatchObject({ title: 'Your order has shipped', body: 'Order LP-1001 is on its way to you. Tracking number: HUB-999' });
    expect(SAMPLES.orderDelivered).toMatchObject({ title: 'Your order has been delivered', body: 'Order LP-1001 is now delivered.' });
    expect(SAMPLES.orderToInspectionHub.title).toBe('Your order is on its way to our inspection hub');
    expect(SAMPLES.orderDelayed).toMatchObject({ title: 'Your order is taking longer than expected', body: "Order LP-1001 hasn't had an update in a while. We're keeping an eye on it." });
    expect(SAMPLES.returnUpdatedWithStatus).toMatchObject({ title: 'Your return request was updated', body: 'Return RC-7 is now approved.' });
    expect(SAMPLES.returnUpdatedNoStatus.body).toBe('There is an update on return RC-7.');
    expect(SAMPLES.accountAnniversary).toMatchObject({ title: 'Happy 3 years with LEAP!', body: 'Thanks for being with us for 3 years. We appreciate you.' });
    expect(SAMPLES.priceDrop).toMatchObject({ title: 'Price drop on a wishlist item', body: 'Brake Disc dropped to $30.00 (was $40.00).' });
    expect(SAMPLES.backInStock).toMatchObject({ title: 'Back in stock', body: 'Brake Disc is back in stock.' });
    expect(SAMPLES.savedSearchMatch).toMatchObject({ title: 'New results for a saved search', body: '"brakes" has 5 new matches: A, B, C…' });
    expect(SAMPLES.referralReward).toMatchObject({ title: 'You earned a referral reward!', body: 'Someone you referred placed their first order. Use code REF-AB12 for 10% off your next order.' });
    expect(SAMPLES.ticketReply).toMatchObject({ title: 'New reply on your support ticket', body: '"Late parcel": We are on it.' });
  });

  it('the values a person needs (order number, tracking number, case id, code, percentage, label) are in BOTH languages', () => {
    expect(SAMPLES.orderShipped.bodyAr).toContain('LP-1001');
    expect(SAMPLES.orderShipped.bodyAr).toContain('HUB-999');
    expect(SAMPLES.orderDelivered.bodyAr).toContain('LP-1001');
    expect(SAMPLES.orderToInspectionHub.bodyAr).toContain('LP-1001');
    expect(SAMPLES.orderDelayed.bodyAr).toContain('LP-1001');
    expect(SAMPLES.returnUpdatedWithStatus.bodyAr).toContain('RC-7');
    expect(SAMPLES.returnUpdatedNoStatus.bodyAr).toContain('RC-7');
    expect(SAMPLES.referralReward.bodyAr).toContain('REF-AB12');
    expect(SAMPLES.referralReward.bodyAr).toContain('10%');
    expect(SAMPLES.savedSearchMatch.bodyAr).toContain('"brakes"');
    expect(SAMPLES.priceDrop.bodyAr).toContain('$30.00');
    expect(SAMPLES.priceDrop.bodyAr).toContain('$40.00');
  });

  it('a price drop / back-in-stock notice uses the product\'s Arabic name when it has one, and falls back to the English name when it does not', () => {
    expect(messages.priceDrop({ name: 'Brake Disc', nameAr: 'قرص فرامل', price: 30, was: 40 }).bodyAr).toContain('قرص فرامل');
    expect(messages.priceDrop({ name: 'Brake Disc', nameAr: null, price: 30, was: 40 }).bodyAr).toContain('Brake Disc');
    expect(messages.backInStock({ name: 'Brake Disc', nameAr: 'قرص فرامل' }).bodyAr).toContain('قرص فرامل');
    expect(messages.backInStock({ name: 'Brake Disc', nameAr: '' }).bodyAr).toContain('Brake Disc');
  });

  it('a person\'s own words are passed through unchanged: only the title of a support reply is translated', () => {
    expect(SAMPLES.ticketReply.bodyAr).toBe(SAMPLES.ticketReply.body);
    expect(SAMPLES.ticketReply.titleAr).not.toBe(SAMPLES.ticketReply.title);
  });

  it('a fault-case message keeps each language in its own field (the English one has no Arabic and the Arabic one no English)', () => {
    const m = SAMPLES.returnCaseMessage;
    expect(m.body).toBe('We are refunding $10.00.');
    expect(HAS_ARABIC.test(m.body)).toBe(false);
    expect(m.bodyAr).toBe('سيتم استرداد مبلغ 10.00$.');
  });
});

describe('Arabic number wording', () => {
  it('years: عام / عامين / 3-10 أعوام / 11+ عامًا, in the anniversary title and body', () => {
    const titles = Object.fromEntries([1, 2, 3, 10, 11, 21].map((n) => [n, messages.accountAnniversary(n).titleAr]));
    expect(titles[1]).toBe('مرّ عام على انضمامك إلى ليب!');
    expect(titles[2]).toBe('مرّ عامان على انضمامك إلى ليب!');
    expect(titles[3]).toBe('مرّت 3 أعوام على انضمامك إلى ليب!');
    expect(titles[10]).toBe('مرّت 10 أعوام على انضمامك إلى ليب!');
    expect(titles[11]).toBe('مرّ 11 عامًا على انضمامك إلى ليب!');
    expect(titles[21]).toBe('مرّ 21 عامًا على انضمامك إلى ليب!');
    expect(i18n.arabicYearsDuration(1)).toBe('عام');
    expect(i18n.arabicYearsDuration(2)).toBe('عامين');
    expect(i18n.arabicYearsDuration(5)).toBe('5 أعوام');
    expect(i18n.arabicYearsDuration(12)).toBe('12 عامًا');
    expect(messages.accountAnniversary(2).bodyAr).toContain('لمدة عامين');
  });

  it('English years stay singular for 1 and plural otherwise', () => {
    expect(messages.accountAnniversary(1).title).toBe('Happy 1 year with LEAP!');
    expect(messages.accountAnniversary(2).title).toBe('Happy 2 years with LEAP!');
  });

  it('new results: واحدة / نتيجتان / 3-10 نتائج / 11+ نتيجة', () => {
    expect(i18n.arabicNewResults(1)).toBe('نتيجة جديدة واحدة');
    expect(i18n.arabicNewResults(2)).toBe('نتيجتان جديدتان');
    expect(i18n.arabicNewResults(3)).toBe('3 نتائج جديدة');
    expect(i18n.arabicNewResults(10)).toBe('10 نتائج جديدة');
    expect(i18n.arabicNewResults(11)).toBe('11 نتيجة جديدة');
    expect(messages.savedSearchMatch({ label: 'x', total: 1, matchNames: ['A'] }).body).toBe('"x" has 1 new match: A');
  });

  it('a saved search shows an ellipsis only when there are more matches than names listed', () => {
    expect(messages.savedSearchMatch({ label: 'x', total: 3, matchNames: ['A', 'B', 'C'] }).bodyAr).not.toContain('…');
    expect(messages.savedSearchMatch({ label: 'x', total: 4, matchNames: ['A', 'B', 'C'] }).bodyAr).toContain('…');
  });

  it('every return status has Arabic wording (the same words the app uses), and no raw status code leaks into the Arabic', () => {
    for (const status of ['awaiting', 'in_progress', 'approved', 'rejected', 'completed']) {
      const m = messages.returnUpdated('RC-1', status);
      expect(HAS_ARABIC.test(m.bodyAr)).toBe(true);
      expect(m.bodyAr).not.toContain(status);
    }
    expect(i18n.arabicReturnStatus('in_progress')).toBe('قيد التنفيذ');
    expect(i18n.arabicReturnStatus('approved')).toBe('موافق عليه');
    // an unknown status never breaks: it is shown as it is
    expect(i18n.arabicReturnStatus('mystery')).toBe('mystery');
  });
});

describe('choosing the language', () => {
  const both = { title: 'English title', body: 'English body', titleAr: 'عنوان', bodyAr: 'نص' };

  it('CRITICAL: Arabic gets the Arabic text, English (or nothing) gets the English text', () => {
    expect(i18n.localize(both, 'ar')).toEqual({ title: 'عنوان', body: 'نص' });
    expect(i18n.localize(both, 'en')).toEqual({ title: 'English title', body: 'English body' });
    expect(i18n.localize(both, undefined)).toEqual({ title: 'English title', body: 'English body' });
  });

  it('an unknown language is treated as English, never an error', () => {
    for (const lang of ['fr', '', null, 'AR', 'ar-SA', 42]) expect(i18n.localize(both, lang).title).toBe('English title');
    expect(i18n.normalizeLanguage('ar')).toBe('ar');
    expect(i18n.normalizeLanguage('xx')).toBe('en');
    expect(i18n.isSupportedLanguage('ar')).toBe(true);
    expect(i18n.isSupportedLanguage('fr')).toBe(false);
  });

  it('CRITICAL: a notification with no Arabic text (an older one, or one for a supplier) is still readable in Arabic mode: it falls back to English, field by field', () => {
    const englishOnly = { title: 'Low stock alert', body: 'Brake Disc is low.', titleAr: null, bodyAr: null };
    expect(i18n.localize(englishOnly, 'ar')).toEqual({ title: 'Low stock alert', body: 'Brake Disc is low.' });
    const titleOnly = { title: 'T', body: 'B', titleAr: 'عنوان', bodyAr: null };
    expect(i18n.localize(titleOnly, 'ar')).toEqual({ title: 'عنوان', body: 'B' });
  });
});
