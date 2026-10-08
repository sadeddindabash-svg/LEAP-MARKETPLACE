// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// The buyer app (Flutter) cannot be compiled where these tests run, so this checks the thing that most often goes wrong when screens are translated: the translation
// TABLE (apps/mobile/lib/core/app_strings.dart) against the CODE that uses it. A key used in a screen but missing from the table shows up in the app as a blank
// or a raw key; an Arabic entry that is empty or still English leaves an Arabic buyer reading English.
const LIB = path.resolve(import.meta.dirname, '../../mobile/lib');
const ARABIC = /[\u0600-\u06FF]/;

function readTable() {
  const source = fs.readFileSync(path.join(LIB, 'core/app_strings.dart'), 'utf8');
  // a value is written 'like this' or, when it contains an apostrophe, "like this"
  const value = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
  const entry = new RegExp(String.raw`^\s*'([a-z_0-9]+)':\s*\{\s*'en':\s*${value},\s*'ar':\s*${value}\s*,?\s*\}`, 'gm');
  const table = new Map();
  for (const m of source.matchAll(entry)) {
    const clean = (v) => v.replace(/\\(['"])/g, '$1');
    table.set(m[1], { en: clean(m[2] ?? m[3]), ar: clean(m[4] ?? m[5]) });
  }
  return table;
}
function dartFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? dartFiles(path.join(dir, e.name)) : e.name.endsWith('.dart') ? [path.join(dir, e.name)] : []));
}
// Every key a screen asks for: tr(context, 'a'), trRead(context, 'a'), and ternaries such as tr(context, cond ? 'a' : 'b').
function usedKeys() {
  const used = new Map();
  for (const file of dartFiles(LIB)) {
    const source = fs.readFileSync(file, 'utf8').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'); // comments are not code
    for (const call of source.matchAll(/\btr(?:Read)?\(\s*context\s*,\s*([^;]*?)\)\s*[,;)\]}.]/g)) {
      for (const k of call[1].matchAll(/'([a-z][a-z_0-9]*)'/g)) { if (!used.has(k[1])) used.set(k[1], path.relative(LIB, file)); }
    }
  }
  return used;
}

describe('the buyer app translation table', () => {
  const table = readTable();

  it('is read correctly (a few hundred entries)', () => {
    expect(table.size).toBeGreaterThan(300);
  });

  it('CRITICAL: every key a screen asks for exists in the table (a missing key shows as a blank or a raw key)', () => {
    const used = usedKeys();
    expect(used.size).toBeGreaterThan(150);
    const missing = [...used].filter(([k]) => !table.has(k)).map(([k, f]) => `${k}  (used in ${f})`);
    expect(missing).toEqual([]);
  });

  it('CRITICAL: every entry has English AND real Arabic (Arabic letters, not empty, not the English text repeated)', () => {
    const bad = [];
    for (const [key, { en, ar }] of table) {
      if (!en.trim()) bad.push(`${key}: English is empty`);
      else if (!ar.trim()) bad.push(`${key}: Arabic is empty`);
      else if (!ARABIC.test(ar)) bad.push(`${key}: Arabic has no Arabic letters ("${ar.slice(0, 40)}")`);
    }
    expect(bad).toEqual([]);
  });

  it('placeholders like {id} appear in BOTH languages, the same ones', () => {
    const bad = [];
    for (const [key, { en, ar }] of table) {
      const a = (en.match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
      const b = (ar.match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
      if (a !== b) bad.push(`${key}: English has [${a}], Arabic has [${b}]`);
    }
    expect(bad).toEqual([]);
  });

  it('the screens translated in this change use the table (no English left in them, apart from known exceptions)', () => {
    const screens = ['features/orders/tracking_screen.dart', 'features/auth/login_two_factor_screen.dart'];
    for (const screen of screens) {
      const source = fs.readFileSync(path.join(LIB, screen), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*|import )/.test(l)).join('\n');
      const literals = [...source.matchAll(/\b(?:Text|SnackBar)\(\s*(?:const\s+)?'([A-Z][^']{3,})'/g)].map((m) => m[1]);
      expect(literals, screen).toEqual([]);
    }
    // the two address forms (checkout + order page) no longer carry their English field labels
    for (const screen of ['features/checkout/checkout_screen.dart', 'features/orders/order_detail_screen.dart']) {
      const source = fs.readFileSync(path.join(LIB, screen), 'utf8');
      for (const label of ["labelText: 'Recipient name'", "labelText: 'Phone'", "labelText: 'Country'", "labelText: 'City'", "labelText: 'Street address'", "'Please fill in every field.'"]) {
        expect(source.includes(label), `${screen} still has ${label}`).toBe(false);
      }
    }
  });

  it('the digit helper exists and covers both Arabic-Indic and Persian digits', () => {
    const source = fs.readFileSync(path.join(LIB, 'core/app_strings.dart'), 'utf8');
    expect(source).toContain('String toWesternDigits(String input)');
    expect(source).toContain("'٠١٢٣٤٥٦٧٨٩'");
    expect(source).toContain("'۰۱۲۳۴۵۶۷۸۹'");
    for (const screen of ['features/auth/login_two_factor_screen.dart', 'features/account/two_factor_setup_screen.dart']) {
      expect(fs.readFileSync(path.join(LIB, screen), 'utf8'), screen).toContain('toWesternDigits(_codeController.text.trim())');
    }
  });
});
