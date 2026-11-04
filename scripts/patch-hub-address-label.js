#!/usr/bin/env node
/**
 * The hub portal prints the delivery address label, like the hub app: two buttons in the "Ship to" card, "Print address label" (the browser's
 * print window) and "Download PDF". The same PDF the hub app shares, made by the server from the English address. Chinese and English.
 * The hub app's address card and its "Share / print address" button get their Chinese text too.
 *
 *   node scripts/patch-hub-address-label.js            dry run
 *   node scripts/patch-hub-address-label.js --write    applies it (each changed file is saved as <file>.before-hub-address-label first)
 * Then: hub portal: Ctrl+F5. Hub app: q, then flutter run with your API address. (No server change.)
 *
 * A file that is not as this patch expects is NOT changed (the whole patch stops). Windows (CRLF) line endings are handled. Running it twice is harmless.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"created":[{"file":"apps/hub-portal/src/AddressLabelButtons.jsx","what":"hub portal: print / download the address label","text":"import React, { useState } from \"react\";\nimport { API_BASE_URL, SessionExpiredError } from \"./auth\";\nimport { useLang } from \"./langContext\";\n\n// The delivery address label, the same PDF the hub app shares (GET /hub/me/shipments/:id/address-label, made by the server from the ENGLISH\n// address). \"Print\" opens the print window for it; \"Download\" saves it.\nconst C = { ink: \"#14171C\", line: \"#E4E6EA\", signal: \"#E8622C\", muted: \"#6B7280\" };\nconst body = { fontFamily: \"'Inter', sans-serif\" };\nconst TEXT = {\n  zh: { print: \"打印地址标签\", download: \"下载 PDF\", preparing: \"准备中…\" },\n  en: { print: \"Print address label\", download: \"Download PDF\", preparing: \"Preparing…\" },\n};\n\nasync function fetchLabel(token, shipmentId) {\n  const response = await fetch(`${API_BASE_URL}/hub/me/shipments/${encodeURIComponent(shipmentId)}/address-label`, { headers: { Authorization: `Bearer ${token}` } });\n  if (response.status === 401) throw new SessionExpiredError(\"Your session has expired. Please log in again.\");\n  if (!response.ok) {\n    const data = await response.json().catch(() => ({}));\n    throw new Error(data.error || `Request failed (${response.status})`);\n  }\n  return URL.createObjectURL(await response.blob());\n}\n\nexport default function AddressLabelButtons({ shipmentId, orderId, token, onError, onSessionExpired }) {\n  const { lang } = useLang();\n  const x = TEXT[lang] || TEXT.en;\n  const [busy, setBusy] = useState(null);      // \"print\" | \"download\" while the PDF is being made\n\n  const run = async (which) => {\n    setBusy(which); onError && onError(null);\n    try {\n      const url = await fetchLabel(token, shipmentId);\n      if (which === \"download\") {\n        const a = document.createElement(\"a\");\n        a.href = url; a.download = `LEAP-address-${orderId || shipmentId}.pdf`;\n        document.body.appendChild(a); a.click(); a.remove();\n        setTimeout(() => URL.revokeObjectURL(url), 60000);\n      } else {\n        // the PDF in a hidden frame, then the browser's print window for it; if the browser will not print a frame, the PDF opens in a new tab\n        const frame = document.createElement(\"iframe\");\n        frame.style.cssText = \"position:fixed;right:0;bottom:0;width:0;height:0;border:0;\";\n        frame.src = url;\n        frame.onload = () => {\n          try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch { window.open(url, \"_blank\"); }\n          setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);\n        };\n        document.body.appendChild(frame);\n      }\n    } catch (err) {\n      if (err instanceof SessionExpiredError) return onSessionExpired && onSessionExpired();\n      onError && onError(err.message);\n    } finally {\n      setBusy(null);\n    }\n  };\n\n  const button = (primary) => ({\n    ...body, flex: 1, height: 40, borderRadius: 9, display: \"flex\", alignItems: \"center\", justifyContent: \"center\", gap: 7, fontWeight: 700, fontSize: 13,\n    cursor: busy ? \"default\" : \"pointer\", background: \"#fff\", border: primary ? `1.5px solid ${C.signal}` : `1px solid ${C.line}`, color: primary ? C.signal : C.ink, opacity: busy ? 0.7 : 1,\n  });\n  return (\n    <div data-testid=\"address-label-buttons\" style={{ display: \"flex\", gap: 8, marginTop: 14 }}>\n      <button type=\"button\" disabled={!!busy} onClick={() => run(\"print\")} style={button(true)}>🖨 {busy === \"print\" ? x.preparing : x.print}</button>\n      <button type=\"button\" disabled={!!busy} onClick={() => run(\"download\")} style={button(false)}>⬇ {busy === \"download\" ? x.preparing : x.download}</button>\n    </div>\n  );\n}\n"}],"anchored":[{"file":"apps/hub-portal/src/App.jsx","what":"hub portal: the buttons in the \"Ship to\" card","done":"from \"./AddressLabelButtons\"","pairs":[["import ShippingCostCard from \"./ShippingCostCard\";","import AddressLabelButtons from \"./AddressLabelButtons\";      // print / download the delivery address label (the same PDF as the hub app)\nimport ShippingCostCard from \"./ShippingCostCard\";"],["{t.detail.shipToAuto}</div>\n              )}\n            </div>\n","{t.detail.shipToAuto}</div>\n              )}\n              <AddressLabelButtons shipmentId={shipmentId} orderId={shipment.orderId} token={getStoredToken()} onError={setErrorMessage} onSessionExpired={onSessionExpired} />\n            </div>\n"]]},{"file":"apps/hub-mobile/lib/features/shipment/shipment_detail_screen.dart","what":"hub app: the address card and its button in Chinese too","done":"'分享 / 打印地址'","pairs":[["          const Text('DELIVERY ADDRESS', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),","          Text(Provider.of<LanguageState>(context, listen: false).language == 'zh' ? '收货地址' : 'DELIVERY ADDRESS', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: HubColors.muted)),"],["              label: Text(_isSharingAddress ? 'Preparing…' : 'Share / print address'),","              label: Text(Provider.of<LanguageState>(context, listen: false).language == 'zh'\n                  ? (_isSharingAddress ? '准备中…' : '分享 / 打印地址')\n                  : (_isSharingAddress ? 'Preparing…' : 'Share / print address')),"]]}]};
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
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && e.pairs.some(([a]) => !once(n, a))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) { if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: 'the item checklist code (_specLabelsFor ... _buildMainStepForm) was not found' };
      out = out.slice(0, i) + e.block.text + out.slice(j);
    }
    return out;
  });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-hub-address-label`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: hub portal: Ctrl+F5. Hub app: q, then flutter run with your API address.');
