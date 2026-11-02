#!/usr/bin/env node
/**
 * Admin portal: the side menu in this order: Overview, Orders, Products, Vehicle Data, Categories, Suppliers, Hubs, Delivery Rules, Returns,
 * Flagged Shipments, Support, Financial, Settings. Needs patch-menu-sticky first.
 *
 *   node scripts/patch-menu-order.js            dry run
 *   node scripts/patch-menu-order.js --write    applies it (each changed file is saved as <file>.before-menu-order first)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/admin-dashboard/src/App.jsx","what":"the menu in the new order","done":"// The side menu's order.","pairs":[["\nconst NAV = [\n","\n// The side menu's order. A group (Products, Suppliers, Support, Financial) sits where its first page is in this list.\nconst NAV = [\n"],["  { id: \"orders\", label: \"Orders\", icon: ShoppingBag },\n  { id: \"suppliers\", label: \"Suppliers\", icon: Store },\n","  { id: \"orders\", label: \"Orders\", icon: ShoppingBag },\n  { id: \"allProducts\", label: \"All Products\", icon: Package },\n  { id: \"moderation\", label: \"Moderation\", icon: PackageSearch },\n  { id: \"vehicleData\", label: \"Vehicle Data\", icon: Truck },\n  { id: \"categories\", label: \"Categories\", icon: Layers },\n  { id: \"suppliers\", label: \"Suppliers\", icon: Store },\n"],["  { id: \"suppliers\", label: \"Suppliers\", icon: Store },\n  { id: \"moderation\", label: \"Moderation\", icon: PackageSearch },\n  { id: \"allProducts\", label: \"All Products\", icon: Package },\n  { id: \"returns\", label: \"Returns\", icon: RotateCcw },\n","  { id: \"suppliers\", label: \"Suppliers\", icon: Store },\n  { id: \"supplierMessages\", label: \"Supplier Messages\", icon: MessageSquare },\n  { id: \"hubs\", label: \"Hubs\", icon: Warehouse },\n  { id: \"deliveryRules\", label: \"Delivery Rules\", icon: Globe },\n  { id: \"returns\", label: \"Returns\", icon: RotateCcw },\n"],["  { id: \"returns\", label: \"Returns\", icon: RotateCcw },\n  { id: \"vehicleData\", label: \"Vehicle Data\", icon: Truck },\n  { id: \"deliveryRules\", label: \"Delivery Rules\", icon: Globe },\n  { id: \"categories\", label: \"Categories\", icon: Layers },\n  { id: \"supplierMessages\", label: \"Supplier Messages\", icon: MessageSquare },\n  { id: \"promoCodes\", label: \"Promo Codes\", icon: Tag },\n","  { id: \"returns\", label: \"Returns\", icon: RotateCcw },\n  { id: \"flagged\", label: \"Flagged Shipments\", icon: AlertTriangle },\n  { id: \"tickets\", label: \"Support\", icon: LifeBuoy },\n  { id: \"reviews\", label: \"Reviews\", icon: Star },\n  { id: \"promoCodes\", label: \"Promo Codes\", icon: Tag },\n"],["  { id: \"promoCodes\", label: \"Promo Codes\", icon: Tag },\n  { id: \"hubs\", label: \"Hubs\", icon: Warehouse },\n  { id: \"pricing\", label: \"Pricing\", icon: Calculator },\n  { id: \"paymentMethods\", label: \"Payment Methods\", icon: CreditCard },\n","  { id: \"promoCodes\", label: \"Promo Codes\", icon: Tag },\n  { id: \"paymentMethods\", label: \"Payment Methods\", icon: CreditCard },\n"],["  { id: \"paymentProviders\", label: \"Payment Providers\", icon: Key },\n  { id: \"flagged\", label: \"Flagged Shipments\", icon: AlertTriangle },\n  { id: \"payouts\", label: \"Payouts\", icon: Wallet },\n","  { id: \"paymentProviders\", label: \"Payment Providers\", icon: Key },\n  { id: \"payouts\", label: \"Payouts\", icon: Wallet },\n"],["  { id: \"payouts\", label: \"Payouts\", icon: Wallet },\n  { id: \"reviews\", label: \"Reviews\", icon: Star },\n  { id: \"tickets\", label: \"Support\", icon: LifeBuoy },\n  { id: \"settings\", label: \"Settings\", icon: Settings },\n","  { id: \"payouts\", label: \"Payouts\", icon: Wallet },\n  { id: \"pricing\", label: \"Pricing\", icon: Calculator },\n  { id: \"settings\", label: \"Settings\", icon: Settings },\n"]]},{"file":"apps/admin-dashboard/src/NavGroupsFlow.test.jsx","what":"tests","done":"['Overview', 'Orders', 'Products', 'Vehicle Data'","pairs":[["    mockServer(); await signIn();\n    expect(sidebarNames()).toEqual(['Overview', 'Orders', 'Suppliers', 'Products', 'Returns', 'Vehicle Data', 'Delivery Rules', 'Categories', 'Support', 'Hubs', 'Financial', 'Flagged Shipments', 'Settings']);\n    for (const gone of ['Supplier Messages', 'Moderation', 'All Products', 'Promo Codes', 'Pricing', 'Payment Methods', 'Payment Providers', 'Payouts', 'Reviews']) {\n","    mockServer(); await signIn();\n    expect(sidebarNames()).toEqual(['Overview', 'Orders', 'Products', 'Vehicle Data', 'Categories', 'Suppliers', 'Hubs', 'Delivery Rules', 'Returns', 'Flagged Shipments', 'Support', 'Financial', 'Settings']);\n    for (const gone of ['Supplier Messages', 'Moderation', 'All Products', 'Promo Codes', 'Pricing', 'Payment Methods', 'Payment Providers', 'Payouts', 'Reviews']) {\n"]]},{"file":"apps/admin-dashboard/src/adminNav.test.js","what":"tests","done":"['Overview', 'Orders', 'Products', 'Vehicle Data'","pairs":[["  it('CRITICAL: for the owner the sidebar is the old list with each group at the place of its first member', () => {\n    expect(labels(sidebarEntries(NAV, allowing('all')))).toEqual(['Overview', 'Orders', 'Suppliers', 'Products', 'Returns', 'Vehicle Data', 'Delivery Rules', 'Categories', 'Support', 'Hubs', 'Financial', 'Flagged Shipments', 'Settings']);\n  });\n","  it('CRITICAL: for the owner the sidebar is the old list with each group at the place of its first member', () => {\n    expect(labels(sidebarEntries(NAV, allowing('all')))).toEqual(['Overview', 'Orders', 'Products', 'Vehicle Data', 'Categories', 'Suppliers', 'Hubs', 'Delivery Rules', 'Returns', 'Flagged Shipments', 'Support', 'Financial', 'Settings']);\n  });\n"]]}],"created":[]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-menu-order`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Refresh the admin portal (Ctrl+F5).');
