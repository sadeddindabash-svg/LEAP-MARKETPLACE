#!/usr/bin/env node
/**
 * Storefront, round 3: (1) the part-class chip, the fitment chip and the Shopping for box use the page font, the same as the description (English and Arabic); (2) every page title set at the 30 px size is now 20 px, the size of "Find parts for your car";
 * (3) Compare shows SQUARE photos; (4) the Technical Specifications values start at the start side (left in English, right in Arabic); (5) the Verified seller icon is filled; (6) the "Ships from" line shows the country's flag (a globe for a country without one);
 * (7) in Arabic, prices keep the digits 0-9 and only the currency changes ("203 ريال"). Run it AFTER patch-ui-round2.js. No server change, no migration.
 *
 *   node scripts/patch-ui-round3.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-ui-round3.js --write    applies it (each changed file is saved as <file>.before-ui-round3 first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/globals.css", "what": "the chips use the page font, and every title set at 30 px is 20 px (the size of Find parts for your car)", "done": ":is(h1, h2).text-3xl", "pairs": [["  font-family: var(--font-plate), monospace;\n  font-weight: 700;\n  font-size: 11px;\n  letter-spacing: 0.06em;\n  color: var(--color-ink);\n  white-space: nowrap;\n}", "  font-family: var(--font-body), sans-serif;      /* the page font, like the description (the typewriter font has no Arabic of its own) */\n  font-weight: 600;\n  font-size: 13px;\n  letter-spacing: 0;\n  color: var(--color-ink);\n  white-space: nowrap;\n}\n\n/* Titles: every page title and section title set at the big size (text-3xl, 30 px) is the size of \"Find parts for your car\" (text-xl, 20 px). Only h1/h2 are touched: other text at that size (a referral code, an order number) is not. */\n:is(h1, h2).text-3xl {\n  font-size: 1.25rem;\n  line-height: 1.75rem;\n  letter-spacing: normal;\n}"]]}, {"file": "apps/web-storefront/components/VehicleBar.tsx", "what": "the vehicle name in the Shopping for box uses the page font (English and Arabic)", "done": "px-2 py-0.5 text-[13px] font-semibold leading-4 text-white", "pairs": [["rounded-md bg-navy px-2 py-0.5 font-plate text-[12px] font-bold leading-4 text-white", "rounded-md bg-navy px-2 py-0.5 text-[13px] font-semibold leading-4 text-white"]]}, {"file": "apps/web-storefront/app/compare/page.tsx", "what": "Compare shows square photos (the whole photo, on white) instead of wide boxes that cut it", "done": "aspect-square", "pairs": [["<span className=\"relative mb-3 block h-28 overflow-hidden rounded-lg bg-[#e6edf2]\">", "<span className=\"relative mb-3 block aspect-square w-full max-w-36 overflow-hidden rounded-lg border border-line bg-white\">"], ["sizes=\"176px\" className=\"object-cover\" unoptimized />", "sizes=\"144px\" className=\"object-contain p-1.5\" unoptimized />"]]}, {"file": "apps/web-storefront/components/ProductDetails.tsx", "what": "the specifications: labels in a column and the values start at the start side (left in English, right in Arabic), the description in the same column", "done": "grid-cols-[7.5rem_minmax(0,1fr)]", "pairs": [["<div key={`${i}-${label}`} className=\"flex justify-between gap-4 py-2.5\"><dt className=\"text-muted\">{label}</dt><dd className=\"min-w-0 text-end font-semibold text-ink [overflow-wrap:anywhere]\">{value}</dd></div>", "<div key={`${i}-${label}`} className=\"grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)]\"><dt className=\"text-muted\">{label}</dt><dd className=\"min-w-0 text-start font-semibold text-ink [overflow-wrap:anywhere]\">{value}</dd></div>"], ["        <div className=\"py-2.5\"><dt className=\"text-muted\">{t(lang, \"detail_description\")}</dt><dd className=\"mt-1 whitespace-pre-line font-normal leading-relaxed text-ink [overflow-wrap:anywhere]\">{product.description?.trim() ? product.description : none}</dd></div>", "        <div className=\"grid grid-cols-[7.5rem_minmax(0,1fr)] gap-4 py-2.5 sm:grid-cols-[9.5rem_minmax(0,1fr)]\"><dt className=\"text-muted\">{t(lang, \"detail_description\")}</dt><dd className=\"whitespace-pre-line font-normal leading-relaxed text-ink [overflow-wrap:anywhere]\">{product.description?.trim() ? product.description : none}</dd></div>"]]}, {"file": "apps/web-storefront/components/SellerSignals.tsx", "what": "the Verified seller icon is a filled badge, and the Ships from line shows the flag of the country (the globe for a country without one)", "done": "CountryFlag", "pairs": [["import { pickName, t, type Lang } from \"@/lib/i18n\";", "import { pickName, t, type Lang } from \"@/lib/i18n\";\nimport CountryFlag from \"@/components/CountryFlag\";\nimport { flagCodeFor } from \"@/lib/countryFlags\";"], ["  if (!isVerifiedSeller && !shipsFromCountry) return null;", "  if (!isVerifiedSeller && !shipsFromCountry) return null;\n  const flag = flagCodeFor(shipsFromCountry, shipsFromCountryAr);"], ["<svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"#e39f0c\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M12 2l2.4 2.1 3.2-.2.9 3.1 2.7 1.8-1.1 3 1.1 3-2.7 1.8-.9 3.1-3.2-.2L12 22l-2.4-2.1-3.2.2-.9-3.1-2.7-1.8 1.1-3-1.1-3 2.7-1.8.9-3.1 3.2.2z\" /><path d=\"m8.5 12 2.5 2.5 4.5-5\" /></svg>", "<svg aria-hidden=\"true\" data-testid=\"verified-icon\" viewBox=\"0 0 24 24\" width=\"17\" height=\"17\" fill=\"#e39f0c\" stroke=\"#e39f0c\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M12 2l2.4 2.1 3.2-.2.9 3.1 2.7 1.8-1.1 3 1.1 3-2.7 1.8-.9 3.1-3.2-.2L12 22l-2.4-2.1-3.2.2-.9-3.1-2.7-1.8 1.1-3-1.1-3 2.7-1.8.9-3.1 3.2.2z\" /><path d=\"m8.6 12.2 2.3 2.3 4.5-4.7\" fill=\"none\" stroke=\"#fff\" strokeWidth=\"2.2\" /></svg>"], ["<svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20\" /></svg>", "{flag ? <CountryFlag code={flag} /> : (<svg aria-hidden=\"true\" viewBox=\"0 0 24 24\" width=\"15\" height=\"15\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"12\" cy=\"12\" r=\"10\" /><path d=\"M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20\" /></svg>)}"]]}, {"file": "apps/web-storefront/lib/currency.ts", "what": "in Arabic a price keeps the digits 0-9 and only the currency changes (\"160 ريال\")", "done": "ARAB_WORDS", "pairs": [["export const ARAB_SYMBOLS: Record<string, string> = { SAR: \"ر.س\", AED: \"د.إ\", OMR: \"ر.ع.\", KWD: \"د.ك\", BHD: \".د.ب\", QAR: \"ر.ق\", JOD: \"د.ا\" };", "export const ARAB_SYMBOLS: Record<string, string> = { SAR: \"ر.س\", AED: \"د.إ\", OMR: \"ر.ع.\", KWD: \"د.ك\", BHD: \".د.ب\", QAR: \"ر.ق\", JOD: \"د.ا\" };\n/** The currency as a word, for an Arabic page: the number keeps its digits 0-9 and only the currency is Arabic (\"160 ريال\"). Other currencies keep the English style. */\nexport const ARAB_WORDS: Record<string, string> = { SAR: \"ريال\", AED: \"درهم\", OMR: \"ريال\", QAR: \"ريال\", KWD: \"دينار\", BHD: \"دينار\", JOD: \"دينار\", USD: \"دولار\" };"], ["/** (Arabic-Indic digits are asked for explicitly: what plain \"ar\" gives varies by system.) \"SAR 160\" / \"$43\" in English; \"١٦٠ ر.س\" for an Arab currency in Arabic. Whole units, like the app. */", "/** \"SAR 160\" / \"$43\" in English; \"160 ريال\" / \"43 دولار\" in Arabic (the digits stay 0-9; only the currency is Arabic). Whole units, like the app. */"], ["  if (lang === \"ar\" && ARAB_SYMBOLS[code]) return `${new Intl.NumberFormat(\"ar-u-nu-arab\", { maximumFractionDigits: 0 }).format(rounded)} ${ARAB_SYMBOLS[code]}`;", "  if (lang === \"ar\" && ARAB_WORDS[code]) return `${new Intl.NumberFormat(\"en-US\", { maximumFractionDigits: 0 }).format(rounded)} ${ARAB_WORDS[code]}`;"]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(e.done)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a, b] of e.pairs) { if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'ui-round3-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'ui-round3-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-ui-round3`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
