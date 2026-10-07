const db = require('../../../db/pool');

/**
 * Which language a buyer's email is written in.
 *
 *   'ar'    the person's app / account language is Arabic
 *   'en'    it is English
 *   'both'  we do not know (a guest checkout has no account): the email carries English AND Arabic, one after the other
 *
 * The language is the one the buyer's app last reported (users.language: the same one in-app notifications and push already use).
 */
function resolveEmailLang(language) {
  if (language === 'ar') return 'ar';
  if (language === 'en') return 'en';
  return 'both';
}

// Looks the language up from the recipient's ADDRESS, so every place that sends a buyer an email only needs the address it already has.
async function emailLanguageForAddress(address, client = db) {
  if (!address) return 'both';
  try {
    const { rows } = await client.query('SELECT language FROM users WHERE lower(email) = lower($1)', [address]);
    return rows.length === 0 ? 'both' : resolveEmailLang(rows[0].language);
  } catch {
    return 'both'; // never let a language lookup stop an email going out
  }
}

const SUBJECTS = {
  passwordReset: { en: () => 'Reset your Leap password', ar: () => 'إعادة تعيين كلمة مرور Leap' },
  welcome: { en: () => 'Welcome to Leap', ar: () => 'مرحبًا بك في Leap' },
  orderConfirmed: { en: ({ orderId }) => `Order confirmed — ${orderId}`, ar: ({ orderId }) => `تم تأكيد الطلب — ${orderId}` },
  orderShipped: { en: ({ orderId }) => `Your order has shipped — ${orderId}`, ar: ({ orderId }) => `تم شحن طلبك — ${orderId}` },
  orderDelivered: { en: ({ orderId }) => `Your order has been delivered — ${orderId}`, ar: ({ orderId }) => `تم تسليم طلبك — ${orderId}` },
};

function emailSubject(kind, lang, vars = {}) {
  const entry = SUBJECTS[kind];
  if (!entry) throw new Error(`Unknown email kind: ${kind}`);
  if (lang === 'ar') return entry.ar(vars);
  if (lang === 'both') return `${entry.en(vars)} · ${entry.ar(vars)}`;
  return entry.en(vars);
}

module.exports = { resolveEmailLang, emailLanguageForAddress, emailSubject };
