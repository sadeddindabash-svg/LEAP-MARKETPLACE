#!/usr/bin/env node
/**
 * The storefront footer: editable text, social media icons, and the six pages (About us, Terms & Conditions, Delivery & Shipping, Refund, Privacy Policy, Cancellation) inside the storefront.
 * Run it AFTER scripts/patch-product-page.js (and scripts/patch-home-spacing.js if you applied it).
 *
 *   node scripts/patch-footer.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-footer.js --write    applies it (each changed file is saved as <file>.before-footer first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/platform-settings/routes.js", "what": "mount the footer routes: /platform-settings/footer", "done": "require('./footer')", "pairs": [["router.use('/home-text', require('./homeText'));", "router.use('/home-text', require('./homeText'));\n\n// The storefront footer: texts, social media icons and the six pages (see footer.js).\nrouter.use('/footer', require('./footer'));"]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "fetchFooterContent() and fetchLegalPage()", "done": "fetchFooterContent", "pairs": [["import type { HomeText } from \"./homeText\";", "import type { HomeText } from \"./homeText\";\nimport type { FooterContent, LegalPageDto, PageKey } from \"./footerContent\";"], ["/** The texts the admin set for the home page (top bar, headline, sub-headline), or null when the shop cannot be reached (the website then uses its own wording). */", "/** The footer as the admin set it (texts, social media icons, which pages have text), or null when the shop cannot be reached (the website then uses its own footer). */\nexport async function fetchFooterContent(): Promise<FooterContent | null> {\n  try {\n    return await apiGet<FooterContent>(\"/platform-settings/footer\");\n  } catch {\n    return null;\n  }\n}\n/** One of the six pages (its title and text, in both languages), or null when it cannot be read. */\nexport async function fetchLegalPage(key: PageKey): Promise<LegalPageDto | null> {\n  try {\n    return await apiGet<LegalPageDto>(`/platform-settings/footer/pages/${key}`);\n  } catch {\n    return null;\n  }\n}\n\n/** The texts the admin set for the home page (top bar, headline, sub-headline), or null when the shop cannot be reached (the website then uses its own wording). */"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the words of the six pages", "done": "legal_preparing", "pairs": [["  more_model_parts: \"More parts for {name}\",", "  more_model_parts: \"More parts for {name}\",\n  legal_preparing: \"This page is being prepared. Please check back soon.\",\n  legal_updated: \"Last updated: {date}\",\n  footer_social: \"Follow us\","], ["  more_model_parts: \"المزيد من القطع لـ {name}\",", "  more_model_parts: \"المزيد من القطع لـ {name}\",\n  legal_preparing: \"هذه الصفحة قيد الإعداد. يرجى العودة قريباً.\",\n  legal_updated: \"آخر تحديث: {date}\",\n  footer_social: \"تابعنا\","]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "the Footer text, Footer social media and Pages cards, after the Home page text card", "done": "LegalPagesSection", "pairs": [["import HomeTextSection from \"./HomeTextSection\";", "import HomeTextSection from \"./HomeTextSection\";\nimport FooterTextSection from \"./FooterTextSection\";\nimport SocialLinksSection from \"./SocialLinksSection\";\nimport LegalPagesSection from \"./LegalPagesSection\";"], ["          <HomeTextSection onSessionExpired={onSessionExpired} />", "          <HomeTextSection onSessionExpired={onSessionExpired} />\n          <FooterTextSection onSessionExpired={onSessionExpired} />\n          <SocialLinksSection onSessionExpired={onSessionExpired} />\n          <LegalPagesSection onSessionExpired={onSessionExpired} />"]]}, {"file": "apps/web-storefront/lib/seo.test.ts", "what": "the site-wide test knows the six new pages (and the old privacy address) are public on purpose", "done": "cancellation-replacement-policy", "pairs": [["const PUBLIC_SECTIONS = [\"products\", \"search\", \"find\", \"contact\"];", "const PUBLIC_SECTIONS = [\"products\", \"search\", \"find\", \"contact\", \"about-us\", \"terms-conditions\", \"delivery-shipping-policy\", \"refund-policy\", \"privacy-policy\", \"cancellation-replacement-policy\", \"privecy-policy\"];"]]}], "whole": [{"file": "apps/web-storefront/components/SiteFooter.tsx", "what": "the footer: editable text, social media icons, the six links to the new pages", "sha": "474b2a0c5a6306d42626a004f0e8d087905a2fab6ba8292abcacb2694da018d1"}], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'footer-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'footer-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-footer`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
