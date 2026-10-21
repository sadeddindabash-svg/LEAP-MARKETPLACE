#!/usr/bin/env node
/**
 * Shows the supplier which CAR each part of an order is for. When an order is placed, the server reads the buyer's My Garage and records the car for each order line (the buyer does
 * nothing new); the supplier portal then shows it, with its photo and a check against the product's fitment list. This changes three files that already exist in your project:
 *
 *   1. services/api/src/modules/order/routes.js     one require and one call, just before the order is committed. The call can never stop an order (it runs in a savepoint).
 *   2. services/api/src/modules/supplier/routes.js  GET /supplier/me/orders gives each item its car (only the lines of the supplier's own sub-order are looked up).
 *   3. apps/supplier-portal/src/App.jsx             a "Car" column in the orders list and the car under each item in the order detail (the screens themselves are the new file OrderVehicle.jsx).
 *
 *   node scripts/patch-order-vehicles.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-order-vehicles.js --write    applies it (each file is saved as <file>.before-order-vehicles first)
 *
 * It refuses to change a file whose text is not exactly what it expects (so it can never half-apply), and says "already applied" when it was done before.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const once = (s, a) => s.split(a).length === 2;
const replaceOnce = (s, a, b) => (once(s, a) ? s.replace(a, () => b) : null);

const edits = [
  { file: 'services/api/src/modules/order/routes.js', what: 'record the car of each order line just before the order is committed',
    done: (s) => s.includes('recordOrderVehicles'),
    apply: (s) => {
      let out = replaceOnce(s, "const { logAdminAction } = require('../audit/helpers');", "const { logAdminAction } = require('../audit/helpers');\nconst { recordOrderVehicles } = require('../orderVehicles/record');");
      if (out === null) return null;
      const anchor = "      supplierSubOrders.push({ subOrderId, supplierId, status: 'pending', items: lineItems });\n    }\n\n    await client.query('COMMIT');";
      return replaceOnce(out, anchor, "      supplierSubOrders.push({ subOrderId, supplierId, status: 'pending', items: lineItems });\n    }\n\n    // Which car each part is for, read from the buyer's My Garage (the buyer does nothing new). It can never stop an order: see orderVehicles/record.js.\n    await recordOrderVehicles(client, { orderId, userId: userId || null });\n\n    await client.query('COMMIT');");
    } },
  { file: 'services/api/src/modules/supplier/routes.js', what: 'give each item of GET /supplier/me/orders its car',
    done: (s) => s.includes('loadLineVehicles'),
    apply: (s) => {
      let out = replaceOnce(s, "const db = require('../../../db/pool');", "const db = require('../../../db/pool');\nconst { loadLineVehicles } = require('../orderVehicles/read');");
      if (out === null) return null;
      out = replaceOnce(out, 'SELECT oli.product_id, oli.quantity, oli.unit_price, p.name', 'SELECT oli.id AS line_id, oli.product_id, oli.quantity, oli.unit_price, p.name');
      if (out === null) return null;
      out = replaceOnce(out, "        [so.id]\n      );\n      result.push({\n        subOrderId: so.id,", "        [so.id]\n      );\n      const vehicles = await loadLineVehicles(db, items.map((i) => i.line_id));      // only the lines of THIS supplier's sub-order\n      result.push({\n        subOrderId: so.id,");
      if (out === null) return null;
      return replaceOnce(out, "items: items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity, unitPrice: Number(i.unit_price) })),", "items: items.map((i) => ({ productId: i.product_id, name: i.name, quantity: i.quantity, unitPrice: Number(i.unit_price), vehicle: vehicles.get(i.line_id) || null })),");
    } },
  { file: 'apps/supplier-portal/src/App.jsx', what: 'the Car column in the orders list and the car under each item in the order detail',
    done: (s) => s.includes('OrderVehicle'),
    apply: (s) => {
      let out = replaceOnce(s, 'import { vehicleSummary } from "./vehicleLabels";', 'import { vehicleSummary } from "./vehicleLabels";\nimport OrderVehicle, { OrderVehicleCell, carHeader } from "./OrderVehicle";');
      if (out === null) return null;
      out = replaceOnce(out, '<span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{it.name}</span>', '<div style={{ minWidth: 0 }}><span style={{ ...font, fontSize: 13, fontWeight: 600 }}>{it.name}</span><OrderVehicle vehicle={it.vehicle} /></div>');
      if (out === null) return null;
      out = replaceOnce(out, '<Th>{t.orders.thItems}</Th>', '<Th>{t.orders.thItems}</Th><Th>{carHeader(lang)}</Th>');
      if (out === null) return null;
      const cell = /(<Td style=\{\{ maxWidth: 260 \}\}>\{o\.items\.map\(i => i\.name\)\.join\([^)]*\)\}<\/Td>)/g;
      if ((out.match(cell) || []).length !== 1) return null;
      out = out.replace(cell, (m) => `${m}\n                      <Td style={{ minWidth: 150 }}><OrderVehicleCell items={o.items} /></Td>`);
      const start = out.indexOf('function OrdersPage('), end = out.indexOf('\n}\n', start);        // the empty-state row spans all columns: one more now
      const body = out.slice(start, end);
      if (start < 0 || body.split('colSpan={5}').length !== 2) return null;
      return out.slice(0, start) + body.replace('colSpan={5}', 'colSpan={6}') + out.slice(end);
    } },
];

let problems = 0;
for (const e of edits) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (e.done(s)) { console.log(`already   ${e.file}: ${e.what} (nothing to do)`); continue; }
  const out = e.apply(s);
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.`); problems++; continue; }
  if (write) { fs.writeFileSync(`${p}.before-order-vehicles`, s); fs.writeFileSync(p, out); console.log(`patched   ${e.file}: ${e.what}`); }
  else console.log(`would     ${e.file}: ${e.what}`);
}
if (!write && problems === 0) console.log('\nDry run only. Add --write to apply. Then run the migration: cd services\\api && npm run migrate');
process.exit(problems ? 1 : 0);
