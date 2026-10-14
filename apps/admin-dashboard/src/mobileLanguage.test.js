// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The buyer app (Flutter) cannot be compiled where these tests run, so they read its sources. They guard the way the app decides WHICH language to show, and the
// text that used to stay English in Arabic mode:
//   - a screen must read the language chosen INSIDE the app (LanguageState). It used to ask the phone (Localizations.localeOf), so with a phone in English and the
//     app set to Arabic, the order page showed "Track your package", "Cancel order" and so on;
//   - no new English-only text in a screen;
//   - the server's English error messages are put in Arabic once, where the error is created.
const ROOT = path.resolve(import.meta.dirname, '../../..');
const LIB = path.join(ROOT, 'apps/mobile/lib');
const ARABIC = /[\u0600-\u06FF]/;
const read = (p) => fs.readFileSync(path.join(LIB, p), 'utf8');
const dartFiles = (dir = LIB) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dartFiles(path.join(dir, e.name)) : e.name.endsWith('.dart') ? [path.join(dir, e.name)] : []));
const codeLines = (source) => source.split('\n').map((l) => (/^\s*\/\//.test(l) ? '' : l.replace(/\/\/.*$/, '')));
const rel = (f) => path.relative(LIB, f);

describe('the buyer app follows the language chosen in the app', () => {
  it('CRITICAL: no screen decides the language from the PHONE\'s locale (the app\'s own setting is LanguageState)', () => {
    const offenders = [];
    for (const file of dartFiles()) {
      codeLines(fs.readFileSync(file, 'utf8')).forEach((l, i) => {
        // (core/currency_state.dart reads the phone's REGION to pick a default currency: that is not the language, and stays)
        if (/Localizations\.localeOf\(context\)\.languageCode|Platform\.localeName/.test(l)) offenders.push(`${rel(file)}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('CRITICAL: the order page\'s buttons and dialogs read the app language, and carry both languages for every text the buyer reported', () => {
    const src = read('features/orders/order_detail_screen.dart');
    expect((src.match(/context\.watch<LanguageState>\(\)\.isArabic/g) || []).length).toBeGreaterThanOrEqual(5);          // build: Track, Download, Reorder, Adding, Cancel
    expect((src.match(/context\.read<LanguageState>\(\)\.isArabic/g) || []).length).toBeGreaterThanOrEqual(3);           // callbacks: the two cancel dialogs, reorder
    for (const pair of [['تتبع الطلب', 'Track your package'], ['تنزيل الإيصال', 'Download receipt'], ['إعادة الطلب', 'Reorder'], ['إلغاء الطلب؟', 'Cancel this order?'],
      ['لا يمكن التراجع عن هذا الإجراء.', 'This cannot be undone.'], ['رجوع', 'Back'], ['إلغاء الطلب', 'Cancel order']]) {
      expect(src, pair[1]).toContain(pair[0]);
      expect(src, pair[0]).toContain(pair[1]);
    }
    expect(src).toMatch(/import '\.\.\/\.\.\/core\/language_state\.dart';/);
  });

  it('every file that reads the app language imports what it needs (provider and the language state)', () => {
    const bad = [];
    for (const file of dartFiles()) {
      const src = fs.readFileSync(file, 'utf8');
      if (/context\.(watch|read)<LanguageState>/.test(codeLines(src).join('\n'))) {          // real code, not a comment that mentions it
        if (!/package:provider\/provider\.dart/.test(src)) bad.push(`${rel(file)}: no provider import`);
        if (!/language_state\.dart/.test(src)) bad.push(`${rel(file)}: no language_state import`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('CRITICAL: the sub-category page title is the part\'s name in the buyer\'s language; the English name stays only as the server filter', () => {
    const screen = read('features/catalog/category_screen.dart');
    expect(screen).toMatch(/final String\? partLabel;/);
    expect(screen).toMatch(/String get _title => partLabel \?\? part \?\? categoryName;/);
    expect(screen).not.toMatch(/AppBar\(title: Text\(widget\.part\b/);
    expect((screen.match(/AppBar\(title: Text\(widget\._title\)\)/g) || []).length).toBe(2);                    // loading state and loaded state
    expect(screen).toMatch(/fetchProductsByCategory\(widget\.categoryId, part: widget\.part,/);                  // the filter is still the English name
    expect(read('app.dart')).toMatch(/partLabel = extra\['partLabel'\] as String\?;/);
    expect(read('app.dart')).toMatch(/partLabel: partLabel,/);
    expect(read('features/catalog/category_browse_screen.dart')).toMatch(/'partLabel': partLabel/);
    const wizard = read('features/catalog/which_part_wizard_screen.dart');
    expect(wizard).toMatch(/'partLabel': p\.displayName\(isAr\)/);
    expect(wizard).not.toMatch(/'categoryName': category\.nameEn/);                                               // the category name is localized too
  });

  it('the status badge takes its labels from the translation table (no English literals)', () => {
    const src = read('widgets/status_badge.dart');
    expect(src).not.toMatch(/label:\s*'[A-Z]/);
    for (const k of ['status_to_pay', 'status_to_ship', 'status_shipped', 'status_to_review', 'status_delivered', 'status_returns']) expect(src).toContain(`'${k}'`);
  });
});

// A port of the audit that found the leftovers: a plain English text in a place the buyer reads (Text, tooltip, hint, label, title, snackbar) that is NOT inside
// an expression that translates it. Texts built with ${...} are skipped (they are dynamic), and the few that must stay English are listed with the reason.
const LITERAL = String.raw`(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")`;
const PLACES = [String.raw`\bText\(\s*`, String.raw`\bhintText:\s*`, String.raw`\blabelText:\s*`, String.raw`\bhelperText:\s*`, String.raw`\berrorText:\s*`, String.raw`\blabel:\s*(?:const\s+)?(?:Text\(\s*)?`,
  String.raw`\btitle:\s*(?:const\s+)?(?:Text\(\s*)?`, String.raw`\bsubtitle:\s*(?:const\s+)?(?:Text\(\s*)?`, String.raw`\btooltip:\s*`, String.raw`\bcontent:\s*(?:const\s+)?(?:Text\(\s*)?`,
  String.raw`\bsemanticsLabel:\s*`].map((p) => new RegExp(p + LITERAL, 'g'));
const MUST_STAY_ENGLISH = new Set(['app.dart::LEAP Auto Parts']);          // the name of the app itself (the title the phone shows in the task switcher)

describe('no English-only text is left in a screen', () => {
  it('CRITICAL: every visible text is translated (a plain English literal in a Text, tooltip, hint, label, title or snackbar is a bug)', () => {
    const found = [];
    for (const file of dartFiles()) {
      if (/core\/(app_strings|server_messages|arabic_country_names|country_phone_codes)\.dart$/.test(file)) continue;
      const lines = codeLines(fs.readFileSync(file, 'utf8'));
      lines.forEach((line, i) => {
        for (const re of PLACES) {
          for (const m of line.matchAll(re)) {
            const text = m[1] ?? m[2];
            if (text.includes('${') || text.includes('$')) continue;
            if (!/[A-Za-z]{3,}/.test(text) || /^[a-z_0-9./:#-]+$/.test(text.trim())) continue;
            const window = lines.slice(Math.max(0, i - 1), i + 2).join(' ');
            if (ARABIC.test(window) || /\btr(Read)?\(|isAr\b|isArabic|languageCode/.test(window)) continue;
            if (MUST_STAY_ENGLISH.has(`${rel(file)}::${text}`)) continue;
            found.push(`${rel(file)}:${i + 1}  "${text}"`);
          }
        }
      });
    }
    expect(found).toEqual([]);
  });
});

// ---- the server's English messages, in Arabic ----
function readMessageMap() {
  const src = fs.readFileSync(path.join(LIB, 'core/server_messages.dart'), 'utf8');
  const body = src.slice(src.indexOf('const Map<String, String> kServerMessagesAr = {'), src.indexOf('\n};'));
  const str = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
  const map = new Map();
  for (const m of body.matchAll(new RegExp(String.raw`^\s*${str}\s*:\s*${str}\s*,`, 'gm'))) {
    const clean = (v) => v.replace(/\\(['"])/g, '$1');
    map.set(clean(m[1] ?? m[2]), clean(m[3] ?? m[4]));
  }
  return { map, src };
}
const serverSource = () => {
  const all = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (e.name.endsWith('.js') && !/\.test\./.test(e.name)) all.push(fs.readFileSync(p, 'utf8')); } };
  walk(path.join(ROOT, 'services/api/src'));
  return all.join('\n').replace(/\\'/g, "'");
};

describe('the server\'s English error messages are shown in Arabic', () => {
  const { map, src } = readMessageMap();

  it('is read correctly (about 85 messages) and every Arabic text is real Arabic', () => {
    expect(map.size).toBeGreaterThanOrEqual(80);
    const bad = [...map].filter(([k, v]) => !v.trim() || !ARABIC.test(v) || v === k).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('CRITICAL: every English key is a message that really exists, word for word, in the server or the app (a reworded message must not silently fall back to English)', () => {
    const app = dartFiles().filter((f) => !/server_messages\.dart$/.test(f)).map((f) => fs.readFileSync(f, 'utf8')).join('\n').replace(/\\'/g, "'");
    const server = serverSource();
    const stale = [...map.keys()].filter((k) => !server.includes(k) && !app.includes(k));
    expect(stale).toEqual([]);
  });

  it('CRITICAL: the exception translates its own message in Arabic only, once, and the language is readable where no context exists', () => {
    const api = fs.readFileSync(path.join(LIB, 'services/api_client.dart'), 'utf8');
    expect(api).toMatch(/ApiException\(String message, \{this\.isNetworkError = false, this\.code, this\.details\}\)\s*:\s*message = LanguageState\.arabicNow \? localizeServerMessage\(message\) : message;/);
    expect(api).toMatch(/import '\.\.\/core\/server_messages\.dart';/);
    expect(api).toMatch(/import '\.\.\/core\/language_state\.dart';/);
    const lang = read('core/language_state.dart');
    expect(lang).toMatch(/static bool arabicNow = false;/);
    expect(lang).toMatch(/arabicNow = _language == 'ar';/);                      // when the saved choice is loaded
    expect(lang).toMatch(/arabicNow = language == 'ar';/);                       // when the buyer changes it
  });

  it('CRITICAL: the app\'s own generic failures ("Failed to load orders (500)" and the like) are all covered by the generic Arabic pattern, and the pattern does not swallow other text', () => {
    const regexes = [...src.matchAll(/RegExp\(r'([^']*)'(?:, dotAll: true)?\)/g)].map((m) => ({ source: m[1], re: new RegExp(m[1], /dotAll/.test(m[0]) ? 's' : '') }));
    const failed = regexes.find((r) => r.source.includes('Failed to|Could not'));
    const reach = regexes.find((r) => r.source.includes('reach the server'));
    expect(failed && reach).toBeTruthy();
    const api = fs.readFileSync(path.join(LIB, 'services/api_client.dart'), 'utf8');
    const generic = [...api.matchAll(/ApiException\(\s*'((?:Failed to|Could not|Search failed|Session expired)[^']*\(\$\{[^}]*\}\))'/g)].map((m) => m[1].replace(/\$\{[^}]*\}/g, '500'));
    expect(generic.length).toBeGreaterThan(50);
    expect(generic.filter((t) => !failed.re.test(t) && !reach.re.test(t) && !map.has(t))).toEqual([]);
    expect(failed.re.test('Failed to load orders (500)')).toBe(true);
    expect(failed.re.test('Search failed (404)')).toBe(true);
    expect(failed.re.test('Invalid email or password')).toBe(false);              // real messages are not swallowed
    expect(failed.re.test('Could not update your photo')).toBe(false);
    expect(reach.re.test('Could not reach the server: No internet connection.')).toBe(true);
  });

  it('every message the buyer is most likely to meet is translated (sign in, cancel an order, a missing order, a bad link, no connection)', () => {
    for (const k of ['Invalid email or password', 'Incorrect password', 'An account with this email already exists', 'Password must be at least 8 characters', 'Invalid or expired reset link',
      'This order is already cancelled.', 'Order not found', 'Product not found', 'Ticket not found', 'No internet connection. Check your network and try again.',
      'The request took too long to respond. Check your connection and try again.', 'Stripe is not configured. Set it up in the admin portal\'s Payment Providers page.']) {
      expect(map.has(k), k).toBe(true);
    }
  });
});
