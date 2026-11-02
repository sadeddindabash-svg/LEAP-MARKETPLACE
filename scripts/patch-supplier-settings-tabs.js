#!/usr/bin/env node
/**
 * Supplier portal > Settings: each part is a tab under the header: Company information, Return address, Notification settings.
 * Needs patch-supplier-product-tabs first.
 *
 *   node scripts/patch-supplier-settings-tabs.js            dry run
 *   node scripts/patch-supplier-settings-tabs.js --write    applies it (each changed file is saved as <file>.before-supplier-settings-tabs first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/supplier-portal/src/App.jsx","what":"Settings: each part is a tab","done":"const settingsTabs = [","pairs":[["function ReturnAddressCard() {","function ReturnAddressCard({ showTitle = true }) { // showTitle=false: inside its own Settings tab, which already names it"],["<Card title={r.title} style={{ flex: 1 }}>","<Card title={showTitle ? r.title : undefined} style={{ flex: 1 }}>"],["function SettingsPage() {\n  const { t, lang } = useLang();\n  const { profile } = useSupplier();\n  const s = t.settings;\n  const [toggles, setToggles] = useState([true, true, true, false]);\n  const font = useBodyFont();\n  return (\n    <div>\n      <TopBar title={s.title} subtitle={s.subtitle} />\n      <div style={{ padding: 24, display: \"flex\", gap: 16 }}>\n        <Card title={s.companyTitle} style={{ flex: 1 }}>\n          <div style={{ padding: 16, display: \"flex\", flexDirection: \"column\", gap: 14 }}>\n            {/* Real profile data only. A business license number and a \"main categories\" list used to\n                be typed in here (a placeholder number, and a fixed category list); neither exists in\n                the database, so they are gone rather than shown as if they were real. */}\n            <InfoRow icon={Building2} label={s.companyName} value={profile ? profile.name : \"\"} />\n            <InfoRow\n              icon={BadgeCheck}\n              label={s.verification}\n              value={profile ? <Badge label={s.verificationStates[profile.verificationStatus] || profile.verificationStatus} statusKey={VERIFICATION_BADGE[profile.verificationStatus] || \"inactive\"} /> : \"\"}\n            />\n            <InfoRow icon={Store} label={s.country} value={profile ? profile.country : \"\"} />\n            <InfoRow icon={Send} label={s.contactEmail} value={profile ? profile.contactEmail : \"\"} />\n          </div>\n        </Card>\n        <ReturnAddressCard />\n        <Card title={s.notifTitle} style={{ flex: 1 }}>\n          <div style={{ padding: 6 }}>\n            {s.toggles.map((label, i) => (\n              <div key={label} style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", padding: \"12px 12px\", borderBottom: i < 3 ? `1px solid ${C.line}` : \"none\" }}>\n                <span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{label}</span>\n                <div onClick={() => setToggles(ts => ts.map((v, j) => j === i ? !v : v))} style={{ width: 38, height: 22, borderRadius: 999, background: toggles[i] ? C.gauge : \"#D1D5DB\", position: \"relative\", cursor: \"pointer\" }}>\n                  <div style={{ width: 18, height: 18, borderRadius: \"50%\", background: \"#fff\", position: \"absolute\", top: 2, left: toggles[i] ? 18 : 2, transition: \"left 0.15s\" }} />\n                </div>\n              </div>\n            ))}\n          </div>\n        </Card>\n      </div>\n    </div>\n  );\n}\n\n/* ---------------- Shell ---------------- */","// Settings: each part is a tab under the header (Company information, Return address, Notification settings); the tab names the part, so the\n// boxes carry no title of their own.\nfunction SettingsPage() {\n  const { t, lang } = useLang();\n  const { profile } = useSupplier();\n  const s = t.settings;\n  const [toggles, setToggles] = useState([true, true, true, false]);\n  const [tab, setTab] = useState(\"company\");\n  const font = useBodyFont();\n  const settingsTabs = [{ id: \"company\", label: s.companyTitle }, { id: \"returnAddress\", label: s.returnAddress.title }, { id: \"notifications\", label: s.notifTitle }];\n  return (\n    <div>\n      <TopBar title={s.title} subtitle={s.subtitle} tabs={{ label: s.title, tabs: settingsTabs, activeId: tab, onSelect: setTab }} />\n      <div style={{ padding: 24, display: \"flex\", gap: 16, maxWidth: 820 }}>\n        {tab === \"company\" && <Card style={{ flex: 1 }}>\n          <div style={{ padding: 16, display: \"flex\", flexDirection: \"column\", gap: 14 }}>\n            {/* Real profile data only. A business license number and a \"main categories\" list used to\n                be typed in here (a placeholder number, and a fixed category list); neither exists in\n                the database, so they are gone rather than shown as if they were real. */}\n            <InfoRow icon={Building2} label={s.companyName} value={profile ? profile.name : \"\"} />\n            <InfoRow\n              icon={BadgeCheck}\n              label={s.verification}\n              value={profile ? <Badge label={s.verificationStates[profile.verificationStatus] || profile.verificationStatus} statusKey={VERIFICATION_BADGE[profile.verificationStatus] || \"inactive\"} /> : \"\"}\n            />\n            <InfoRow icon={Store} label={s.country} value={profile ? profile.country : \"\"} />\n            <InfoRow icon={Send} label={s.contactEmail} value={profile ? profile.contactEmail : \"\"} />\n          </div>\n        </Card>}\n        {tab === \"returnAddress\" && <ReturnAddressCard showTitle={false} />}\n        {tab === \"notifications\" && <Card style={{ flex: 1 }}>\n          <div style={{ padding: 6 }}>\n            {s.toggles.map((label, i) => (\n              <div key={label} style={{ display: \"flex\", justifyContent: \"space-between\", alignItems: \"center\", padding: \"12px 12px\", borderBottom: i < 3 ? `1px solid ${C.line}` : \"none\" }}>\n                <span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{label}</span>\n                <div onClick={() => setToggles(ts => ts.map((v, j) => j === i ? !v : v))} style={{ width: 38, height: 22, borderRadius: 999, background: toggles[i] ? C.gauge : \"#D1D5DB\", position: \"relative\", cursor: \"pointer\" }}>\n                  <div style={{ width: 18, height: 18, borderRadius: \"50%\", background: \"#fff\", position: \"absolute\", top: 2, left: toggles[i] ? 18 : 2, transition: \"left 0.15s\" }} />\n                </div>\n              </div>\n            ))}\n          </div>\n        </Card>}\n      </div>\n    </div>\n  );\n}\n\n/* ---------------- Shell ---------------- */"]]},{"file":"apps/supplier-portal/src/ReturnAddressFlow.test.jsx","what":"tests","done":"the return address is its own Settings tab","pairs":[["  fireEvent.click(screen.getByText(/^(店铺设置|Settings)$/));\n  await screen.findByText('退货地址');\n","  fireEvent.click(screen.getByText(/^(店铺设置|Settings)$/));\n  fireEvent.click(await screen.findByRole('tab', { name: /^(退货地址|Return address)$/ })); // the return address is its own Settings tab\n  await screen.findByText('退货地址');\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-supplier-settings-tabs`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the supplier portal (Ctrl+F5).');
