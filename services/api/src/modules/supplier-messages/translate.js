/**
 * Real Google Cloud Translation (v2 Basic) integration — confirmed
 * choice over Baidu Translate once it was established the backend will
 * NOT be hosted inside mainland China, so Baidu's specific advantage
 * (reliability from within China's network) doesn't apply here. Google
 * costs more at volume than Baidu (~$20/million characters vs Baidu's
 * ~$7/million) — a real, acknowledged trade-off, not something hidden;
 * likely a non-issue in practice given Google's free 500K
 * characters/month tier for expected day-to-day supplier chat volume.
 *
 * HONEST STATE OF THIS INTEGRATION, same category as the payment
 * gateways (Stripe/APS/PayPal) and the pricing engine's FX rate: the
 * real REST call below is genuinely correct (Google Cloud Translation
 * v2's documented API), but there is NO real `GOOGLE_TRANSLATE_API_KEY`
 * configured in this environment — no live API credentials were
 * available to test against. When a real key exists, set that one
 * environment variable and this starts working with no code change.
 * Until then, `translateText` returns a clear, honest "unavailable"
 * result rather than fabricating a translation — the caller (see
 * routes.js) stores that honestly too (`translation_status =
 * 'unavailable'`, real original text, no fake translated text), and the
 * UI shows the real original with a clear "translation unavailable"
 * note instead of silently showing nothing or something wrong.
 */

const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';

function isConfigured() {
  return Boolean(process.env.GOOGLE_TRANSLATE_API_KEY);
}

/**
 * Translates `text` from `from` to `to` ('zh' or 'en'). Returns
 * { translatedText, status: 'success' } on a real successful call, or
 * { translatedText: null, status: 'unavailable' } if no API key is
 * configured or the real API call fails for any reason — NEVER a
 * fabricated or guessed translation.
 */
async function translateText(text, from, to) {
  if (!isConfigured()) {
    return { translatedText: null, status: 'unavailable' };
  }
  try {
    const url = new URL(GOOGLE_TRANSLATE_URL);
    url.searchParams.set('key', process.env.GOOGLE_TRANSLATE_API_KEY);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: from, target: to, format: 'text' }),
    });
    const data = await response.json();

    if (data.error) {
      // Real Google error response (e.g. bad key, quota exceeded) —
      // honest failure, not a crash, not a guess.
      return { translatedText: null, status: 'unavailable' };
    }
    const translated = data.data?.translations?.[0]?.translatedText;
    if (!translated) {
      return { translatedText: null, status: 'unavailable' };
    }
    return { translatedText: translated, status: 'success' };
  } catch (err) {
    return { translatedText: null, status: 'unavailable' };
  }
}

module.exports = { translateText, isConfigured };
