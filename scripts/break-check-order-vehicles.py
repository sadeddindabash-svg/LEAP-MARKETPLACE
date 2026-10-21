#!/usr/bin/env python3
"""Proves the tests of the part-and-car feature have teeth: breaks the code one way at a time, runs the tests, and expects them to FAIL (the code is restored after each break).
   python3 scripts/break-check-order-vehicles.py server|screens|storefront [first last]      (from the project root)"""
import subprocess, sys, os, shutil
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
API, SP, SF = f"{ROOT}/services/api", f"{ROOT}/apps/supplier-portal", f"{ROOT}/apps/web-storefront"
ENV = dict(os.environ, DATABASE_URL="postgresql://leap_dev:leap_dev_pw@localhost:5432/leap_catalog_import_test")
OV = "services/api/src/modules/orderVehicles/"; SR = "services/api/src/modules/supplier/routes.js"
SERVER = [
 ("the year is ignored in the recorded-car rule", OV + "choose.js", "e.generation_id === car.generation_id && (e.year === null || e.year === undefined || sameYear(e.year, car.year))", "e.generation_id === car.generation_id"),
 ("the default car is not preferred when two cars fit", OV + "choose.js", "const match = garage.find((car) => fits(entries, car));", "const match = [...garage].reverse().find((car) => fits(entries, car));"),
 ("a part that fits none records the oldest car instead of the default", OV + "choose.js", "car: garage[0], isDefault: Boolean(garage[0].is_default)", "car: garage[garage.length - 1], isDefault: Boolean(garage[garage.length - 1].is_default)"),
 ("a universal part is recorded as 'no car on file'", OV + "choose.js", "if (!entries || entries.length === 0) return { status: 'universal', car: null, isDefault: null };", "if (!entries || entries.length === 0) return { status: 'no_car', car: null, isDefault: null };"),
 ("a failure while recording is NOT contained (the order is lost)", OV + "record.js", "try { await client.query('ROLLBACK TO SAVEPOINT order_vehicles'); await client.query('RELEASE SAVEPOINT order_vehicles'); } catch (inner) { /* the order carries on regardless */ }", ""),
 ("recording twice duplicates (a retry breaks)", OV + "record.js", "ON CONFLICT (line_item_id) DO NOTHING", ""),
 ("the internal record's photo is no longer looked up live", OV + "read.js", "COALESCE(ver.photo_url, g.photo_url, m.photo_url, b.photo_url, olv.photo_url) AS live_photo", "olv.photo_url AS live_photo"),
 ("reading a line can return other lines too", OV + "read.js", "WHERE olv.line_item_id = ANY($1)`, [lineIds]);", "WHERE olv.line_item_id = ANY($1) OR true`, [lineIds]);"),
 ("the order no longer records the buyer's car", "services/api/src/modules/order/routes.js", "await recordOrderVehicles(client, { orderId, userId: userId || null });", ""),
 ("the order forgets who the buyer is, so the garage is never read", "services/api/src/modules/order/routes.js", "await recordOrderVehicles(client, { orderId, userId: userId || null });", "await recordOrderVehicles(client, { orderId, userId: null });"),
 ("a replacement order no longer gets the recorded car", "services/api/src/modules/faultCases/helpers.js", "await copyLineVehicles(client, { fromSubOrderId: original.id, toSubOrderId: newSub[0].id });", ""),
 ("a replacement copies from the wrong order", "services/api/src/modules/faultCases/helpers.js", "fromSubOrderId: original.id, toSubOrderId: newSub[0].id", "fromSubOrderId: newSub[0].id, toSubOrderId: newSub[0].id"),
 ("a replacement line gets the record of ANY part of the original, not its own", OV + "copy.js", "JOIN order_line_items ol ON ol.product_id = nl.product_id AND ol.sub_order_id = $1", "JOIN order_line_items ol ON ol.sub_order_id = $1"),
 ("a failure while copying is NOT contained (the replacement is lost)", OV + "copy.js", "try { await client.query('ROLLBACK TO SAVEPOINT copy_order_vehicles'); await client.query('RELEASE SAVEPOINT copy_order_vehicles'); } catch (inner) { /* the replacement carries on regardless */ }", ""),
 ("the supplier endpoint no longer gives the part and its cars", SR, "vehicle: productCars.get(i.product_id) || null })),", "vehicle: null })),"),
 ("PRIVACY: the supplier endpoint leaks the buyer's car record again", SR, "vehicle: productCars.get(i.product_id) || null })),", "vehicle: { ...(productCars.get(i.product_id) || {}), car: {}, status: 'listed' } })),"),
 ("the part's main photo is the LAST one uploaded, not the first", OV + "productCars.js", "ORDER BY product_id, sort_order, id", "ORDER BY product_id, sort_order DESC, id"),
 ("the supplier is sent every car, not at most four", OV + "productCars.js", "cars: entries.slice(0, MAX_SUPPLIER_CARS).map(", "cars: entries.map("),
 ("the product's cars are in the wrong order (not first-added first)", OV + "productCars.js", "ORDER BY pfe.product_id, pfe.id`", "ORDER BY pfe.product_id, pfe.id DESC`"),
 ("the car's photo prefers the brand to the year", OV + "productCars.js", "photoUrl: r.generation_photo || r.model_photo || r.brand_photo || null", "photoUrl: r.brand_photo || r.model_photo || r.generation_photo || null"),
 ("a part that fits any car is not recognised", OV + "productCars.js", "fitsAnyCar: entries.length === 0,", "fitsAnyCar: false,"),
 ("the buyer's keys cover only the few cars that are named", OV + "productCars.js", "fitKeys: entries.slice(0, MAX_KEYS).map(", "fitKeys: entries.slice(0, MAX_BUYER_CARS).map("),
 ("a problem reading the fit takes the product page down", OV + "productCars.js", "    return { fitCarCount: 0, fitCars: [], fitKeys: [] };\n  }\n}", "    throw err;\n  }\n}"),
 ("the product page no longer returns the cars it fits", "services/api/src/modules/catalog/routes.js", "...(await loadBuyerFit(db, req.params.id)),", ""),
]
SCREENS = [
 ("the arrow between the part and the car is missing", "apps/supplier-portal/src/OrderVehicle.jsx", '<ArrowRight size={26} color={C.muted} aria-hidden="true" />', ""),
 ("the part's photo is not shown in the detail", "apps/supplier-portal/src/OrderVehicle.jsx", '<div><Photo url={vehicle.partPhotoUrl} width={110} height={82} label={t.part} Icon={Package} />{caption(t.part)}</div>', ""),
 ("the photo address is not completed", "apps/supplier-portal/src/OrderVehicle.jsx", '(url.startsWith("http") ? url : `${API_BASE_URL}${url}`)', "url"),
 ("Chinese names are never used", "apps/supplier-portal/src/OrderVehicle.jsx", '(lang === "zh" ? names.zh || names.en : names.en)', "names.en"),
 ("the engine and transmission are not shown", "apps/supplier-portal/src/OrderVehicle.jsx", "{carDetail(car) ? <div style={{ color: C.muted }}>{carDetail(car)}</div> : null}", ""),
 ("the cars the supplier was not sent are not counted", "apps/supplier-portal/src/OrderVehicle.jsx", "const hidden = Math.max(0, (vehicle.carCount || 0) - (vehicle.cars || []).length);", "const hidden = 0;"),
 ("a part that fits any car is not explained", "apps/supplier-portal/src/OrderVehicle.jsx", ") : <div style={{ ...font, fontSize: 12.5, color: C.muted }}>{t.fitsAny}</div>}", ") : null}"),
 ("the same car is counted twice in the list", "apps/supplier-portal/src/OrderVehicle.jsx", "const distinct = new Set(vehicles.flatMap((v) => (v.cars || []).map(key)));", "const distinct = new Set(vehicles.flatMap((v) => (v.cars || []).map((c, i) => key(c) + i + Math.random())));"),
 ("an item with no vehicle information crashes the screen", "apps/supplier-portal/src/OrderVehicle.jsx", "  if (!vehicle) return null;\n  const caption", "  const caption"),
 ("the orders list has no Part → Car column", "apps/supplier-portal/src/App.jsx", "<Th>{carHeader(lang)}</Th>", ""),
 ("the order detail shows no part and car", "apps/supplier-portal/src/App.jsx", "<OrderVehicle vehicle={it.vehicle} />", ""),
]
STOREFRONT = [
 ("the year is ignored: the same model in another year counts as a fit", "apps/web-storefront/components/FitCheck.tsx", '(fit.fitKeys ?? []).includes(`${defaultVehicle.generationId}|${defaultVehicle.year}`)', '(fit.fitKeys ?? []).some((k) => k.startsWith(`${defaultVehicle.generationId}|`))'),
 ("the older fit list is ignored", "apps/web-storefront/components/FitCheck.tsx", " || (fit.fitsVehicleIds ?? []).includes(defaultVehicle.generationId)", ""),
 ("a buyer with no car in My Garage crashes the page", "apps/web-storefront/components/FitCheck.tsx", "if (!defaultVehicle || !fit) return null;", "if (!fit) return null;"),
 ("the number of other cars is not shown", "apps/web-storefront/components/FitCheck.tsx", '{total > cars.length ? ` (${x.more(total - cars.length)})` : ""}', ""),
 ("a part that fits any car shows an empty warning", "apps/web-storefront/components/FitCheck.tsx", "if (total === 0 || cars.length === 0) return null;", ""),
 ("the cart reads the same part again every time", "apps/web-storefront/components/FitCheck.tsx", "if (!remembered.has(productId)) {", "if (true) {"),
 ("a part that cannot be read crashes the cart", "apps/web-storefront/components/FitCheck.tsx", ".catch(() => null)", ""),
 ("the product page does not pass the cars to the fit message", "apps/web-storefront/app/products/[id]/page.tsx", " fitKeys={product.fitKeys}", ""),
 ("the cart shows no fit message", "apps/web-storefront/app/cart/page.tsx", "\n        <FitCheck productId={item.productId} />", ""),
]
mode = sys.argv[1] if len(sys.argv) > 1 else "server"; BREAKS = {"server": SERVER, "screens": SCREENS, "storefront": STOREFRONT}[mode]
lo, hi = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1, len(BREAKS))
def fresh():
    subprocess.run(["su", "postgres", "-c", "psql -q -c 'DROP DATABASE IF EXISTS leap_catalog_import_test' -c \"CREATE DATABASE leap_catalog_import_test TEMPLATE leap_marketplace_dev OWNER leap_dev\""], check=True, capture_output=True)
def run():
    if mode == "server": return subprocess.run(["node", "--test", "test/orderVehicles.test.js", "test/productCars.test.js", "test/orderVehiclesReplacement.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "screens": return subprocess.run(["npx", "vitest", "run", "src/OrderVehicle.test.jsx", "src/OrderVehicleFlow.test.jsx"], cwd=SP, capture_output=True, text=True, timeout=150).returncode
    return subprocess.run(["npx", "vitest", "run", "components/FitCheck.test.tsx", "app/stage1c-page.test.tsx", "app/cartFitCheck.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=150).returncode
if mode == "server": fresh()
if run() != 0: sys.exit("The tests do not pass on the UNBROKEN code, so a break check would prove nothing.")
print("baseline: the tests pass on the unbroken code\n", flush=True); caught = 0
for n, (what, rel, old, new) in enumerate(BREAKS, start=1):
    if not lo <= n <= hi: continue
    path = f"{ROOT}/{rel}"; src = open(path, encoding="utf-8").read()
    if src.count(old) != 1: print(f"{n:2d}. SKIPPED (the line to break was not found exactly once): {what}"); continue
    shutil.copy(path, path + ".keep"); open(path, "w", encoding="utf-8").write(src.replace(old, new))
    try:
        if mode == "server": fresh()
        failed = run() != 0
    finally: shutil.move(path + ".keep", path)
    caught += failed; print(f"{n:2d}. {'CAUGHT ' if failed else 'MISSED!'}  {what}", flush=True)
print(f"\n{caught} of {sum(1 for i in range(1, len(BREAKS) + 1) if lo <= i <= hi)} breaks were caught")
if mode == "server": fresh()
print("code restored; the tests pass again:", "yes" if run() == 0 else "NO (investigate)")
