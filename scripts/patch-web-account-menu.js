#!/usr/bin/env node
/**
 * Website (confirmed with the person via mockup): "Account" opens the account menu, the SAME list as beside the account pages (every page with its icon, the
 * page you are on navy with a gold icon, the unread notifications in gold), then Sign out:
 *  - PC and tablet: it drops down under "Account" in the header (replacing the shorter list);
 *  - phone: "Account" in the bottom bar opens it from the side (as "Menu" on the account pages); ✕, a tap outside, Escape or a page closes it.
 * Signed out, "Account" still goes to Sign in.
 *
 *   node scripts/patch-web-account-menu.js            dry run
 *   node scripts/patch-web-account-menu.js --write    applies it (each changed file is saved as <file>.before-patch-web-account-menu first)
 * Then: website: Ctrl+F5
 */
const DATA = {"created": [{"file": "apps/web-storefront/components/AccountMenuList.tsx", "what": "website: the account menu list shared by the header and the bottom bar", "text": "\"use client\";\n\nimport { usePathname } from \"next/navigation\";\nimport Link from \"@/components/LocLink\";\nimport { useAuth } from \"./AuthProvider\";\nimport { useT } from \"./LangProvider\";\nimport { splitLang } from \"@/lib/i18n\";\nimport { ACCOUNT_MENU_ITEMS, AccountMenuIcon, menuPageOf, useAccountUnread } from \"./AccountShell\";\n\n/**\n * The account menu's list, the same as beside the account pages (confirmed with the person via mockup): every page with its icon and name, the page the buyer is on\n * navy with a gold icon and edge, the number of unread notifications in gold, then Sign out. Used by \"Account\" in the header (PC and tablet) and in the phone's\n * bottom bar. `onPick` closes the panel it is in.\n */\nexport default function AccountMenuList({ onPick, live = true }: { onPick?: () => void; live?: boolean }) {\n  const { logout } = useAuth();\n  const t = useT();\n  const here = splitLang(usePathname() || \"/\").path;\n  const marked = menuPageOf(here);\n  const unread = useAccountUnread(live, here);\n  return (\n    <>\n      <ul className=\"grid gap-0.5\" data-testid=\"account-menu-list\">\n        {ACCOUNT_MENU_ITEMS.map(([href, key]) => (\n          <li key={href}>\n            <Link href={href} onClick={onPick} aria-current={here === href ? \"page\" : marked === href ? \"true\" : undefined}\n              className={`relative flex min-h-10 items-center gap-2.5 rounded-[10px] px-3 text-[14.5px] font-semibold ${marked === href ? \"bg-gradient-to-br from-navy to-[#173f57] text-white\" : \"text-ink hover:bg-chalk\"}`}>\n              {marked === href && <span aria-hidden=\"true\" className=\"absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-signal\" />}\n              <span className={`flex-none ${marked === href ? \"text-signal\" : \"text-[#8a97a3]\"}`}><AccountMenuIcon href={href} size={18} /></span>\n              <span className=\"min-w-0 flex-1\">{t(key)}</span>\n              {href === \"/notifications\" && unread > 0 && <span aria-hidden=\"true\" className=\"flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-signal px-1.5 text-xs font-extrabold text-navy\">{unread > 99 ? \"99+\" : unread}</span>}\n            </Link>\n          </li>\n        ))}\n      </ul>\n      <button type=\"button\" onClick={() => { onPick?.(); logout(); }} className=\"mt-1 block w-full border-t border-line px-3 py-2.5 text-start text-[14.5px] font-semibold text-[#a12a21] hover:bg-chalk\">{t(\"sign_out\")}</button>\n    </>\n  );\n}\n"}], "replaced": [{"file": "apps/web-storefront/components/AccountMenu.tsx", "what": "website header (PC, tablet): \"Account\" drops down the account menu, the same list as beside the account pages", "done": "<AccountMenuList />", "from": ["\"use client\";\n\nimport Link from \"@/components/LocLink\";\nimport { useAuth } from \"@/components/AuthProvider\";\nimport NavDropdown from \"@/components/NavDropdown\";\nimport { useT } from \"@/components/LangProvider\";\n\nconst userIcon = (\n  <svg aria-hidden=\"true\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\" /><path d=\"M4 21c1-4 4-6 8-6s7 2 8 6\" /></svg>\n);\nconst trigger = \"flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10\";\n\n/** Sign in when signed out; when signed in, one \"Account\" menu with everything that used to be a row of loose links. */\nexport default function AccountMenu() {\n  const { user, isLoading, logout } = useAuth();\n  const t = useT();\n  if (isLoading) return <span className=\"min-h-11 min-w-16\" aria-hidden=\"true\" />;\n  if (!user) {\n    return <Link href=\"/login\" className={trigger}>{userIcon}<span>{t(\"sign_in\")}</span></Link>;\n  }\n  const items: Array<[string, Parameters<typeof t>[0]]> = [[\"/account\", \"account_hub_title\"], [\"/orders\", \"my_orders\"], [\"/part-requests\", \"my_requests_title\"], [\"/returns\", \"returns\"], [\"/wishlist\", \"wishlist\"], [\"/saved-searches\", \"saved_searches\"], [\"/garage\", \"garage_title\"], [\"/addresses\", \"addresses\"], [\"/referrals\", \"referrals\"], [\"/support\", \"support\"]];\n  return (\n    <NavDropdown label={t(\"account_menu\")} trigger={<>{userIcon}<span>{t(\"account\")}</span></>} triggerClassName={trigger} panelClassName=\"absolute end-0 top-full z-30 mt-1 w-56 rounded-xl border border-line bg-white p-2 text-sm text-ink shadow-lg\">\n      {items.map(([href, key]) => (\n        <Link key={href} href={href} className=\"block rounded-lg px-3 py-2.5 font-medium hover:bg-chalk\">{t(key)}</Link>\n      ))}\n      <button type=\"button\" onClick={logout} className=\"mt-1 block w-full rounded-lg border-t border-line px-3 py-2.5 text-start font-medium hover:bg-chalk\">{t(\"sign_out\")}</button>\n    </NavDropdown>\n  );\n}\n"], "text": "\"use client\";\n\nimport Link from \"@/components/LocLink\";\nimport { useAuth } from \"@/components/AuthProvider\";\nimport NavDropdown from \"@/components/NavDropdown\";\nimport { useT } from \"@/components/LangProvider\";\nimport AccountMenuList from \"./AccountMenuList\";\n\nconst userIcon = (\n  <svg aria-hidden=\"true\" width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" strokeLinecap=\"round\" strokeLinejoin=\"round\"><circle cx=\"12\" cy=\"8\" r=\"4\" /><path d=\"M4 21c1-4 4-6 8-6s7 2 8 6\" /></svg>\n);\nconst trigger = \"flex min-h-11 min-w-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-xs font-semibold text-white hover:bg-white/10 group-data-[open=true]:bg-white/10\";\n\n/** Sign in when signed out; when signed in, \"Account\" drops down the account menu: the same list as beside the account pages (AccountMenuList), then Sign out. */\nexport default function AccountMenu() {\n  const { user, isLoading } = useAuth();\n  const t = useT();\n  if (isLoading) return <span className=\"min-h-11 min-w-16\" aria-hidden=\"true\" />;\n  if (!user) {\n    return <Link href=\"/login\" className={trigger}>{userIcon}<span>{t(\"sign_in\")}</span></Link>;\n  }\n  return (\n    <NavDropdown label={t(\"account_menu\")} trigger={<>{userIcon}<span>{t(\"account\")}</span></>} triggerClassName={trigger}\n      panelClassName=\"absolute end-0 top-full z-30 mt-1.5 max-h-[calc(100vh-6rem)] w-[290px] overflow-y-auto rounded-[14px] border border-line bg-white p-2 text-ink shadow-[0_18px_40px_rgba(7,32,47,0.25)]\">\n      <AccountMenuList />\n    </NavDropdown>\n  );\n}\n"}], "anchored": [{"file": "apps/web-storefront/components/AccountShell.tsx", "what": "website account menu: its list shared with the header and the bottom bar", "done": "export { ITEMS as ACCOUNT_MENU_ITEMS", "pairs": [["const TIER = \"/account/loyalty\";", "const TIER = \"/account/loyalty\";\n// the same list, its icons and the unread number, for \"Account\" in the header and in the phone's bottom bar (AccountMenuList)\nexport { ITEMS as ACCOUNT_MENU_ITEMS, Icon as AccountMenuIcon, useUnread as useAccountUnread };", false]]}, {"file": "apps/web-storefront/components/MobileTabBar.tsx", "what": "website phone bottom bar: \"Account\" opens the account menu from the side", "done": "aria-controls=\"mobile-account-menu\"", "pairs": [["import PhotoBox from \"@/components/PhotoBox\";", "import PhotoBox from \"@/components/PhotoBox\";\nimport AccountMenuList from \"@/components/AccountMenuList\";", false], ["  const [open, setOpen] = useState(false);\n", "  const [open, setOpen] = useState(false);\n  const [acct, setAcct] = useState(false);          // the account menu, from \"Account\" (signed in): the same list as beside the account pages\n", false], ["  useEffect(() => { setOpen(false); }, [here]);", "  useEffect(() => { setOpen(false); setAcct(false); }, [here]);", false], ["  const color = (on: boolean) => (on ? \"text-signal\" : \"text-[#9fb3c2]\");", "  useEffect(() => {\n    if (!acct) return;\n    const onKey = (e: KeyboardEvent) => { if (e.key === \"Escape\") setAcct(false); };\n    const before = document.body.style.overflow;\n    document.body.style.overflow = \"hidden\";      // the page behind does not scroll while the menu is open\n    window.addEventListener(\"keydown\", onKey);\n    return () => { window.removeEventListener(\"keydown\", onKey); document.body.style.overflow = before; };\n  }, [acct]);\n\n  const color = (on: boolean) => (on ? \"text-signal\" : \"text-[#9fb3c2]\");", false], ["  const active = open ? 1 : is(\"/\")", "  const active = acct ? 4 : open ? 1 : is(\"/\")", false], ["      <nav aria-label={t(\"nav_sections\") + \" · \" + t(\"account\")}", "      {/* \"Account\" (signed in): the account menu opens from the side, above the bottom bar; closes on ✕, a tap outside, Escape or a page */}\n      {acct && user && (\n        <>\n          <button type=\"button\" aria-label={t(\"cancel\")} data-testid=\"tab-account-backdrop\" onClick={() => setAcct(false)} className=\"fixed inset-x-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-[45] bg-[#07202f]/45\" />\n          <nav id=\"mobile-account-menu\" aria-label={t(\"account_sidebar\")} className=\"fixed start-0 top-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-50 w-[min(85vw,320px)] overflow-y-auto bg-white px-3 pb-4 pt-4 shadow-[0_0_30px_rgba(7,32,47,0.3)]\">\n            <div className=\"mb-2 flex items-center justify-between px-2\">\n              <span className=\"text-lg font-extrabold text-ink\">{t(\"account_hub_title\")}</span>\n              <button type=\"button\" aria-label={t(\"cancel\")} onClick={() => setAcct(false)} className=\"grid size-10 place-items-center rounded-full text-[#6b7a86] hover:bg-chalk\"><svg aria-hidden=\"true\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"2\" strokeLinecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\" /></svg></button>\n            </div>\n            <AccountMenuList onPick={() => setAcct(false)} />\n          </nav>\n        </>\n      )}\n      <nav aria-label={t(\"nav_sections\") + \" · \" + t(\"account\")}", false], ["onClick={() => setOpen(!open)} className={`${tab} ${color(active === 1)}`}>", "onClick={() => { setAcct(false); setOpen(!open); }} className={`${tab} ${color(active === 1)}`}>", false], ["        <Link href={accountHref} aria-current={is(\"/account\") ? \"page\" : undefined} className={`${tab} ${color(active === 4)}`}>{lift(active === 4, ICONS.account)}<span>{t(\"account\")}</span></Link>", "        {user ? (\n          <button type=\"button\" aria-expanded={acct} aria-controls=\"mobile-account-menu\" data-testid=\"tab-account\" onClick={() => { setOpen(false); setAcct(!acct); }} className={`${tab} ${color(active === 4)}`}>{lift(active === 4, ICONS.account)}<span>{t(\"account\")}</span></button>\n        ) : (\n          <Link href={accountHref} className={`${tab} ${color(active === 4)}`}>{lift(active === 4, ICONS.account)}<span>{t(\"account\")}</span></Link>\n        )}", false], ["background, with Escape, or when the page changes. The cart shows its number. Account opens the account (or Sign in when signed out).", "background, with Escape, or when the page changes. The cart shows its number. Account opens the account menu from the side, the same list as beside the account\n * pages (or goes to Sign in when signed out).", false]]}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
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
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version expected (send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-web-account-menu`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: website: Ctrl+F5');
