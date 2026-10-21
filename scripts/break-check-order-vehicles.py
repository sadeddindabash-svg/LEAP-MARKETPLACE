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
 ("the part photo is not square", "apps/supplier-portal/src/OrderVehicle.jsx", "<Photo url={vehicle.partPhotoUrl} width={96} height={96}", "<Photo url={vehicle.partPhotoUrl} width={96} height={72}"),
 ("the small photos in the list are not square", "apps/supplier-portal/src/OrderVehicle.jsx", "<Photo url={first.partPhotoUrl} width={32} height={32}", "<Photo url={first.partPhotoUrl} width={32} height={24}"),
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
TILE = "apps/web-storefront/components/TileRow.tsx"; HOME = "apps/web-storefront/app/page.tsx"; SEARCH = "apps/web-storefront/app/search/page.tsx"
UI_STOREFRONT = [
 ("a row shows ALL the tiles (no More tile, no one-row rule)", TILE, "const shown = fits || open ? tiles.length : columns - 1;", "const shown = tiles.length;"),
 ("the More tile has no room in the row (it wraps to a second row)", TILE, "const shown = fits || open ? tiles.length : columns - 1;", "const shown = fits || open ? tiles.length : columns;"),
 ("the tiles that are not shown are removed from the page (a search engine no longer reads them)", TILE, "{tiles.map((tile, i) => <li key={i} hidden={i >= shown}>{tile}</li>)}", "{tiles.slice(0, shown).map((tile, i) => <li key={i}>{tile}</li>)}"),
 ("the More tile never says Show fewer", TILE, "{open ? fewerLabel : moreLabel}", "{moreLabel}"),
 ("the More tile does not tell a screen reader whether it is open", TILE, "aria-expanded={open} ", ""),
 ("the totals are the length of a fetched list again", HOME, "{ icon: \"parts\", n: totals.parts,", "{ icon: \"parts\", n: products.length,"),
 ("a missing total crashes the home page instead of leaving the row out", HOME, "const stats = totals ? [", "const stats = true ? ["),
 ("the See all parts link is back", HOME, "{t(lang, \"newest_parts\")}</h2>", "{t(lang, \"newest_parts\")}</h2><Link href=\"/search\">{t(lang, \"see_all_parts\")}</Link>"),
 ("a brand tile has no name", HOME, "{pickName(lang, b.name, b.nameAr)}</span>", "</span>"),
 ("the newest parts stop after two more pages", HOME, "total={null} pageSize={NEWEST_PAGE_SIZE} gridClassName", "total={null} pageSize={NEWEST_PAGE_SIZE} maxExtraPages={2} gridClassName"),
 ("the products page is back to three columns", SEARCH, " md:grid-cols-3 lg:grid-cols-4\"", " md:grid-cols-3\""),
 ("the section chip keeps the section when it is cleared", SEARCH, "    const params = new URLSearchParams();\n    if (q) params.set(\"q\", q);\n    if (generationId) params.set(\"generationId\", generationId);", "    const params = new URLSearchParams();\n    if (category) params.set(\"category\", category);\n    if (q) params.set(\"q\", q);\n    if (generationId) params.set(\"generationId\", generationId);"),
 ("the section chip forgets the vehicle when it is cleared", SEARCH, "    if (q) params.set(\"q\", q);\n    if (generationId) params.set(\"generationId\", generationId);\n    if (year) params.set(\"year\", year);\n    const qs = params.toString();\n    return `/search${qs ? `?${qs}` : \"\"}`;\n  })();", "    if (q) params.set(\"q\", q);\n    const qs = params.toString();\n    return `/search${qs ? `?${qs}` : \"\"}`;\n  })();"),
 ("the section chip is not shown", SEARCH, "{sectionName && (", "{false && ("),
]
UI_SERVER = [
 ("the parts total counts parts that are not active", "services/api/src/modules/siteStats/stats.js", "\"SELECT count(*) AS n FROM products WHERE status = 'active'\"", "\"SELECT count(*) AS n FROM products\""),
 ("the countries total counts a market on compliance hold", "services/api/src/modules/siteStats/stats.js", "LAUNCH_MARKETS.filter((m) => !COMPLIANCE_HOLD_COUNTRY_CODES.has(m.countryCode)).length", "LAUNCH_MARKETS.length"),
 ("the totals are not kept for a minute", "services/api/src/modules/catalog/routes.js", "res.set('Cache-Control', 'public, max-age=60');", ""),
 ("the models total counts brands", "services/api/src/modules/siteStats/stats.js", "'SELECT count(*) AS n FROM vehicle_models'", "'SELECT count(*) AS n FROM vehicle_brands'"),
]
BTT = "apps/web-storefront/components/BackToTop.tsx"; FT = "apps/web-storefront/components/FindTools.tsx"; HDR = "apps/web-storefront/components/SiteHeader.tsx"
UI2_STOREFRONT = [
 ("the back-to-top button is always shown, even at the top", BTT, "const update = () => setVisible(window.scrollY > SHOW_AFTER_PX);", "const update = () => setVisible(true);"),
 ("the back-to-top button appears after only a little scrolling", BTT, "const SHOW_AFTER_PX = 400;", "const SHOW_AFTER_PX = 0;"),
 ("the back-to-top button ignores a device that asks for less motion", BTT, "behavior: reduce ? \"auto\" : \"smooth\"", "behavior: \"smooth\""),
 ("the back-to-top button is on the left even in English (not the end side)", BTT, " end-6 ", " left-6 "),
 ("the back-to-top button has no Arabic label", BTT, "LABEL[lang] ?? LABEL.en", "LABEL.en"),
 ("the back-to-top button keeps listening after the page is left", BTT, "return () => window.removeEventListener(\"scroll\", update);", "return () => {};"),
 ("pressing the back-to-top button does nothing", BTT, "window.scrollTo({ top: 0, behavior: reduce ? \"auto\" : \"smooth\" });", ""),
 ("the root layout has no back-to-top button", "apps/web-storefront/app/layout.tsx", "\n                  <BackToTop />", ""),
 ("a menu ignores the positioning it is given", "apps/web-storefront/components/NavDropdown.tsx", "className={`group ${rootClassName}`}", "className=\"group relative\""),
 ("the Sections menu is back to two columns on a wide screen", HDR, "shadow-lg sm:grid-cols-3 lg:grid-cols-4", "shadow-lg sm:grid-cols-2"),
 ("the Sections menu is placed against its own button again (it can run off the screen)", HDR, "\n            rootClassName=\"\"", ""),
 ("find a part: the sections are back to three columns", FT, "<ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4\">\n            {categories.map((c) => (", "<ul className=\"grid gap-3 sm:grid-cols-3\">\n            {categories.map((c) => ("),
 ("find a part: the parts are back to three columns", FT, "<ul className=\"grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4\">\n              {parts.map((p) => (", "<ul className=\"grid gap-3 sm:grid-cols-3\">\n              {parts.map((p) => ("),
 ("the strip's boxes are not stretched to the same height", SEARCH, "lg:flex-row lg:items-stretch", "lg:flex-row lg:items-start"),
 ("the Fits my car switch is not as tall as the My vehicle card", "apps/web-storefront/components/FitsMyCarToggle.tsx", "flex h-full w-full items-center", "flex w-full items-center"),
 ("the My vehicle card is not as tall as the Fits my car switch", "apps/web-storefront/components/VehicleFilter.tsx", "className=\"h-full rounded-lg", "className=\"rounded-lg"),
]
mode = sys.argv[1] if len(sys.argv) > 1 else "server"; BREAKS = {"server": SERVER, "screens": SCREENS, "storefront": STOREFRONT, "uistorefront": UI_STOREFRONT, "uiserver": UI_SERVER, "ui2storefront": UI2_STOREFRONT}[mode]
lo, hi = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1, len(BREAKS))
def fresh():
    subprocess.run(["su", "postgres", "-c", "psql -q -c 'DROP DATABASE IF EXISTS leap_catalog_import_test' -c \"CREATE DATABASE leap_catalog_import_test TEMPLATE leap_marketplace_dev OWNER leap_dev\""], check=True, capture_output=True)
def run():
    if mode == "uiserver": return subprocess.run(["node", "--test", "test/siteStats.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "ui2storefront": return subprocess.run(["npx", "vitest", "run", "components/BackToTop.test.tsx", "components/NavDropdownRoot.test.tsx", "components/FitsMyCarHeight.test.tsx", "components/FindToolsColumns.test.tsx", "components/SiteHeaderMenu.test.tsx", "app/layoutBackToTop.test.tsx", "app/searchLayout.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=200).returncode
    if mode == "uistorefront": return subprocess.run(["npx", "vitest", "run", "components/TileRow.test.tsx", "app/pages-i18n.test.tsx", "app/searchLayout.test.tsx", "app/homeLazy.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=200).returncode
    if mode == "server": return subprocess.run(["node", "--test", "test/orderVehicles.test.js", "test/productCars.test.js", "test/orderVehiclesReplacement.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "screens": return subprocess.run(["npx", "vitest", "run", "src/OrderVehicle.test.jsx", "src/OrderVehicleFlow.test.jsx"], cwd=SP, capture_output=True, text=True, timeout=150).returncode
    return subprocess.run(["npx", "vitest", "run", "components/FitCheck.test.tsx", "app/stage1c-page.test.tsx", "app/cartFitCheck.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=150).returncode
if mode in ("server", "uiserver"): fresh()
if run() != 0: sys.exit("The tests do not pass on the UNBROKEN code, so a break check would prove nothing.")
print("baseline: the tests pass on the unbroken code\n", flush=True); caught = 0
for n, (what, rel, old, new) in enumerate(BREAKS, start=1):
    if not lo <= n <= hi: continue
    path = f"{ROOT}/{rel}"; src = open(path, encoding="utf-8").read()
    if src.count(old) != 1: print(f"{n:2d}. SKIPPED (the line to break was not found exactly once): {what}"); continue
    shutil.copy(path, path + ".keep"); open(path, "w", encoding="utf-8").write(src.replace(old, new))
    try:
        if mode in ("server", "uiserver"): fresh()
        failed = run() != 0
    finally: shutil.move(path + ".keep", path)
    caught += failed; print(f"{n:2d}. {'CAUGHT ' if failed else 'MISSED!'}  {what}", flush=True)
print(f"\n{caught} of {sum(1 for i in range(1, len(BREAKS) + 1) if lo <= i <= hi)} breaks were caught")
if mode in ("server", "uiserver"): fresh()
print("code restored; the tests pass again:", "yes" if run() == 0 else "NO (investigate)")
