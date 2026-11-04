#!/usr/bin/env node
/**
 * Website: "fly to cart" from the PRODUCT CARDS too (home, search, the rows under a product): the card's cart icon sends that card's photo flying to the cart
 * in the header. Needs patch-fly-to-cart first (it has the motion itself).
 *
 *   node scripts/patch-fly-cards.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-fly-cards.js --write    applies it (each changed file is saved as <file>.before-fly-cards first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied).
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/components/CardAddToCart.tsx", "what": "product cards: the cart icon sends the card's photo flying to the cart", "done": "flyToCart(button.current?.closest(\"li\")", "pairs": [["import { useT } from \"@/components/LangProvider\";\n\n", "import { useT } from \"@/components/LangProvider\";\nimport { flyToCart } from \"@/lib/flyToCart\";\n\n"], ["  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);\n", "  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);\n  const button = useRef<HTMLButtonElement>(null);\n  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);\n"], ["    if (status === \"adding\") return;\n    setStatus(\"adding\");\n", "    if (status === \"adding\") return;\n    // \"Fly to cart\": this card's photo (data-fly-photo) flies to the cart in the header while the cart is updated; with no photo, a chip from this button.\n    flyToCart(button.current?.closest(\"li\")?.querySelector(\"[data-fly-photo]\") ?? button.current);\n    setStatus(\"adding\");\n"], ["    <>\n      <button type=\"button\" onClick={press} disabled={status === \"adding\"} aria-label={`${t(\"add_to_cart\")}: ${name}`} title={status === \"error\" ? t(\"add_failed\") : undefined} data-status={status}\n        className=\"grid size-11 place-items-center rounded-[11px] bg-signal text-on-signal shadow-[0_2px_6px_rgba(250,178,25,0.4)] transition-colors hover:bg-signal-dark disabled:opacity-60\">\n", "    <>\n      <button ref={button} type=\"button\" onClick={press} disabled={status === \"adding\"} aria-label={`${t(\"add_to_cart\")}: ${name}`} title={status === \"error\" ? t(\"add_failed\") : undefined} data-status={status}\n        className=\"grid size-11 place-items-center rounded-[11px] bg-signal text-on-signal shadow-[0_2px_6px_rgba(250,178,25,0.4)] transition-colors hover:bg-signal-dark disabled:opacity-60\">\n"]]}, {"file": "apps/web-storefront/components/ProductCard.tsx", "what": "product cards: the photo is where the flight starts", "done": "data-fly-photo=\"\"", "pairs": [["        {/* A true SQUARE. A real photo is drawn WHOLE (object-contain) inside a small margin, so a long part (a wiper blade) is never cut off; no photo shows the icon on grey. */}\n        <div className={`relative aspect-square ${p.images[0] ? \"border-b border-line bg-white\" : \"bg-[#e6edf2]\"}`}>\n          {p.images[0] ? (\n", "        {/* A true SQUARE. A real photo is drawn WHOLE (object-contain) inside a small margin, so a long part (a wiper blade) is never cut off; no photo shows the icon on grey. */}\n        <div data-fly-photo=\"\" className={`relative aspect-square ${p.images[0] ? \"border-b border-line bg-white\" : \"bg-[#e6edf2]\"}`}>\n          {p.images[0] ? (\n"]]}], "created": [{"file": "apps/web-storefront/components/CardFly.test.tsx", "what": "the card's fly-to-cart test", "text": "import { describe, it, expect, vi } from \"vitest\";\nimport { fireEvent, render, screen } from \"@testing-library/react\";\n\n// \"Fly to cart\" from a product card: the add-to-cart icon sends THIS card's photo to the cart.\nconst m = vi.hoisted(() => ({ fly: vi.fn(), add: vi.fn(async () => {}) }));\nvi.mock(\"@/lib/flyToCart\", () => ({ flyToCart: (el: Element | null) => m.fly(el) }));\nvi.mock(\"@/components/CartProvider\", () => ({ useOptionalCart: () => ({ addItem: m.add }) }));\nimport CardAddToCart from \"./CardAddToCart\";\nimport { LangProvider } from \"./LangProvider\";\n\ndescribe(\"adding from a product card\", () => {\n  it(\"CRITICAL: flies the card's own photo, and adds one\", () => {\n    render(<LangProvider lang=\"en\"><ul><li><div data-fly-photo=\"\" data-testid=\"photo-a\" /><CardAddToCart productId=\"a\" name=\"Pads\" inStock /></li><li><div data-fly-photo=\"\" data-testid=\"photo-b\" /></li></ul></LangProvider>);\n    fireEvent.click(screen.getByRole(\"button\", { name: \"Add to cart: Pads\" }));\n    expect(m.fly).toHaveBeenCalledWith(screen.getByTestId(\"photo-a\"));\n    expect(m.add).toHaveBeenCalledWith(\"a\", 1);\n  });\n});\n"}]};
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
    if (c.before !== null) fs.writeFileSync(`${p}.before-fly-cards`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Ctrl+F5 on the website.');
