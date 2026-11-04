#!/usr/bin/env node
/**
 * Website, My garage (design A): "· Your cars 2 of 5" beside the title is removed; instead the title box shows a gold ring that fills as cars are saved,
 * "2/5" inside it and "2 of 5 · cars saved" beside it ("Garage full" at 5 of 5, the ring turning navy). English and Arabic (the ring runs the other way).
 * On a phone it sits under the title.
 *
 *   node scripts/patch-garage-ring.js            dry run
 *   node scripts/patch-garage-ring.js --write    applies it (each changed file is saved as <file>.before-garage-ring first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "My garage: the ring showing how many cars are saved, in the title box", "done": "import GarageMeter from \"./GarageMeter\";", "pairs": [["import { useT } from \"./LangProvider\";\n", "import { useT } from \"./LangProvider\";\nimport GarageMeter from \"./GarageMeter\";\n"], ["            <header data-testid=\"account-page-header\" className=\"relative overflow-hidden rounded-[16px] border border-line bg-white px-6 py-5 sm:px-7\">\n              <span aria-hidden=\"true\" className=\"absolute inset-y-4 start-0 w-1 rounded-full bg-signal\" />\n              <h1 className=\"text-3xl font-bold tracking-tight text-navy\">{t(item[1])}</h1>\n              <p className=\"mt-1.5 text-[15px] text-muted\">{t(item[2])}</p>\n            </header>", "            <header data-testid=\"account-page-header\" className=\"relative flex flex-wrap items-center gap-x-6 gap-y-3 overflow-hidden rounded-[16px] border border-line bg-white px-6 py-5 sm:px-7\">\n              <span aria-hidden=\"true\" className=\"absolute inset-y-4 start-0 w-1 rounded-full bg-signal\" />\n              <div className=\"min-w-0 flex-1\">\n                <h1 className=\"text-3xl font-bold tracking-tight text-navy\">{t(item[1])}</h1>\n                <p className=\"mt-1.5 text-[15px] text-muted\">{t(item[2])}</p>\n              </div>\n              {/* My garage: how many of its places are used, at the end of the title box */}\n              {item[0] === \"/garage\" && <GarageMeter />}\n            </header>"]]}, {"file": "apps/web-storefront/app/garage/page.tsx", "what": "My garage: \"\u00b7 Your cars 2 of 5\" beside the title removed", "done": "", "pairs": [["{garage.vehicles.length > 0 && <span className=\"text-xl font-normal text-muted\">\u00b7 {t(\"garage_your_cars\")} {t(\"garage_count_of\", { n: garage.vehicles.length, max: MAX_GARAGE_VEHICLES })}</span>}", ""]], "gone": "{garage.vehicles.length > 0 && <span className=\"text-xl font-normal text-muted\">\u00b7 {t(\"garage_your_cars\")} {t(\"garage_count_of\", { n: garage.vehicles.length, max: MAX_GARAGE_VEHICLES })}</span>}"}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "the ring's words (English and Arabic)", "done": "garage_meter_saved:", "pairs": [["  garage_count_of: \"{n} of {max}\",\n", "  garage_count_of: \"{n} of {max}\",\n  garage_meter_saved: \"cars saved\",\n  garage_meter_full: \"Garage full\",\n"], ["  garage_count_of: \"{n} \u0645\u0646 {max}\",\n", "  garage_count_of: \"{n} \u0645\u0646 {max}\",\n  garage_meter_saved: \"\u0633\u064a\u0627\u0631\u0627\u062a \u0645\u062d\u0641\u0648\u0638\u0629\",\n  garage_meter_full: \"\u0627\u0644\u0645\u0631\u0622\u0628 \u0645\u0645\u062a\u0644\u0626\",\n"]]}], "created": [{"file": "apps/web-storefront/components/GarageMeter.tsx", "what": "the ring (design A)", "text": "\"use client\";\n\nimport { useGarage } from \"./GarageProvider\";\nimport { useT } from \"./LangProvider\";\nimport { MAX_GARAGE_VEHICLES } from \"@/lib/garage\";\n\nconst R = 26;\nconst C = 2 * Math.PI * R;\n\n// How full My garage is, in the page's title box (design A): a gold ring that fills as cars are saved, \"2/5\" inside it, \"2 of 5 \u00b7 cars saved\" beside it,\n// and \"Garage full\" at the limit. The ring runs clockwise, and the other way round in Arabic. Nothing shows until the cars are loaded.\nexport default function GarageMeter() {\n  const { vehicles, loading, signedIn } = useGarage();\n  const t = useT();\n  if (!signedIn || loading) return null;\n  const n = Math.min(vehicles.length, MAX_GARAGE_VEHICLES);\n  const full = n >= MAX_GARAGE_VEHICLES;\n  const label = t(\"garage_count_of\", { n, max: MAX_GARAGE_VEHICLES });\n  return (\n    <div data-testid=\"garage-meter\" className=\"flex flex-none items-center gap-3\" role=\"img\" aria-label={`${label} \u00b7 ${full ? t(\"garage_meter_full\") : t(\"garage_meter_saved\")}`}>\n      <span className=\"relative block size-16\">\n        <svg width=\"64\" height=\"64\" viewBox=\"0 0 64 64\" aria-hidden=\"true\" className=\"rtl:-scale-x-100\">\n          <circle cx=\"32\" cy=\"32\" r={R} fill=\"none\" stroke=\"#e8ecf0\" strokeWidth=\"8\" />\n          {n > 0 && <circle data-testid=\"garage-meter-fill\" cx=\"32\" cy=\"32\" r={R} fill=\"none\" stroke={full ? \"#0b2a3c\" : \"#f3c03b\"} strokeWidth=\"8\" strokeLinecap=\"round\" strokeDasharray={`${(C * n) / MAX_GARAGE_VEHICLES} ${C}`} transform=\"rotate(-90 32 32)\" />}\n        </svg>\n        <span aria-hidden=\"true\" className=\"absolute inset-0 flex items-center justify-center text-base font-extrabold text-navy\" dir=\"ltr\">{n}/{MAX_GARAGE_VEHICLES}</span>\n      </span>\n      <span aria-hidden=\"true\">\n        <span className=\"block font-extrabold text-navy\">{label}</span>\n        <span className=\"block text-xs font-semibold text-muted\">{full ? t(\"garage_meter_full\") : t(\"garage_meter_saved\")}</span>\n      </span>\n    </div>\n  );\n}\n"}]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (e.gone ? !s.includes(c(e.gone)) : s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-garage-ring`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
