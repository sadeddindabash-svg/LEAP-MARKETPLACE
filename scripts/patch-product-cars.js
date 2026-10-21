#!/usr/bin/env node
/**
 * The supplier sees the PART and the CAR IT BELONGS TO (never the buyer's car), and the buyer is told whether a part fits their car. Run this AFTER scripts/patch-order-vehicles.js.
 * It changes these existing files (and nothing else):
 *
 *   1. services/api/src/modules/supplier/routes.js   GET /supplier/me/orders gives each item the part's main photo and the car(s) the product is listed for, instead of the buyer's car
 *   2. services/api/src/modules/catalog/routes.js    GET /catalog/products/:id also returns the cars the product fits (fitCars, fitCarCount, fitKeys); it can never break the product page
 *   3. apps/web-storefront/lib/api.ts                the three new optional fields on a product
 *   4. apps/web-storefront/app/products/[id]/page.tsx   the product page shows the new fit message (the green "Confirmed fit", or "This part fits ... Your car: ...")
 *   5. apps/web-storefront/app/cart/page.tsx         the same message under each item in the cart
 *   6. apps/web-storefront/app/stage1c-page.test.tsx   the existing product page test now looks for the new FitCheck component where it used to look for the old badge (plus one new check)
 *
 *   node scripts/patch-product-cars.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-product-cars.js --write    applies it (each file is saved as <file>.before-product-cars first)
 *
 * It refuses to change a file whose text is not exactly what it expects (so it can never half-apply), and says "already applied" when it was done before.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const once = (s, a) => s.split(a).length === 2;
const replaceOnce = (s, a, b) => (once(s, a) ? s.replace(a, () => b) : null);
const chain = (s, pairs) => { let out = s; for (const [a, b] of pairs) { out = replaceOnce(out, a, b); if (out === null) return null; } return out; };

const edits = [
  { file: 'services/api/src/modules/supplier/routes.js', what: "give each item of GET /supplier/me/orders the part's photo and the car(s) it belongs to (not the buyer's car)",
    done: (s) => s.includes('loadProductCars'),
    apply: (s) => chain(s, [
      ["const { loadLineVehicles } = require('../orderVehicles/read');", "const { loadProductCars } = require('../orderVehicles/productCars');"],
      ["const vehicles = await loadLineVehicles(db, items.map((i) => i.line_id));      // only the lines of THIS supplier's sub-order", "const productCars = await loadProductCars(db, items.map((i) => i.product_id));      // the part's photo and the car(s) it is listed for: never the buyer's car"],
      ['vehicle: vehicles.get(i.line_id) || null })),', 'vehicle: productCars.get(i.product_id) || null })),'],
    ]) },
  { file: 'services/api/src/modules/catalog/routes.js', what: 'return the cars a product fits on GET /catalog/products/:id',
    done: (s) => s.includes('loadBuyerFit'),
    apply: (s) => chain(s, [
      ["const db = require('../../../db/pool');", "const db = require('../../../db/pool');\nconst { loadBuyerFit } = require('../orderVehicles/productCars');"],
      ["      fitsVehicleIds: fitmentResult.rows.map((r) => r.vehicle_id),\n      attributes:", "      fitsVehicleIds: fitmentResult.rows.map((r) => r.vehicle_id),\n      ...(await loadBuyerFit(db, req.params.id)),      // the cars it fits (names, how many, and a key of each) for the \"fits your car?\" message\n      attributes:"],
    ]) },
  { file: 'apps/web-storefront/lib/api.ts', what: 'the new optional fit fields on a product',
    done: (s) => s.includes('fitCarCount'),
    apply: (s) => replaceOnce(s, '  fitsVehicleIds: string[];\n}', '  fitsVehicleIds: string[];\n  /** The first cars the product fits, how many in all, and a "generation|year" key for each one (the "fits your car?" message). */\n  fitCars?: { generationId: string; year: number | null; brand: string | null; brandAr?: string | null; model: string | null; modelAr?: string | null }[];\n  fitCarCount?: number;\n  fitKeys?: string[];\n}') },
  { file: 'apps/web-storefront/app/products/[id]/page.tsx', what: 'the fit message on the product page',
    done: (s) => s.includes('FitCheck'),
    apply: (s) => chain(s, [
      ['import ConfirmedFit from "@/components/ConfirmedFit";', 'import FitCheck from "@/components/FitCheck";'],
      ['<ConfirmedFit fitsVehicleIds={product.fitsVehicleIds} />', '<FitCheck fitCars={product.fitCars} fitCarCount={product.fitCarCount} fitKeys={product.fitKeys} fitsVehicleIds={product.fitsVehicleIds} />'],
    ]) },
  { file: 'apps/web-storefront/app/cart/page.tsx', what: 'the fit message under each cart item',
    done: (s) => s.includes('FitCheck'),
    apply: (s) => chain(s, [
      ['import SafeImage from "@/components/SafeImage";', 'import SafeImage from "@/components/SafeImage";\nimport FitCheck from "@/components/FitCheck";'],
      ['{item.supplierName && <p className="mt-0.5 text-sm text-muted">{supplierLabel(item.supplierName, t("supplier_word"))}</p>}', '{item.supplierName && <p className="mt-0.5 text-sm text-muted">{supplierLabel(item.supplierName, t("supplier_word"))}</p>}\n        <FitCheck productId={item.productId} />'],
    ]) },
  { file: 'apps/web-storefront/app/stage1c-page.test.tsx', what: 'the existing product page test, for the new fit component',
    done: (s) => s.includes('FitCheck'),
    apply: (s) => chain(s, [
      ['import ConfirmedFit from "@/components/ConfirmedFit";', 'import FitCheck from "@/components/FitCheck";'],
      ['ProductGallery, ConfirmedFit, NotifyWhenInStock, ShareButton];', 'ProductGallery, FitCheck, NotifyWhenInStock, ShareButton];'],
      ['["ProductGallery", "ConfirmedFit", "NotifyWhenInStock", "ShareButton"]', '["ProductGallery", "FitCheck", "NotifyWhenInStock", "ShareButton"]'],
      ['    expect(found.find((e) => e.type === ConfirmedFit)?.props.fitsVehicleIds).toEqual(["g1", "g2"]);\n  });\n',
       '    expect(found.find((e) => e.type === FitCheck)?.props.fitsVehicleIds).toEqual(["g1", "g2"]);\n  });\n\n'
       + '  it("the fit message gets the cars the part fits, how many, and a key of each, so it can tell whether the buyer\'s own car is one of them", async () => {\n'
       + '    m.product.current = detail({ fitCars: [{ generationId: "g1", year: 2024, brand: "BYD", model: "Seal" }], fitCarCount: 7, fitKeys: ["g1|2024", "g2|2023"] });\n'
       + '    const found = await render();\n'
       + '    expect(found.find((e) => e.type === FitCheck)?.props).toMatchObject({ fitCarCount: 7, fitKeys: ["g1|2024", "g2|2023"], fitCars: [{ generationId: "g1", year: 2024, brand: "BYD", model: "Seal" }] });\n  });\n'],
    ]) },
];

let problems = 0;
for (const e of edits) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (e.done(s)) { console.log(`already   ${e.file}: ${e.what} (nothing to do)`); continue; }
  const out = e.apply(s);
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects${e.file.includes('supplier/routes') ? ' (run scripts/patch-order-vehicles.js --write first)' : ''}, so nothing was changed. Send this file to the Leap team.`); problems++; continue; }
  if (write) { fs.writeFileSync(`${p}.before-product-cars`, s); fs.writeFileSync(p, out); console.log(`patched   ${e.file}: ${e.what}`); }
  else console.log(`would     ${e.file}: ${e.what}`);
}
if (!write && problems === 0) console.log('\nDry run only. Add --write to apply.');
process.exit(problems ? 1 : 0);
