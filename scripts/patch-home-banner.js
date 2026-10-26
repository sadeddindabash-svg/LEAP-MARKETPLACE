#!/usr/bin/env node
/**
 * Home page banner: next to the "Find parts for your car" box the home page shows EITHER the headline and sub-headline OR a banner of up to 10 advertisement photos (an English and an Arabic photo for each, its own seconds and
 * an optional link), chosen by one switch in the admin portal (Settings > Home banner). This is the SERVER, ADMIN PORTAL and WEBSITE part (the mobile app is a separate package).
 *
 *   node scripts/patch-home-banner.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-home-banner.js --write    applies it (each changed file is saved as <file>.before-home-banner first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already"). No database migration.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/platform-settings/routes.js", "what": "mount the home banner routes: /platform-settings/home-banner", "done": "home-banner", "pairs": [["router.use('/home-text', require('./homeText'));", "router.use('/home-text', require('./homeText'));\nrouter.use('/home-banner', require('./homeBanner'));      // the home page banner: slides, English and Arabic photos, seconds, links, and the headline-or-banner switch"]]}, {"file": "apps/web-storefront/app/page.tsx", "what": "the home page: the banner or the headline beside the finder box", "done": "showBanner", "pairs": [["import { fetchAnnouncements, fetchCategories, fetchHomePictures, fetchHomeText, fetchProducts, fetchSiteStats, fetchVehicleBrands } from \"@/lib/api\";", "import { fetchAnnouncements, fetchCategories, fetchHomeBanner, fetchHomePictures, fetchHomeText, fetchProducts, fetchSiteStats, fetchVehicleBrands, resolveImageUrl } from \"@/lib/api\";"], ["import { alternatesFor, websiteJsonLd } from \"@/lib/seo\";", "import { alternatesFor, websiteJsonLd } from \"@/lib/seo\";\nimport HomeBanner from \"@/components/HomeBanner\";\nimport { viewSlides } from \"@/lib/homeBanner\";"], ["  const lang = await getLang();\n", "  const lang = await getLang();\n  // The banner is optional: if it cannot be read (or is not set up) the home page simply shows the headline, as it always did.\n  const bannerPromise = (async () => { try { return await fetchHomeBanner(); } catch { return null; } })();\n"], ["  const newest = products.slice(0, NEWEST_PAGE_SIZE);\n", "  const newest = products.slice(0, NEWEST_PAGE_SIZE);\n  const banner = await bannerPromise;\n  const bannerSlides = banner?.mode === \"banner\" ? viewSlides(banner, lang, resolveImageUrl) : [];\n  const showBanner = bannerSlides.length > 0;\n"], ["      <section className=\"mx-auto grid max-w-7xl items-center gap-12 px-4 pb-4 pt-12 sm:px-8 lg:grid-cols-[1.1fr_1fr]\" aria-labelledby=\"home-h1\">\n        <div>\n          <HomeFontLink fonts={[homeText?.headline.font, homeText?.subheadline.font]} />\n          <h1 id=\"home-h1\" style={homeFontStyle(homeText?.headline.font)} className={`${HEADLINE_SIZE_CLASS[homeText?.headline.size ?? \"large\"]} font-bold leading-[1.08] tracking-tight text-navy`}>{pickHomeText(homeText?.headline, lang, t(lang, \"hero_title\"))}</h1>\n          <p style={homeFontStyle(homeText?.subheadline.font)} className={`mt-4 max-w-lg ${SUBHEADLINE_SIZE_CLASS[homeText?.subheadline.size ?? \"medium\"]} text-muted`}>{pickHomeText(homeText?.subheadline, lang, t(lang, \"hero_lead\"))}</p>\n        </div>\n        <HeroPicker />\n      </section>", "      {/* The left side of the hero is EITHER the headline and sub-headline OR the banner (one switch in the admin portal), never both. The banner is as big as the finder box beside it. The page keeps its h1 for search engines either way. */}\n      <section className={`mx-auto grid max-w-7xl px-4 pb-4 pt-12 sm:px-8 ${showBanner ? \"gap-6 lg:grid-cols-2 lg:items-stretch\" : \"items-center gap-12 lg:grid-cols-[1.1fr_1fr]\"}`} aria-labelledby=\"home-h1\">\n        {showBanner ? (\n          <>\n            <h1 id=\"home-h1\" className=\"sr-only\">{pickHomeText(homeText?.headline, lang, t(lang, \"hero_title\"))}</h1>\n            <HomeBanner slides={bannerSlides} rtl={lang === \"ar\"} />\n          </>\n        ) : (\n          <div>\n            <HomeFontLink fonts={[homeText?.headline.font, homeText?.subheadline.font]} />\n            <h1 id=\"home-h1\" style={homeFontStyle(homeText?.headline.font)} className={`${HEADLINE_SIZE_CLASS[homeText?.headline.size ?? \"large\"]} font-bold leading-[1.08] tracking-tight text-navy`}>{pickHomeText(homeText?.headline, lang, t(lang, \"hero_title\"))}</h1>\n            <p style={homeFontStyle(homeText?.subheadline.font)} className={`mt-4 max-w-lg ${SUBHEADLINE_SIZE_CLASS[homeText?.subheadline.size ?? \"medium\"]} text-muted`}>{pickHomeText(homeText?.subheadline, lang, t(lang, \"hero_lead\"))}</p>\n          </div>\n        )}\n        <HeroPicker />\n      </section>"]]}, {"file": "apps/web-storefront/lib/api.ts", "what": "read the home page banner from the server", "done": "fetchHomeBanner", "pairs": [["/** The four real totals of the home page (counted by the server). */", "/** The home page banner: whether to show the headline or the banner, and the slides (services/api/src/modules/platform-settings/homeBanner.js). */\nexport async function fetchHomeBanner(): Promise<import(\"./homeBanner\").HomeBanner | null> {\n  return apiGet<import(\"./homeBanner\").HomeBanner>(\"/platform-settings/home-banner\");\n}\n\n/** The four real totals of the home page (counted by the server). */"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the wording of the banner's arrows and dots (English and Arabic)", "done": "banner_label", "pairs": [["  add_to_cart: \"Add to cart\",", "  add_to_cart: \"Add to cart\",\n  banner_label: \"Advertisements\",\n  banner_prev: \"Previous photo\",\n  banner_next: \"Next photo\",\n  banner_go_to: \"Go to photo {n}\","], ["  add_to_cart: \"أضف إلى السلة\",", "  add_to_cart: \"أضف إلى السلة\",\n  banner_label: \"إعلانات\",\n  banner_prev: \"الصورة السابقة\",\n  banner_next: \"الصورة التالية\",\n  banner_go_to: \"الانتقال إلى الصورة {n}\","]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "Settings gets the Home banner card (under the home texts)", "done": "HomeBannerSection", "pairs": [["import HomeTextSection from \"./HomeTextSection\";", "import HomeTextSection from \"./HomeTextSection\";\nimport HomeBannerSection from \"./HomeBannerSection\";"], ["          <HomeTextSection onSessionExpired={onSessionExpired} />", "          <HomeTextSection onSessionExpired={onSessionExpired} />\n          <HomeBannerSection onSessionExpired={onSessionExpired} />"]]}], "whole": [], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'home-banner-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'home-banner-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-home-banner`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
