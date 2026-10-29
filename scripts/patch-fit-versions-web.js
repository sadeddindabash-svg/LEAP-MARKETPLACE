#!/usr/bin/env node
/**
 * Website: the buyer's "does this part fit my car?" message (FitCheck: the cart, and the product page where it is used) uses the buyer's VERSION when the part is narrowed to some versions of the car:
 * green "Confirmed fit" (with the versions the part is for), an amber "Doesn't fit your version" (information only: the buyer can still order), or a grey "Choose your version to check". A part that is not narrowed behaves exactly as before.
 * Needs lib/fitVerdict.ts from the same package and the server package (patch-fit-versions.js, migration 114). Run it AFTER the other storefront patches.
 *
 *   node scripts/patch-fit-versions-web.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-fit-versions-web.js --write    applies it (each changed file is saved as <file>.before-fit-versions-web first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/api.ts", "what": "the product answer carries the versions a car is narrowed to", "done": "fitVersions", "pairs": [["  fitKeys?: string[];", "  fitKeys?: string[];\n  /** The cars of this part that are narrowed to some versions ({ \"generation|year\": [version ids] }) and the names of those versions. A car that is not in it fits every version. */\n  fitVersions?: Record<string, string[]>;\n  fitVersionNames?: Record<string, { name: string; nameAr?: string | null; nameZh?: string | null }>;"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the words of the version fit messages (English and Arabic)", "done": "fit_wrong_version", "pairs": [["  confirmed_fit_for: \"Confirmed fit: {car}\",", "  confirmed_fit_for: \"Confirmed fit: {car}\",\n  fit_part_is_for: \"This part is for: {versions}\",\n  fit_wrong_version: \"Doesn't fit your version.\",\n  fit_wrong_version_detail: \"This part is for {versions}. Your car: {car}. You can still order it.\",\n  fit_need_version: \"This part fits only some versions of {car}: {versions}.\",\n  fit_choose_version: \"Choose your version to check\","], ["  confirmed_fit_for: \"توافق مؤكد: {car}\",", "  confirmed_fit_for: \"توافق مؤكد: {car}\",\n  fit_part_is_for: \"هذه القطعة مخصصة لـ: {versions}\",\n  fit_wrong_version: \"لا تناسب إصدار سيارتك.\",\n  fit_wrong_version_detail: \"هذه القطعة مخصصة لـ {versions}. سيارتك: {car}. يمكنك طلبها مع ذلك.\",\n  fit_need_version: \"هذه القطعة تناسب بعض إصدارات {car} فقط: {versions}.\",\n  fit_choose_version: \"اختر إصدار سيارتك للتحقق\","]]}, {"file": "apps/web-storefront/components/FitCheck.tsx", "what": "the fit message uses the buyer's version when the part is narrowed to some versions", "done": "fitVerdict", "pairs": [["import { vehicleLabel } from \"@/lib/garage\";", "import { vehicleLabel } from \"@/lib/garage\";\nimport { fitVerdict } from \"@/lib/fitVerdict\";"], ["Partial<Pick<ProductDetail, \"fitCars\" | \"fitCarCount\" | \"fitKeys\" | \"fitsVehicleIds\">>", "Partial<Pick<ProductDetail, \"fitCars\" | \"fitCarCount\" | \"fitKeys\" | \"fitsVehicleIds\" | \"fitVersions\" | \"fitVersionNames\">>"], ["fitKeys: p.fitKeys, fitsVehicleIds: p.fitsVehicleIds }", "fitKeys: p.fitKeys, fitsVehicleIds: p.fitsVehicleIds, fitVersions: p.fitVersions, fitVersionNames: p.fitVersionNames }"], ["export default function FitCheck({ productId, fitCars, fitCarCount, fitKeys, fitsVehicleIds }: Props) {", "export default function FitCheck({ productId, fitCars, fitCarCount, fitKeys, fitsVehicleIds, fitVersions, fitVersionNames }: Props) {"], ["const fit: Fit | null = given ? { fitCars, fitCarCount, fitKeys, fitsVehicleIds } : loaded;", "const fit: Fit | null = given ? { fitCars, fitCarCount, fitKeys, fitsVehicleIds, fitVersions, fitVersionNames } : loaded;"], ["  const matches = (fit.fitKeys ?? []).includes(`${defaultVehicle.generationId}|${defaultVehicle.year}`) || (fit.fitsVehicleIds ?? []).includes(defaultVehicle.generationId);\n  if (matches) {\n    return (\n      <p role=\"status\" className=\"mt-3 inline-flex items-center gap-2 rounded-full bg-[#e2f4ec] px-3.5 py-1.5 text-sm font-bold text-[#0f6b49]\">\n        <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.4\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg>\n        {t(\"confirmed_fit_for\", { car: vehicleLabel(lang, defaultVehicle) })}\n      </p>\n    );\n  }", "  const verdict = fitVerdict(defaultVehicle, fit, lang);\n  if (verdict.kind === \"fits\" || verdict.kind === \"fits_versions\") {\n    return (\n      <>\n        <p role=\"status\" className=\"mt-3 inline-flex items-center gap-2 rounded-full bg-[#e2f4ec] px-3.5 py-1.5 text-sm font-bold text-[#0f6b49]\">\n          <svg aria-hidden=\"true\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.4\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M20 6 9 17l-5-5\" /></svg>\n          {t(\"confirmed_fit_for\", { car: vehicleLabel(lang, defaultVehicle) })}\n        </p>\n        {verdict.kind === \"fits_versions\" && <p data-testid=\"fit-versions\" className=\"mt-1 text-[13px] text-muted\">{t(\"fit_part_is_for\", { versions: verdict.versions.join(\", \") })}</p>}\n      </>\n    );\n  }\n  if (verdict.kind === \"wrong_version\") {\n    return (\n      <div role=\"status\" data-testid=\"fit-wrong-version\" className=\"mt-3 rounded-xl border border-[#f0d9a0] bg-[#fff8e5] px-4 py-3 text-sm leading-relaxed text-[#7a4e00]\">\n        <p><strong>{t(\"fit_wrong_version\")}</strong></p>\n        <p>{t(\"fit_wrong_version_detail\", { versions: verdict.versions.join(\", \"), car: vehicleLabel(lang, defaultVehicle) })}</p>\n      </div>\n    );\n  }\n  if (verdict.kind === \"need_version\") {\n    return (\n      <div role=\"status\" data-testid=\"fit-need-version\" className=\"mt-3 rounded-xl border border-line bg-[#eef1f3] px-4 py-3 text-sm leading-relaxed text-ink\">\n        <p>{t(\"fit_need_version\", { car: vehicleLabel(lang, defaultVehicle), versions: verdict.versions.join(\", \") })} <a href={lang === \"ar\" ? \"/ar/garage\" : \"/garage\"} className=\"font-bold underline\">{t(\"fit_choose_version\")}</a></p>\n      </div>\n    );\n  }"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-web-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-web-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-fit-versions-web`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
