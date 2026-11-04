#!/usr/bin/env node
/**
 * Storefront footer: the six "Useful links" (About us, Terms, Delivery & Shipping, Refund, Privacy, Cancellation) ALWAYS open the page inside
 * this website (/about-us, /ar/about-us, ...), never the old leapautoparts.com website.
 * Before: a link went to the old website until its page had text saved in the admin portal (and also whenever the storefront could not
 * read the settings). Now a page with no text yet says "This page is being prepared" on this website instead.
 *
 *   node scripts/patch-footer-links-inside.js            dry run
 *   node scripts/patch-footer-links-inside.js --write    applies it (each changed file is saved as <file>.before-footer-links-inside first)
 * Then: restart the storefront (Ctrl+C, npm run dev) and Ctrl+F5. (No server change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[],"anchored":[{"file":"apps/web-storefront/components/SiteFooter.tsx","what":"storefront footer: the six useful links always open inside this website","done":"ALWAYS open inside this website","pairs":[["// The six pages (About us, Terms, ...) are written in the admin portal and live INSIDE the storefront. Until a page has text, its link keeps going to the same page on the existing Leap website, in the visitor's language,\n// so no link is ever empty while the pages are being filled in.\n// Set NEXT_PUBLIC_LEGAL_BASE_URL if they move. (Odoo serves Arabic under /ar, and the privacy page's real address is spelled \"privecy-policy\".)\nconst LEGAL_BASE = (process.env.NEXT_PUBLIC_LEGAL_BASE_URL || \"https://www.leapautoparts.com\").replace(/\\/+$/, \"\");\n","// The six pages (About us, Terms, ...) are written in the admin portal and ALWAYS open inside this website (never the old one). A page with no text yet says \"This page is being prepared\".\n"],["  const legalPrefix = lang === \"ar\" ? `${LEGAL_BASE}/ar` : LEGAL_BASE;\n",""],["          {LEGAL.map(([label, oldSlug], i) => {\n","          {LEGAL.map(([label], i) => {\n"],["            return footer?.pages[key]\n              ? <Link key={key} href={`/${PAGE_SLUGS[key]}`} className={link}>{text}</Link>\n              : <a key={key} href={`${legalPrefix}/${oldSlug}`} className={link}>{text}</a>;\n","            return <Link key={key} href={`/${PAGE_SLUGS[key]}`} className={link}>{text}</Link>;      // inside this website, in the visitor's language\n"]]},{"file":"apps/web-storefront/components/SiteFooter.test.tsx","what":"storefront footer tests: the links are inside this website","done":"every page opens INSIDE the storefront","pairs":[["  it(\"shows its own tagline, the year in the copyright, and the six links to the existing website (the privacy page at its real, old address)\", async () => {\n","  it(\"shows its own tagline, the year in the copyright, and the six links to the pages inside this website\", async () => {\n"],["    const hrefs = useful().getAllByRole(\"link\").map((a) => a.getAttribute(\"href\")); expect(hrefs).toEqual([\"about-us\", \"terms-conditions\", \"delivery-shipping-policy\", \"refund-policy\", \"privecy-policy\", \"cancellation-replacement-policy\"].map((s) => `https://www.leapautoparts.com/${s}`));\n","    const hrefs = useful().getAllByRole(\"link\").map((a) => a.getAttribute(\"href\")); expect(hrefs).toEqual([\"/about-us\", \"/terms-conditions\", \"/delivery-shipping-policy\", \"/refund-policy\", \"/privacy-policy\", \"/cancellation-replacement-policy\"]);\n"],["  it(\"Arabic: the Arabic website's addresses\", async () => { await show(\"ar\"); expect(useful().getAllByRole(\"link\")[0].getAttribute(\"href\")).toBe(\"https://www.leapautoparts.com/ar/about-us\"); });\n","  it(\"Arabic: the pages keep the /ar language prefix\", async () => { await show(\"ar\"); expect(useful().getAllByRole(\"link\")[0].getAttribute(\"href\")).toBe(\"/ar/about-us\"); });\n"],["  it(\"a page that has text opens INSIDE the storefront (same tab); a page without text still goes to the old website\", async () => {\n","  it(\"every page opens INSIDE the storefront (same tab), with text or not yet\", async () => {\n"],["expect(a[1].getAttribute(\"href\")).toBe(\"https://www.leapautoparts.com/terms-conditions\");","expect(a[1].getAttribute(\"href\")).toBe(\"/terms-conditions\");"]],"optional":true}]};
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
