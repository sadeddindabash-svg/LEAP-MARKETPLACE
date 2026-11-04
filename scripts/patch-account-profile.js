#!/usr/bin/env node
/**
 * Website, My account: the profile box redesigned (design B, white and roomy): your photo (or first letter) with a gold camera badge (click the photo
 * or "Change photo" to change it), "Welcome back", your name and email, and a bell button with the unread count in a red badge. English and Arabic.
 *
 *   node scripts/patch-account-profile.js            dry run
 *   node scripts/patch-account-profile.js --write    applies it (each changed file is saved as <file>.before-account-profile first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/app/account/page.tsx", "what": "My account: the profile box redesigned (design B)", "done": "aria-level={1}", "pairs": [["import { useEffect, useState } from \"react\";", "import { useEffect, useRef, useState } from \"react\";"], ["  const [counts, setCounts] = useState<", "  const photoInput = useRef<HTMLInputElement>(null);\n  const [counts, setCounts] = useState<"], ["      <section className=\"flex flex-wrap items-center gap-5 rounded-[14px] border border-line bg-white p-5\" aria-labelledby=\"acc-h\">\n        <span className=\"relative grid size-20 flex-none place-items-center overflow-hidden rounded-full bg-navy text-3xl font-bold text-white\">\n          {user.avatarUrl ? <SafeImage src={resolveImageUrl(user.avatarUrl)} alt=\"\" fill sizes=\"80px\" className=\"object-cover\" unoptimized /> : <span aria-hidden=\"true\">{(user.name || user.email).charAt(0).toUpperCase()}</span>}\n        </span>\n        <div className=\"min-w-0 flex-1\">\n          <h1 id=\"acc-h\" className=\"truncate text-2xl font-bold text-navy\">{user.name || user.email}</h1>\n          {user.name && <p className=\"truncate text-muted\" dir=\"ltr\">{user.email}</p>}\n          <label className={`${outline} mt-2 cursor-pointer`}>\n            {photoBusy ? t(\"saving\") : t(\"change_photo\")}\n            <input type=\"file\" accept=\"image/*\" className=\"sr-only\" aria-label={t(\"change_photo\")} disabled={photoBusy} onChange={(e) => { changePhoto(e.target.files?.[0]); e.target.value = \"\"; }} />\n          </label>\n        </div>\n        <Link href=\"/notifications\" className={outline}>{t(\"notifications\")}{counts && counts.unread > 0 ? ` (${counts.unread})` : \"\"}</Link>\n      </section>\n", "      {/* the profile (design B): the photo with its camera badge (click either to change it), \"Welcome back\", the name and email, and a bell with the\n          unread count. The name is not an <h1> tag: the menu's title box hides the pages' own h1 titles, and this one must stay. */}\n      <section className=\"flex flex-wrap items-center gap-5 rounded-[14px] border border-line bg-white p-5 sm:p-6\" aria-labelledby=\"acc-h\">\n        <label className={`relative block size-[84px] flex-none ${photoBusy ? \"cursor-wait opacity-70\" : \"cursor-pointer\"}`}>\n          <span className=\"relative grid size-[84px] place-items-center overflow-hidden rounded-full bg-navy text-[34px] font-extrabold text-white\">\n            {user.avatarUrl ? <SafeImage src={resolveImageUrl(user.avatarUrl)} alt=\"\" fill sizes=\"84px\" className=\"object-cover\" unoptimized /> : <span aria-hidden=\"true\">{(user.name || user.email).charAt(0).toUpperCase()}</span>}\n          </span>\n          <span aria-hidden=\"true\" className=\"absolute -bottom-0.5 -end-0.5 grid size-8 place-items-center rounded-full border-[3px] border-white bg-signal text-navy\">\n            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2.2\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><path d=\"M4 8h3l2-3h6l2 3h3v11H4z\" /><circle cx=\"12\" cy=\"13\" r=\"3.5\" /></svg>\n          </span>\n          <input ref={photoInput} type=\"file\" accept=\"image/*\" className=\"sr-only\" aria-label={t(\"change_photo\")} disabled={photoBusy} onChange={(e) => { changePhoto(e.target.files?.[0]); e.target.value = \"\"; }} />\n        </label>\n        <div className=\"min-w-0 flex-1\">\n          <p className=\"text-sm text-muted\">{t(\"welcome_back\")}</p>\n          <p id=\"acc-h\" role=\"heading\" aria-level={1} className=\"text-[17px] font-extrabold leading-tight text-navy [overflow-wrap:anywhere] sm:truncate sm:text-2xl\"><bdi>{user.name || user.email}</bdi></p>\n          {user.name && <p className=\"truncate text-muted\" dir=\"ltr\">{user.email}</p>}\n          <button type=\"button\" disabled={photoBusy} onClick={() => photoInput.current?.click()} className=\"mt-1 text-sm font-bold text-navy underline underline-offset-4 disabled:opacity-50\">{photoBusy ? t(\"saving\") : t(\"change_photo\")}</button>\n        </div>\n        <Link href=\"/notifications\" aria-label={`${t(\"notifications\")}${counts && counts.unread > 0 ? ` (${counts.unread})` : \"\"}`} className=\"relative grid size-12 flex-none place-items-center rounded-xl border-[1.5px] border-line text-navy transition-colors hover:border-navy\">\n          <svg width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\" strokeLinejoin=\"round\" aria-hidden=\"true\"><path d=\"M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z\" /><path d=\"M10 20a2 2 0 0 0 4 0\" /></svg>\n          {counts && counts.unread > 0 && <span aria-hidden=\"true\" className=\"absolute -top-2 -end-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d93025] px-1.5 text-[11px] font-extrabold text-white\">{counts.unread > 99 ? \"99+\" : counts.unread}</span>}\n        </Link>\n      </section>\n"]]}, {"file": "apps/web-storefront/lib/i18n.ts", "what": "\"Welcome back\" (English and Arabic)", "done": "welcome_back:", "pairs": [["  change_photo: \"Change photo\",\n", "  change_photo: \"Change photo\",\n  welcome_back: \"Welcome back\",\n"], ["  change_photo: \"\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0635\u0648\u0631\u0629\",\n", "  change_photo: \"\u062a\u063a\u064a\u064a\u0631 \u0627\u0644\u0635\u0648\u0631\u0629\",\n  welcome_back: \"\u0645\u0631\u062d\u0628\u064b\u0627 \u0628\u0639\u0648\u062f\u062a\u0643\",\n"]]}], "created": []};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-account-profile`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
