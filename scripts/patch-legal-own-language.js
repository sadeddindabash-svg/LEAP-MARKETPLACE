#!/usr/bin/env node
/**
 * Storefront pages (About us, Terms, Delivery & Shipping, Refund, Privacy, Cancellation): each language shows ONLY its own text.
 * Before: when the English title or text was empty, the English page borrowed the Arabic one (so "About us" showed "من نحن"), and the other way.
 * Now: no English title -> the website's own English name ("About us"); no English text -> "This page is being prepared". The same in Arabic.
 *
 *   node scripts/patch-legal-own-language.js            dry run
 *   node scripts/patch-legal-own-language.js --write    applies it (each changed file is saved as <file>.before-legal-own-language first)
 * Then: restart the storefront (Ctrl+C, npm run dev) and Ctrl+F5. (No server change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[],"anchored":[{"file":"apps/web-storefront/components/LegalPage.tsx","what":"storefront pages: each language shows only its own title and text","done":"only the visitor's own language","pairs":[["import { PAGE_SLUGS, pageText, type PageKey } from \"@/lib/footerContent\";\n","import { PAGE_SLUGS, type PageKey, type Pair } from \"@/lib/footerContent\";\n"],["const when = (iso: string, lang: Lang) =>","// only the visitor's own language: an English page never shows the Arabic title or text, and the other way (empty -> the website's own name / \"being prepared\")\nconst own = (p: Pair | null | undefined, lang: Lang): string => { const v = lang === \"ar\" ? p?.ar : p?.en; return typeof v === \"string\" ? v.trim() : \"\"; };\nconst when = (iso: string, lang: Lang) =>"],["  const title = (page && pageText(page.title, lang)) || t(lang, NAME[key]);\n  const description = page?.hasContent ? plainText(pageText(page.body, lang)).slice(0, 155) : undefined;\n","  const title = own(page?.title, lang) || t(lang, NAME[key]);\n  const body = own(page?.body, lang);\n  const description = body ? plainText(body).slice(0, 155) : undefined;\n"],["robots: page?.hasContent ? undefined : { index: false, follow: true } };","robots: body ? undefined : { index: false, follow: true } };"],["  const title = (page && pageText(page.title, lang)) || t(lang, NAME[pageKey]);\n","  const title = own(page?.title, lang) || t(lang, NAME[pageKey]);\n  const body = own(page?.body, lang);\n"],["      {page?.hasContent ? (\n","      {body ? (\n"],["          {page.updatedAt && <p","          {page?.updatedAt && <p"],["          <RichText source={pageText(page.body, lang)} />\n","          <RichText source={body} />\n"]]},{"file":"apps/web-storefront/components/LegalPage.test.tsx","what":"storefront page tests: each language only its own","done":"English never borrows the Arabic title","pairs":[["  it(\"a page written in only one language shows that text in the other language too (better than nothing)\", async () => {\n    m.page.current = page({ body: { en: \"Only English text.\", ar: null }, title: { en: \"Terms\", ar: null } }); await show(\"terms\", \"ar\"); expect(screen.getByText(\"Only English text.\")).toBeInTheDocument(); expect(screen.getByRole(\"heading\", { level: 1 }).textContent).toBe(\"Terms\");\n","  it(\"a page written in only one language never shows it in the other: the other has its own name and \\\"being prepared\\\"\", async () => {\n    m.page.current = page({ body: { en: \"Only English text.\", ar: null }, title: { en: \"Terms\", ar: null } }); await show(\"terms\", \"ar\"); expect(screen.queryByText(\"Only English text.\")).not.toBeInTheDocument(); expect(screen.getByRole(\"heading\", { level: 1 }).textContent).not.toBe(\"Terms\"); expect(screen.getByText(/قيد الإعداد/)).toBeInTheDocument();\n  });\n  it(\"English never borrows the Arabic title (About us, not من نحن)\", async () => {\n    m.page.current = page({ title: { en: null, ar: \"من نحن\" } }); await show(\"about\"); expect(screen.getByRole(\"heading\", { level: 1 }).textContent).toBe(\"About us\");\n"]],"optional":true}]};
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a]) => !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) { if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-hub-portal-redesign`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: restart the storefront (Ctrl+C, npm run dev) and Ctrl+F5.');
