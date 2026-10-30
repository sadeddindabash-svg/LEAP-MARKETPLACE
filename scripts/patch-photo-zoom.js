#!/usr/bin/env node
/**
 * Supplier portal, Orders: the mouse over a part or car photo shows it large beside it, the whole photo with its name:
 * 360 x 360 in the order details, 220 x 220 for the small photos of the orders list. Closes when the mouse leaves.
 *
 *   node scripts/patch-photo-zoom.js            dry run
 *   node scripts/patch-photo-zoom.js --write    applies it (OrderVehicle.jsx is saved as OrderVehicle.jsx.before-photo-zoom first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/supplier-portal/src/OrderVehicle.jsx","what":"the part and car photos of orders zoom on mouse over (details and list)","done":"zoom = width >= 90 ? 360 : 220","pairs":[["function Photo({ url, width, height, label, Icon }) {\n  const address = src(url);\n  return (\n    <div style={{ width, height, borderRadius: 6, border: `1px solid ${C.line}`, background: C.canvas, display: \"flex\", alignItems: \"center\", justifyContent: \"center\", overflow: \"hidden\", flexShrink: 0 }}>\n      {address ? <img src={address} alt={label} style={{ width: \"100%\", height: \"100%\", objectFit: \"cover\" }} /> : <Icon size={Math.round(height / 2.2)} color={C.muted} aria-hidden=\"true\" />}\n    </div>\n  );\n}","// Mouse over a photo (the part or the car) and it shows large beside it, the whole photo with its name: 360 x 360 in the order\n// details, 220 x 220 for the small photos of the orders list. It closes when the mouse leaves (or the page scrolls).\nfunction Photo({ url, width, height, label, Icon, zoom = width >= 90 ? 360 : 220 }) {\n  const address = src(url);\n  const font = useBodyFont();\n  const [at, setAt] = React.useState(null);\n  React.useEffect(() => {\n    if (!at) return undefined;\n    const close = () => setAt(null);\n    window.addEventListener(\"scroll\", close, true);\n    return () => window.removeEventListener(\"scroll\", close, true);\n  }, [at]);\n  const open = (e) => {\n    if (!address || !zoom) return;\n    const r = e.currentTarget.getBoundingClientRect();\n    const boxW = zoom + 18;\n    const boxH = zoom + 44;\n    const left = r.right + 10 + boxW <= window.innerWidth ? r.right + 10 : Math.max(8, r.left - 10 - boxW);\n    const top = Math.min(Math.max(8, r.top - 20), Math.max(8, window.innerHeight - boxH - 8));\n    setAt({ left, top });\n  };\n  return (\n    <div\n      data-testid=\"zoomable-photo\"\n      onMouseEnter={open}\n      onMouseLeave={() => setAt(null)}\n      style={{ width, height, borderRadius: 6, border: `1px solid ${C.line}`, background: C.canvas, display: \"flex\", alignItems: \"center\", justifyContent: \"center\", overflow: \"hidden\", flexShrink: 0, cursor: address ? \"zoom-in\" : \"default\" }}\n    >\n      {address ? <img src={address} alt={label} style={{ width: \"100%\", height: \"100%\", objectFit: \"cover\" }} /> : <Icon size={Math.round(height / 2.2)} color={C.muted} aria-hidden=\"true\" />}\n      {at ? (\n        <div data-testid=\"photo-zoom\" style={{ position: \"fixed\", left: at.left, top: at.top, zIndex: 1000, background: \"#fff\", border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: \"0 12px 32px rgba(0,0,0,0.22)\", padding: 8, pointerEvents: \"none\" }}>\n          <img src={address} alt={label} style={{ width: zoom, height: zoom, objectFit: \"contain\", display: \"block\", background: C.canvas, borderRadius: 6 }} />\n          <div style={{ ...font, fontSize: 12, fontWeight: 600, color: C.ink, textAlign: \"center\", marginTop: 6, maxWidth: zoom, overflow: \"hidden\", textOverflow: \"ellipsis\", whiteSpace: \"nowrap\" }}>{label}</div>\n        </div>\n      ) : null}\n    </div>\n  );\n}"]]}],"created":[{"file":"apps/supplier-portal/src/photoZoom.wiring.test.js","what":"the test","text":"import { readFileSync } from \"node:fs\";\nimport { describe, expect, it } from \"vitest\";\n\n// Orders: the mouse over a part or car photo shows it large (order details 360 x 360, orders list 220 x 220). Reads the source text.\ndescribe(\"Photo zoom on orders\", () => {\n  const src = readFileSync(\"src/OrderVehicle.jsx\", \"utf8\");\n  it(\"every part and car photo zooms on mouse over\", () => {\n    expect(src).toContain(\"zoom = width >= 90 ? 360 : 220\");\n    expect(src).toContain(\"onMouseEnter={open}\");\n    expect(src).toContain(\"onMouseLeave={() => setAt(null)}\");\n  });\n  it(\"the whole photo, beside it, above everything\", () => {\n    expect(src).toContain('objectFit: \"contain\"');\n    expect(src).toContain('position: \"fixed\"');\n  });\n});\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-photo-zoom`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Reload the supplier portal with Ctrl+F5.');
