#!/usr/bin/env node
/**
 * Fix: "Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'" when the storefront starts. The home page fonts an admin can choose (Inter, Poppins, Montserrat, Cairo, Tajawal) are no longer
 * downloaded while the site is built (that step fails with Next 16's Turbopack when Google answers with its newer font addresses); a page now links to Google Fonts directly, only for the fonts it really uses.
 *
 *   node scripts/patch-font-fix.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-font-fix.js --write    applies it (each changed file is saved as <file>.before-font-fix first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/page.tsx", "what": "the home page links to Google Fonts for the fonts it really uses", "done": "HomeFontLink", "pairs": [["import { homeFontStyle } from \"@/lib/homeFonts\";", "import { homeFontStyle } from \"@/lib/homeFonts\";\nimport HomeFontLink from \"@/components/HomeFontLink\";"], ["          <h1 id=\"home-h1\" style={homeFontStyle(homeText?.headline.font)}", "          <HomeFontLink fonts={[homeText?.headline.font, homeText?.subheadline.font]} />\n          <h1 id=\"home-h1\" style={homeFontStyle(homeText?.headline.font)}"]]}, {"file": "apps/web-storefront/app/layout.tsx", "what": "the site's own fonts are linked instead of being downloaded while the site is built", "done": "SITE_FONTS_HREF", "pairs": [["import { IBM_Plex_Sans_Arabic, JetBrains_Mono, Outfit } from \"next/font/google\";", "import { SITE_FONTS_HREF, SITE_FONT_VARS } from \"@/lib/siteFonts\";"], ["const outfit = Outfit({ variable: \"--font-outfit\", weight: [\"400\", \"500\", \"600\", \"700\", \"800\"], subsets: [\"latin\"] });\nconst plexArabic = IBM_Plex_Sans_Arabic({ variable: \"--font-arabic\", weight: [\"400\", \"500\", \"600\", \"700\"], subsets: [\"arabic\"] });\nconst jetbrainsMono = JetBrains_Mono({ variable: \"--font-jetbrains-mono\", weight: [\"500\", \"600\", \"700\"], subsets: [\"latin\"] });", "// (The fonts are linked, not downloaded while the site is built: see lib/siteFonts.ts.)"], ["<html lang={lang} dir={isRtl(lang) ? \"rtl\" : \"ltr\"} className={`${outfit.variable} ${plexArabic.variable} ${jetbrainsMono.variable} h-full antialiased`}>", "<html lang={lang} dir={isRtl(lang) ? \"rtl\" : \"ltr\"} className=\"h-full antialiased\" style={SITE_FONT_VARS}>"], ["      <body className=\"flex min-h-full flex-col bg-chalk text-ink\">", "      <head>\n        <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />\n        <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossOrigin=\"anonymous\" />\n        <link rel=\"stylesheet\" href={SITE_FONTS_HREF} />\n      </head>\n      <body className=\"flex min-h-full flex-col bg-chalk text-ink\">"]]}], "whole": [{"file": "apps/web-storefront/lib/homeFonts.ts", "what": "the home page fonts no longer use the build-time font download", "sha": "00f6106c647d7f108269e98177771293d31eb2f76f6f25a8a8196e03be07e146"}], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'font-fix-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'font-fix-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-font-fix`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
