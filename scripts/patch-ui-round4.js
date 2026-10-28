#!/usr/bin/env node
/**
 * Storefront, round 4: (1) the header name "Leap Auto Parts" is all one white, and in Arabic it reads "ليب لقطع السيارات"; the Arabic sentences that said "Leap" in English say "ليب"; (2) Compare: every column the SAME width, the photo and the name centered;
 * (3) on a PHONE (a screen under 768 px) only 2 parts can be picked and are shown (a link with more shows the first 2, with a note); on a tablet or a computer it stays up to 4. Run it AFTER patch-ui-round3.js. No server change, no migration.
 *
 *   node scripts/patch-ui-round4.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-ui-round4.js --write    applies it (each changed file is saved as <file>.before-ui-round4 first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/compare.ts", "what": "a phone compares 2 parts (a screen under 768 px), a tablet or a computer 4", "done": "COMPARE_MAX_PHONE", "pairs": [["export const COMPARE_MAX = 4;\n", "export const COMPARE_MAX = 4;\n/** On a phone (a screen under PHONE_MAX_WIDTH px wide) only 2 parts are compared; the comparison table is not wide enough for more. */\nexport const COMPARE_MAX_PHONE = 2;\nexport const PHONE_MAX_WIDTH = 767;\n"], ["export function compareHref(ids: string[]): string {\n  return `/compare?ids=${ids.slice(0, COMPARE_MAX).map(encodeURIComponent).join(\",\")}`;\n}", "export function compareHref(ids: string[], max: number = COMPARE_MAX): string {\n  return `/compare?ids=${ids.slice(0, max).map(encodeURIComponent).join(\",\")}`;\n}"]]}, {"file": "apps/web-storefront/app/compare/page.tsx", "what": "Compare: all columns the same width, the photo and the name centered, and on a phone only 2 parts (with a note when more were asked for)", "done": "COMPARE_MAX_PHONE", "pairs": [["import { parseIds } from \"@/lib/compare\";", "import { COMPARE_MAX_PHONE, parseIds } from \"@/lib/compare\";"], ["<table className=\"w-full min-w-[640px] border-collapse text-start\">", "<table className=\"w-full table-fixed border-collapse text-start\">"], ["<td className=\"w-40 bg-[#eef2f5]\" />", "<td className=\"w-28 bg-[#eef2f5] md:w-40\" />"], ["                {found.map((p) => (\n                  <th key={p.id} scope=\"col\" className=\"min-w-44 border-s border-line p-4 text-start align-top\">", "                {found.map((p, i) => (\n                  <th key={p.id} scope=\"col\" className={`border-s border-line p-3 text-center align-top md:p-4 ${i >= COMPARE_MAX_PHONE ? \"max-md:hidden\" : \"\"}`}>"], ["relative mb-3 block aspect-square w-full max-w-36", "relative mx-auto mb-3 block aspect-square w-full max-w-36"], ["className=\"bg-[#eef2f5] p-4 text-start text-[13px] font-bold uppercase tracking-wide text-[#33424d]\"", "className=\"bg-[#eef2f5] p-3 text-start text-[13px] font-bold uppercase tracking-wide text-[#33424d] md:p-4\""], ["{found.map((p) => <td key={p.id} className=\"border-s border-line p-4 text-[15px]\">{cell(p)}</td>)}", "{found.map((p, i) => <td key={p.id} className={`border-s border-line p-3 text-[15px] md:p-4 ${i >= COMPARE_MAX_PHONE ? \"max-md:hidden\" : \"\"}`}>{cell(p)}</td>)}"], ["        <div className=\"overflow-x-auto rounded-[14px] border border-line bg-white\">", "        <>\n        {found.length > COMPARE_MAX_PHONE && <p data-testid=\"compare-phone-note\" className=\"mb-3 text-sm text-muted md:hidden\">{t(lang, \"compare_phone_note\", { total: found.length })}</p>}\n        <div className=\"overflow-x-auto rounded-[14px] border border-line bg-white\">"], ["        </div>\n      )}\n    </div>\n  );\n}", "        </div>\n        </>\n      )}\n    </div>\n  );\n}"]]}, {"file": "apps/web-storefront/app/wishlist/page.tsx", "what": "the wishlist picks at most 2 parts to compare on a phone, 4 on a tablet or a computer", "done": "useCompareMax", "pairs": [["import { COMPARE_MAX, COMPARE_MIN, compareHref } from \"@/lib/compare\";", "import { COMPARE_MAX, COMPARE_MIN, compareHref } from \"@/lib/compare\";\nimport useCompareMax from \"@/components/useCompareMax\";"], ["  const [selected, setSelected] = useState<string[]>([]);\n", "  const [selected, setSelected] = useState<string[]>([]);\n  const max = useCompareMax();      // 2 on a phone, 4 on a tablet or a computer\n  useEffect(() => { setSelected((cur) => (cur.length > max ? cur.slice(0, max) : cur)); }, [max]);      // the screen was turned or resized: keep only what fits\n"], ["{compareMode && <p className=\"mt-3 text-sm text-muted\">{t(\"compare_pick_hint\")}</p>}", "{compareMode && <p className=\"mt-3 text-sm text-muted\">{t(max < COMPARE_MAX ? \"compare_pick_hint_phone\" : \"compare_pick_hint\")}</p>}"], ["disabled={!selected.includes(p.id) && selected.length >= COMPARE_MAX}", "disabled={!selected.includes(p.id) && selected.length >= max}"], ["<Link href={compareHref(selected)}", "<Link href={compareHref(selected, max)}"]]}, {"file": "apps/web-storefront/components/SiteHeader.tsx", "what": "the header name is all one white and reads \"ليب لقطع السيارات\" in Arabic (with no tight letter spacing, which squeezes Arabic letters)", "done": "brand_lead", "pairs": [["className=\"flex items-center gap-3 text-[22px] font-bold tracking-tight\">", "className={`flex items-center gap-3 text-[22px] font-bold ${lang === \"ar\" ? \"tracking-normal\" : \"tracking-tight\"}`}>"], ["<span>Leap<span className=\"font-medium opacity-85\"> Auto Parts</span></span>", "<span>{t(lang, \"brand_lead\")}<span className=\"font-medium\"> {t(lang, \"brand_rest\")}</span></span>"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the new wording (the brand name in the header, the phone compare hint and note) in English and Arabic, and \"Leap\" written in Arabic in the Arabic sentences", "done": "brand_lead", "pairs": [["  logo_home_label: \"Leap Auto Parts, home\",", "  logo_home_label: \"Leap Auto Parts, home\",\n  brand_lead: \"Leap\",\n  brand_rest: \"Auto Parts\","], ["  logo_home_label: \"ليب لقطع السيارات، الرئيسية\",", "  logo_home_label: \"ليب لقطع السيارات، الرئيسية\",\n  brand_lead: \"ليب\",\n  brand_rest: \"لقطع السيارات\","], ["  compare_pick_hint: \"Pick 2 to 4 parts to compare.\",", "  compare_pick_hint: \"Pick 2 to 4 parts to compare.\",\n  compare_pick_hint_phone: \"Pick 2 parts to compare. On a phone, 2 at a time.\",\n  compare_phone_note: \"Showing 2 of {total} parts. Open this page on a tablet or a computer to compare them all.\","], ["  compare_pick_hint: \"اختر من 2 إلى 4 قطع للمقارنة.\",", "  compare_pick_hint: \"اختر من 2 إلى 4 قطع للمقارنة.\",\n  compare_pick_hint_phone: \"اختر قطعتين للمقارنة. على الهاتف تُقارَن قطعتان في المرة الواحدة.\",\n  compare_phone_note: \"تُعرض قطعتان من أصل {total} قطع. افتح هذه الصفحة على جهاز لوحي أو حاسوب لمقارنة جميع القطع.\","], ["  return_goes_to_team: \"يذهب هذا إلى فريق Leap، الذي سينسق مع المورد — لن تتواصل معه مباشرة.\",", "  return_goes_to_team: \"يذهب هذا إلى فريق ليب، الذي سينسق مع المورد — لن تتواصل معه مباشرة.\","], ["  support_title: \"دعم Leap\",", "  support_title: \"دعم ليب\","], ["  support_notice: \"أنت تراسل فريق Leap، وليس المورد مباشرة.\",", "  support_notice: \"أنت تراسل فريق ليب، وليس المورد مباشرة.\","], ["  referral_share_text: \"استخدم رمزي للحصول على خصم على طلبك الأول في Leap: {url}\",", "  referral_share_text: \"استخدم رمزي للحصول على خصم على طلبك الأول في ليب: {url}\","]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'ui-round4-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'ui-round4-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-ui-round4`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
