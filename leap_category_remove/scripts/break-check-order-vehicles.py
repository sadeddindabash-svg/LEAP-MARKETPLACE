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
HPS = "services/api/src/modules/platform-settings/homePictures.js"; HPA = "apps/admin-dashboard/src/HomePicturesSection.jsx"; HPC = "apps/admin-dashboard/src/homePictureCrop.js"
HP_SERVER = [
 ("a picture that is not exactly 600 x 600 is accepted", HPS, "if (checked.width !== PICTURE_PX || checked.height !== PICTURE_PX) return", "if (false) return"),
 ("anyone signed in (a supplier) may upload a home picture", HPS, "router.put('/:slot', requireAuth, requireRole('admin'), knownSlot,", "router.put('/:slot', requireAuth, knownSlot,"),
 ("anyone signed in may remove a home picture", HPS, "router.delete('/:slot', requireAuth, requireRole('admin'), knownSlot,", "router.delete('/:slot', requireAuth, knownSlot,"),
 ("the old picture stays on disk when it is replaced", HPS, "if (before && before !== saved.url) removeLocalImage(before);", ""),
 ("a removed picture stays on disk", HPS, "if (before) removeLocalImage(before);", ""),
 ("setting one picture wipes the other three", HPS, "const merged = { ...parseStored(rows[0].value), [slot]: url };", "const merged = { [slot]: url };"),
 ("an unknown picture name is accepted", HPS, "SLOTS.includes(req.params.slot) ? next() :", "true ? next() :"),
 ("reading the pictures needs a sign-in (the website could not show them)", HPS, "router.get('/', async (req, res, next) => {", "router.get('/', requireAuth, async (req, res, next) => {"),
 ("a damaged stored value breaks the pictures instead of reading as none", HPS, "catch { /* no pictures */ }", "catch (e) { throw e; }"),
 ("the pictures are not kept for half a minute", HPS, "res.set('Cache-Control', 'public, max-age=30');", ""),
]
HP_ADMIN = [
 ("zooming does not keep the middle of the frame in the middle", HPC, "return clampOffset({ x: frame / 2 - cx * after, y: frame / 2 - cy * after }, width, height, newZoom, frame);", "return clampOffset(offset, width, height, newZoom, frame);"),
 ("the picture can be dragged off the frame (empty space)", HPC, "return { x: clamp(offset.x, Math.min(0, frame - width * s), 0), y: clamp(offset.y, Math.min(0, frame - height * s), 0) };", "return { x: offset.x, y: offset.y };"),
 ("a picture that is too small is accepted", HPA, "if (loaded.width < MIN_SOURCE_PX || loaded.height < MIN_SOURCE_PX) {", "if (false) {"),
 ("Remove removes at once, without asking", HPA, "onClick={() => setConfirming(slot)}", "onClick={() => remove(slot)}"),
 ("the crop is saved on the wrong picture", HPA, "uploadHomePicture(getStoredToken(), crop.slot, blob)", "uploadHomePicture(getStoredToken(), 'parts', blob)"),
 ("the crop window stays open after saving", HPA, "setSaved(`Saved. The home page shows the new ${LABELS[crop.slot]} picture within about a minute.`); close();", "setSaved(`Saved. The home page shows the new ${LABELS[crop.slot]} picture within about a minute.`);"),
 ("an expired sign-in is shown as a plain error", HPA, "if (!expired(err)) setCropError(err.message);", "setCropError(err.message);"),
 ("the arrow keys move the frame the wrong way", HPA, "ArrowRight: [-KEY_STEP_PX, 0]", "ArrowRight: [KEY_STEP_PX, 0]"),
 ("the save button can be pressed twice", HPA, "<button type=\"button\" style={primary} onClick={save} disabled={saving}>", "<button type=\"button\" style={primary} onClick={save}>"),
 ("the picture is sent without the admin's sign-in", HPA, "await uploadHomePicture(getStoredToken(),", "await uploadHomePicture(null,"),
]
HP_STOREFRONT = [
 ("the home page ignores the pictures and always shows the icons", "apps/web-storefront/app/page.tsx", "{s.picture ? (", "{false ? ("),
 ("a picture tile is not 72 px", "apps/web-storefront/app/page.tsx", "<PhotoBox src={s.picture} className=\"size-[72px]\" sizes=\"72px\" />", "<PhotoBox src={s.picture} className=\"size-14\" sizes=\"56px\" />"),
 ("the Brands tile shows the Parts picture", "apps/web-storefront/app/page.tsx", "picture: pictures?.brands ?? null,", "picture: pictures?.parts ?? null,"),
 ("a server that cannot give the pictures crashes the home page", "apps/web-storefront/app/page.tsx", "picture: pictures?.countries ?? null,", "picture: pictures.countries ?? null,"),
]
HT = "services/api/src/modules/platform-settings/homeText.js"; CR = "services/api/src/modules/catalog/routes.js"; SFA = "apps/web-storefront/"
PP_SERVER = [
 ("a font that is not offered is accepted", HT, "b.font !== undefined && !FONTS.includes(b.font)", "false"),
 ("a size that is not offered is accepted", HT, "b.size !== undefined && !SIZES.includes(b.size)", "false"),
 ("a text that is too long is accepted", HT, "b[lang].trim().length > MAX_LENGTH[name]", "false"),
 ("a supplier may change the home texts", HT, "router.put('/', requireAuth, requireRole('admin'), async", "router.put('/', requireAuth, async"),
 ("reading the home texts needs a sign-in (the website could not show them)", HT, "router.get('/', async (req, res, next) => {", "router.get('/', requireAuth, async (req, res, next) => {"),
 ("a damaged stored value breaks the texts instead of reading as defaults", HT, "catch { /* all defaults */ }", "catch (e) { throw e; }"),
 ("an empty text is kept as empty text (not 'use the website's wording')", HT, "const cleanText = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);", "const cleanText = (v) => (typeof v === 'string' ? v : null);"),
 ("the sub-headline's default size is wrong", HT, "{ headline: 'large', subheadline: 'medium' }", "{ headline: 'large', subheadline: 'large' }"),
 ("the home texts are not kept for half a minute", HT, "res.set('Cache-Control', 'public, max-age=30');", ""),
 ("the same-model list includes parts that are sold out", CR, "vg.model_id = $1 AND p.id != $2 AND p.stock_quantity > 0 AND p.status = 'active'", "vg.model_id = $1 AND p.id != $2 AND p.status = 'active'"),
 ("the same-model list includes the part itself", CR, "vg.model_id = $1 AND p.id != $2 AND p.stock_quantity > 0", "vg.model_id = $1 AND $2 IS NOT NULL AND p.stock_quantity > 0"),
 ("the same-brand list repeats the parts of the same model", CR, "           WHERE vg2.model_id = $3\n         )", "           WHERE vg2.model_id = $3 AND false\n         )"),
 ("a size taken from the part is not marked approximate", CR, "sizeApprox: shipped.shipping_source === 'part'", "sizeApprox: false"),
 ("the same-model list ignores the page (every page is the first)", CR, "ORDER BY p.rating DESC NULLS LAST, p.id ASC LIMIT $3 OFFSET $4`,\n      [fitmentRows[0].model_id, req.params.id, limitNum, offset]", "ORDER BY p.rating DESC NULLS LAST, p.id ASC LIMIT $3`,\n      [fitmentRows[0].model_id, req.params.id, limitNum]"),
]
PD = SFA + "components/ProductDetails.tsx"; LR = SFA + "components/LazyProductRow.tsx"; VF = SFA + "components/VehicleFilter.tsx"; PGE = SFA + "app/products/[id]/page.tsx"; HOME = SFA + "app/page.tsx"
PP_STOREFRONT = [
 ("an approximate size is not marked", PD, 'const approx = product.sizeApprox ? ` (${t(lang, "detail_approx")})` : "";', 'const approx = "";'),
 ("'+N more cars' counts wrongly", PD, "Math.max((product.fitCarCount ?? 0) - 1, 0)", "Math.max(product.fitCarCount ?? 0, 0)"),
 ("one more car is worded as plural (\"+1 more cars\")", PD, "moreCars === 1 ? t(lang, \"detail_more_car_one\")", "false ? t(lang, \"detail_more_car_one\")"),
 ("numbers are not written cleanly (1.40 kg)", PD, "String(Number(n.toFixed(2)))", "n.toFixed(2)"),
 ("an incomplete size is shown as if it were complete", PD, "if (lengthCm != null && widthCm != null && heightCm != null)", "if (lengthCm != null)"),
 ("a part with nothing to show still draws an empty box", PD, "  if (rows.length === 0) return null;\n", ""),
 ("a row loads at once instead of when it is scrolled to", LR, 'if (typeof IntersectionObserver === "undefined") {', "if (true) {"),
 ("a row asks twice when the scroll watcher reports twice", LR, "if (started.current) return; ", ""),
 ("a row with nothing to show still draws its heading", LR, 'setState(items.some((p) => p.id !== hiddenId) ? "ready" : "empty");', 'setState("ready");'),
 ("a failed row shows nothing instead of the message and Try again", LR, 'setState("error");', 'setState("empty");'),
 ("a row ignores its limit of two more batches", LR, "maxExtraPages={maxExtraPages} gridClassName", "gridClassName"),
 ("a row starts only when it is already on screen", LR, '"500px 0px"', '"0px"'),
 ("the years are listed oldest first", VF, ".sort((x, y) => y - x)", ".sort((x, y) => x - y)"),
 ("a year covered by one generation is not applied for the buyer", VF, "if (fitting.length === 1) {", "if (false) {"),
 ("the generation question is asked even when there is only one answer", VF, "generationsForYear.length > 1", "generationsForYear.length > 0"),
 ("changing the model keeps the old year", VF, "setSelectedModelId(e.target.value); setSelectedGenerationId(\"\"); setSelectedYear(\"\");", "setSelectedModelId(e.target.value); setSelectedGenerationId(\"\");"),
 ("choosing a generation forgets the year", VF, "if (e.target.value) applyFilter(e.target.value, selectedYear);", "if (e.target.value) applyFilter(e.target.value, \"\");"),
 ("the newest row does not hide the part itself", PGE, " pageSize={8} hiddenId={product.id} />", " pageSize={8} />"),
 ("the model row is not limited to two more batches", PGE, 'source={{ kind: "sameModel", productId: product.id }} pageSize={8} maxExtraPages={2}', 'source={{ kind: "sameModel", productId: product.id }} pageSize={8}'),
 ("the details block is missing under the photos", PGE, "          <ProductDetails product={product} lang={lang} />\n", ""),
 ("the headline ignores the chosen font", HOME, "style={homeFontStyle(homeText?.headline.font)} ", ""),
 ("the headline ignores the chosen size", HOME, 'HEADLINE_SIZE_CLASS[homeText?.headline.size ?? "large"]', "HEADLINE_SIZE_CLASS.large"),
 ("the sub-headline ignores the admin's text", HOME, 'pickHomeText(homeText?.subheadline, lang, t(lang, "hero_lead"))', 't(lang, "hero_lead")'),
 ("the top bar ignores the admin's text", SFA + "components/SiteHeader.tsx", 'pickHomeText(homeText?.topBar, lang, t(lang, "util_tagline"))', 't(lang, "util_tagline")'),
 ("an Arabic page borrows the English text", SFA + "lib/homeText.ts", 'const value = lang === "ar" ? pair?.ar : pair?.en;', 'const value = (lang === "ar" ? pair?.ar : null) || pair?.en;'),
 ("the website does not know the 'sameModel' list", SFA + "lib/gridSource.ts", 'if (kind === "sameBrand" || kind === "sameModel") {', 'if (kind === "sameBrand") {'),
 ("the route serves the brand list for the model list", SFA + "app/api/products/route.ts", 'const fetchList = source.kind === "sameBrand" ? fetchSameBrand : fetchSameModel;', "const fetchList = fetchSameBrand;"),
 ("the switch label is the old one", SFA + "lib/i18n.ts", 'fits_my_car: "Parts Fit with my Car"', 'fits_my_car: "Fits my car"'),
]
HTS = "apps/admin-dashboard/src/HomeTextSection.jsx"
PP_ADMIN = [
 ("Save is always available, even with no change", HTS, "disabled={!dirty || saving}", "disabled={saving}"),
 ("Reset to default resets every block, not just its own", HTS, "setDraft((d) => ({ ...d, [name]: { ...blank(name) } }));", 'setDraft(() => ({ topBar: { ...blank("topBar") }, headline: { ...blank("headline") }, subheadline: { ...blank("subheadline") } }));'),
 ("Reset gives the sub-headline the wrong default size", HTS, 'subheadline: { en: "", ar: "", font: "default", size: "medium" } };', 'subheadline: { en: "", ar: "", font: "default", size: "large" } };'),
 ("the texts are saved without the admin's sign-in", HTS, "await saveHomeText(getStoredToken(), clean(draft))", "await saveHomeText(null, clean(draft))"),
 ("the Arabic fields read left to right", HTS, 'dir={lang === "ar" ? "rtl" : "ltr"}', 'dir="ltr"'),
 ("texts are saved with their spaces", HTS, "en: draft[name].en.trim()", "en: draft[name].en"),
 ("an expired sign-in is shown as a plain error", HTS, "if (err instanceof SessionExpiredError) onSessionExpired?.(); else setError(err.message);", "setError(err.message);"),
 ("the 'Saved' message stays after editing again", HTS, "const set = (name, key, value) => { setMessage(null);", "const set = (name, key, value) => {"),
 ("the fields have no length limit", HTS, "maxLength={MAX[name]} ", ""),
 ("the preview ignores the chosen size", HTS, "fontSize: PREVIEW_PX[name][draft[name].size]", "fontSize: 20"),
]
SP = "apps/web-storefront/app/page.tsx"
SPACING = [
 ("the space above Shop by section is back to 64 px", SP, 'px-4 pt-8 sm:px-8" aria-labelledby="home-sections"', 'px-4 pt-16 sm:px-8" aria-labelledby="home-sections"'),
 ("the space above Shop by brand is back to 64 px", SP, 'px-4 pt-8 sm:px-8" aria-labelledby="home-brands"', 'px-4 pt-16 sm:px-8" aria-labelledby="home-brands"'),
 ("the space above Newest parts is back to 64 px", SP, 'pb-4 pt-8 sm:px-8" aria-labelledby="home-newest"', 'pb-4 pt-16 sm:px-8" aria-labelledby="home-newest"'),
 ("the space under the hero (above the totals) was changed too", SP, 'px-4 pt-10 sm:px-8" aria-label="Leap Auto Parts"', 'px-4 pt-5 sm:px-8" aria-label="Leap Auto Parts"'),
 ("a margin is added between the blocks", SP, 'px-4 pt-8 sm:px-8" aria-labelledby="home-brands"', 'px-4 pt-8 mt-8 sm:px-8" aria-labelledby="home-brands"'),
]
FJ = "services/api/src/modules/platform-settings/footer.js"
FT_SERVER = [
 ("a supplier or a stranger may change the footer text", FJ, "router.put('/text', ...admin,", "router.put('/text',"),
 ("a supplier or a stranger may change the social media list", FJ, "router.put('/social', ...admin,", "router.put('/social',"),
 ("a supplier or a stranger may change a social media picture", FJ, "router.put('/social/:id/icon', ...admin,", "router.put('/social/:id/icon',"),
 ("a supplier or a stranger may change a page", FJ, "router.put('/pages/:key', ...admin, knownPage,", "router.put('/pages/:key', knownPage,"),
 ("a link that is not a web address (javascript:, mailto) is accepted", FJ, "x.protocol === 'https:' || x.protocol === 'http:'", "true"),
 ("a ninth social media icon is accepted", FJ, "if (items.length > MAX_SOCIAL)", "if (false)"),
 ("a picture of any size is accepted for an icon", FJ, "if (checked.width !== ICON_PX || checked.height !== ICON_PX)", "if (false)"),
 ("a replaced picture stays on disk", FJ, "if (old && old !== saved.url) removeLocalImage(old);", ""),
 ("a removed item's picture stays on disk", FJ, "for (const url of removedIcons) removeLocalImage(url);", ""),
 ("saving the list again loses every picture", FJ, "icon: old ? old.icon : null }", "icon: null }"),
 ("an id that does not exist claims someone else's picture", FJ, "const old = typeof it.id === 'string' ? byId.get(it.id) : null;", "const old = byId.get(it.id) || existing[0] || null;"),
 ("a page may be 600,000 characters long", FJ, "pageBody: 60000", "pageBody: 600000"),
 ("a page with only Arabic text counts as empty", FJ, "const hasContent = (p) => Boolean(p.body.en || p.body.ar);", "const hasContent = (p) => Boolean(p.body.en);"),
 ("a page has no 'last updated' date", FJ, "updatedAt: new Date().toISOString()", "updatedAt: null"),
 ("saving one page wipes the other five", FJ, "const all = normalizePages(raw); all[req.params.key]", "const all = normalizePages('{}'); all[req.params.key]"),
 ("a hidden link is shown again", FJ, "shown: l.shown !== false", "shown: true"),
 ("an unknown page name is accepted", FJ, "PAGE_KEYS.includes(req.params.key) ? next() :", "true ? next() :"),
 ("reading the footer needs a sign-in (the website could not show it)", FJ, "router.get('/', async (req, res, next) => {", "router.get('/', requireAuth, async (req, res, next) => {"),
 ("the footer is not kept for half a minute", FJ, "res.set('Cache-Control', 'public, max-age=30');\n    res.json({ text: normalizeText", "res.json({ text: normalizeText"),
 ("a damaged stored value breaks the footer instead of reading as empty", FJ, "catch { return fallback; }", "catch (e) { throw e; }"),
]
FTX = "apps/admin-dashboard/src/FooterTextSection.jsx"; SLX = "apps/admin-dashboard/src/SocialLinksSection.jsx"; LPX = "apps/admin-dashboard/src/LegalPagesSection.jsx"; PEF = "apps/admin-dashboard/src/pageEditorFormat.js"; AMD = "apps/admin-dashboard/src/miniMarkdown.js"
FT_ADMIN = [
 ("Footer text: Save is available with no change", FTX, "disabled={!dirty || saving}", "disabled={saving}"),
 ("Footer text: the Shown tick is ignored", FTX, "checked={draft.links[k].shown}", "checked={true}"),
 ("Footer text: texts are saved with their spaces", FTX, "tagline: { en: d.tagline.en.trim(), ar: d.tagline.ar.trim() }", "tagline: { en: d.tagline.en, ar: d.tagline.ar }"),
 ("Footer text: the tagline limit is wrong", FTX, "const MAX = { tagline: 160,", "const MAX = { tagline: 200,"),
 ("Footer text: saved without the admin's sign-in", FTX, "await saveFooterText(getStoredToken(),", "await saveFooterText(null,"),
 ("Footer text: an expired sign-in is a plain error", FTX, "if (err instanceof SessionExpiredError) onSessionExpired?.(); else setError(err.message);", "setError(err.message);"),
 ("Social: a ninth icon can be added", SLX, "disabled={items.length >= MAX_ITEMS}", "disabled={false}"),
 ("Social: a picture can be added before the icon is saved", SLX, "{item.id ? (", "{true ? ("),
 ("Social: a too-small picture is accepted", SLX, "if (image.width < ICON_MIN_PX || image.height < ICON_MIN_PX) {", "if (false) {"),
 ("Social: the picture goes to the wrong icon", SLX, "uploadSocialIcon(getStoredToken(), crop.id, blob)", "uploadSocialIcon(getStoredToken(), items[0].id, blob)"),
 ("Social: a picture upload throws away what was typed in other rows", SLX, "setItems((list) => list.map((i) => (i.id === crop.id ? { ...i, icon: data.icon } : i)));", "setItems(fromServer(data.social || []));"),
 ("Social: the up arrow does nothing", SLX, "[l[index - 1], l[index]] = [l[index], l[index - 1]];", ";"),
 ("Social: an icon with no name can be saved", SLX, "disabled={!dirty || saving || missingName}", "disabled={!dirty || saving}"),
 ("Social: a picture is removed without asking", SLX, "onClick={() => setConfirming(item.id)}", "onClick={() => removeIcon(item)}"),
 ("Pages: what was typed is lost when you change tab", LPX, "if (pages[active]) return; let live = true;", "let live = true;"),
 ("Pages: a page is saved under the wrong name", LPX, "savePage(getStoredToken(), active, {", "savePage(getStoredToken(), \"about\", {"),
 ("Pages: Save is available with no change", LPX, "disabled={!unsaved(active) || saving}", "disabled={saving}"),
 ("Pages: the Bold button does nothing", LPX, "onClick={() => format(bold)}", "onClick={() => format((v, s) => ({ value: v, start: s, end: s }))}"),
 ("Pages: the text has no length limit", LPX, "maxLength={MAX.body} ", ""),
 ("Pages: the preview always shows the English text", LPX, "<MiniPreview source={draft.body[lang]}", "<MiniPreview source={draft.body.en}"),
 ("Editor: a second Heading press adds a second ##", PEF, 'if (value.startsWith("## ", lineStart)) return', "if (false) return"),
 ("Editor: a bullet is added in front of an existing bullet", PEF, "(/^[-*]\\s/.test(l) ? l : `- ${l}`)", "`- ${l}`"),
 ("Preview: a link to //evil.com is allowed", AMD, "if (/^\\/(?!\\/)/.test(h)) return h;", "if (/^\\//.test(h)) return h;"),
]
SFP = "apps/web-storefront/"; FOOT = SFP + "components/SiteFooter.tsx"; FSO = SFP + "components/FooterSocial.tsx"; FCO = SFP + "lib/footerContent.ts"; LGP = SFP + "components/LegalPage.tsx"; MDT = SFP + "lib/miniMarkdown.ts"; RTX = SFP + "components/RichText.tsx"
FT_STOREFRONT = [
 ("a link the admin hid is still shown", FOOT, "if (setting && setting.shown === false) return null;", ""),
 ("a page that has text still links to the old website", FOOT, "return footer?.pages[key]", "return false"),
 ("a page link loses the language prefix", FOOT, "<Link key={key} href={`/${PAGE_SLUGS[key]}`} className={link}>{text}</Link>", "<a key={key} href={`/${PAGE_SLUGS[key]}`} className={link}>{text}</a>"),
 ("the column titles ignore the admin's wording", FOOT, "=> pickHomeText(footer?.text.titles[k], lang, t(lang, key));", "=> t(lang, key);"),
 ("the tagline ignores the admin's wording", FOOT, 'pickHomeText(footer?.text.tagline, lang, t(lang, "footer_tagline"))', 't(lang, "footer_tagline")'),
 ("an icon with no link is shown", FSO, "items.filter((i) => i.url)", "items"),
 ("a social icon opens in the same tab and can reach back to the website", FSO, 'target="_blank" rel="noopener noreferrer" ', ""),
 ("a social icon forgets noopener", FSO, 'rel="noopener noreferrer"', 'rel="noreferrer"'),
 ("the placeholder is not the Leap logo", FSO, 'src="/leap-logo.png"', 'src="/other.png"'),
 ("the year is not filled into the copyright", FCO, "value.replace(/\\{year\\}/g, String(year))", "value"),
 ("a page in one language shows nothing in the other", FCO, 'return (typeof own === "string" && own.trim() !== "" ? own : typeof other === "string" ? other : "") || "";', 'return own ?? "";'),
 ("a page with no text crashes instead of saying it is being prepared", LGP, "{page?.hasContent ? (", "{true ? ("),
 ("a page with no text can be found in search engines", LGP, "robots: page?.hasContent ? undefined : { index: false, follow: true }", "robots: undefined"),
 ("the 'last updated' date is missing", LGP, "{page.updatedAt && <p", "{false && <p"),
 ("an unsafe link (javascript:) is allowed", MDT, "  if (/^\\/(?!\\/)/.test(h)) return h;\n  return null;", "  return h;"),
 ("a link to //evil.com is allowed", MDT, "if (/^\\/(?!\\/)/.test(h)) return h;", "if (/^\\//.test(h)) return h;"),
 ("the formatter can be made slow by a page of brackets", MDT, "\\[([^\\]]{1,300})\\]\\(([^)\\s]{1,500})\\)", "\\[([^\\]]+)\\]\\(([^)\\s]+)\\)"),
 ("an outside link opens in the same tab", RTX, '{...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}', "{...{}}"),
 ("the old privacy address goes to the wrong page", SFP + "app/privecy-policy/page.tsx", '"/privacy-policy"', '"/about-us"'),
 ("the privacy address shows the wrong page", SFP + "app/privacy-policy/page.tsx", '<LegalPage pageKey="privacy" />', '<LegalPage pageKey="terms" />'),
]
CP = "services/api/src/modules/catalogPhotos/"; PA = "apps/admin-dashboard/src/"
CP_SERVER = [
 ("anyone may read the coverage", CP + "routes.js", "router.get('/coverage', ...guard,", "router.get('/coverage',"),
 ("anyone may import pictures", CP + "routes.js", "router.post('/import', ...guard,", "router.post('/import',"),
 ("anyone may undo an import", CP + "routes.js", "router.post('/batches/:id/undo', ...guard,", "router.post('/batches/:id/undo',"),
 ("anyone may change the fallback switch", CP + "routes.js", "router.put('/settings', ...guard,", "router.put('/settings',"),
 ("anyone may download the shot list", CP + "routes.js", "router.get('/shot-list.xlsx', ...guard,", "router.get('/shot-list.xlsx',"),
 ("a picture of any size is accepted", CP + "importer.js", "if (checked.width !== PHOTO_PX || checked.height !== PHOTO_PX)", "if (false)"),
 ("a real picture is always replaced", CP + "importer.js", "targets.filter((t) => replace || isPlaceholder(t.photoUrl))", "targets.filter(() => true)"),
 ("a real picture is never replaced, even when asked", CP + "importer.js", "targets.filter((t) => replace || isPlaceholder(t.photoUrl))", "targets.filter((t) => isPlaceholder(t.photoUrl))"),
 ("a part's picture is not given to its other sizes", CP + "importer.js", "return rows.map((r) => ({ kind: 'part'", "return rows.filter((r) => String(r.code).toUpperCase() === code).map((r) => ({ kind: 'part'"),
 ("the same code twice in one request is not noticed", CP + "importer.js", "if (seen.has(code))", "if (false)"),
 ("Undo restores nothing", CP + "importer.js", "AND photo_url = $3`", "AND photo_url <> $3`"),
 ("Undo overwrites a picture someone changed since", CP + "importer.js", "WHERE id = $2 AND photo_url = $3`", "WHERE id = $2 AND $3::text IS NOT NULL`"),
 ("Undo leaves the pictures on disk", CP + "importer.js", "if (rows.length === 0) removeLocalImage(url);", ""),
 ("Undo deletes a picture something else still uses", CP + "importer.js", "if (rows.length === 0) removeLocalImage(url);", "removeLocalImage(url);"),
 ("all 50 imports are kept instead of the last 5", CP + "importer.js", "const KEEP_BATCHES = 5;", "const KEEP_BATCHES = 50;"),
 ("an import sent in several requests is several imports", CP + "importer.js", "const existing = log.find((b) => b.id === batchId);", "const existing = null;"),
 ("41 pictures at a time are accepted", CP + "importer.js", "const MAX_PER_REQUEST = 40;", "const MAX_PER_REQUEST = 400;"),
 ("an odd import id is accepted", CP + "routes.js", "/^[A-Za-z0-9_-]{8,64}$/", "/.*/"),
 ("a name with _ instead of - is not understood", CP + "codes.js", ".replace(/[_\\s]+/g, '-')", ".replace(/[_\\s]+/g, '')"),
 ("the switch accepts anything", CP + "routes.js", "typeof req.body.fallback !== 'boolean'", "false"),
 ("the fallback is on even when the switch is off (sections)", CP + "fallback.js", "async function withFallbackSections(rows) {\n  if (!rows.some((r) => isPlaceholder(r.photo_url)) || !(await isOn())) return rows;", "async function withFallbackSections(rows) {\n  if (!rows.some((r) => isPlaceholder(r.photo_url))) return rows;"),
 ("the fallback uses products that are not live", CP + "fallback.js", "WHERE p.status = 'active' AND p.category = ANY($1)", "WHERE p.category = ANY($1)"),
 ("the fallback picks the WORST-rated product", CP + "fallback.js", "ORDER BY p.category, p.rating DESC NULLS LAST, p.id ASC", "ORDER BY p.category, p.rating ASC NULLS LAST, p.id ASC"),
 ("the fallback replaces a REAL picture too", CP + "fallback.js", "isPlaceholder(r.photo_url) && photo.has(r.id) ? {", "photo.has(r.id) ? {"),
 ("the fallback replaces a real PART picture too", CP + "fallback.js", "isPlaceholder(r.photo_url) && url ? { ...r, photo_url: url } : r", "url ? { ...r, photo_url: url } : r"),
 ("the fallback takes the LAST photo of a product", CP + "fallback.js", "ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1", "ORDER BY pi.sort_order DESC, pi.id ASC LIMIT 1"),
 ("'missing only' lists everything", CP + "shotList.js", "return missingOnly ? rows.filter((r) => !r.hasPhoto) : rows;", "return rows;"),
 ("a shared picture counts as done when only ONE size has it", CP + "shotList.js", "hasPhoto: g.members.every((m) => m.hasPhoto)", "hasPhoto: g.members.some((m) => m.hasPhoto)"),
 ("every part is priority 2", CP + "shotList.js", "tier: i < TOP_PARTS && g.products > 0 ? 2 : 3", "tier: 2"),
 ("a placeholder counts as a real picture", CP + "coverage.js", "hasPhoto: !isPlaceholder(p.photo_url), photoUrl: p.photo_url, products", "hasPhoto: true, photoUrl: p.photo_url, products"),
 ("products that are not live are counted", CP + "coverage.js", "AND p.status = 'active') AS products", ") AS products"),
]
PPRE = PA + "photoPrep.js"; PNL = PA + "CatalogPhotosPanel.jsx"
CP_ADMIN = [
 ("a picture under 400 px is accepted", PPRE, "export const MIN_SOURCE_PX = 400;", "export const MIN_SOURCE_PX = 300;"),
 ("batches are 50 big", PPRE, "export const BATCH_SIZE = 20;", "export const BATCH_SIZE = 50;"),
 ("the same code twice is not noticed", PPRE, "if (seen.has(code)) { out.status", "if (false) { out.status"),
 ("a real picture is always shown as replaced", PPRE, "const change = targets.filter((t) => replace || !t.hasPhoto);", "const change = targets.filter(() => true);"),
 ("sizes of one part are not grouped", PPRE, "byGroup.get(parts.get(code).group)", "[parts.get(code)]"),
 ("an unreadable file is not flagged", PPRE, "if (it.error) {", "if (false) {"),
 ("a name that is not a code is not flagged", PPRE, "if (!code) { out.status", "if (false) { out.status"),
 ("a name with _ is not understood", PPRE, '.replace(/[_\\s]+/g, "-")', '.replace(/[_\\s]+/g, "")'),
 ("a picture is sent under its own file name, not its code", PNL, "name: `${i.code}.jpg`", "name: i.file"),
 ("every batch has a different import id (one Undo cannot undo all)", PNL, "uploadPhotos(getStoredToken(), batchId,", "uploadPhotos(getStoredToken(), newBatchId(),"),
 ("the replace choice is not sent", PNL, "blob: i.blob })), replace); results.push", "blob: i.blob })), false); results.push"),
 ("pictures with problems are sent too", PNL, "const toSend = items.filter((i) => WILL_SAVE.includes(i.status));", "const toSend = items;"),
 ("Undo does not ask first", PNL, "onClick={() => setConfirmUndo(b.id)}", "onClick={() => undo(b.id)}"),
 ("an import that was undone can be undone again", PNL, "{!b.undone && (confirmUndo", "{true && (confirmUndo"),
 ("Import is available with nothing to save", PNL, "disabled={counts.willSave === 0}", "disabled={false}"),
 ("the switch always looks on", PNL, "checked={cov.fallback}", "checked={true}"),
 ("the number of pictures still to make ignores the sections", PNL, "cov.sections.filter((s) => !s.hasPhoto).length +", "0 +"),
 ("the two shot list buttons are swapped", PNL, "onClick={() => shot(false)}", "onClick={() => shot(true)}"),
 ("the replace tick changes nothing in the preview", PNL, "cov, replace).map((c, i)", "cov, false).map((c, i)"),
 ("the Photos tab is missing", PA + "CategoriesTabs.jsx", '["edit", "Edit details"], ["photos", "Photos"]]', '["edit", "Edit details"]]'),
]
VPS = "services/api/src/modules/vehicleImport/"; VPU = "services/api/src/modules/uploads/unusedPictures.js"; VPA = "apps/admin-dashboard/src/"
VP_SERVER = [
 ("'use the pictures of this file' does nothing in skip mode", VPS + "plan.js", "} else if (replacePictures && d.picture) {", "} else if (false && d.picture) {"),
 ("the picture-only update also changes other details of the version", VPS + "plan.js", "'UPDATE vehicle_versions SET photo_url = $1 WHERE id = $2', [saved.url, existing.id]", "'UPDATE vehicle_versions SET photo_url = $1, name_ar = $3 WHERE id = $2', [saved.url, existing.id, d.version.ar]"),
 ("the old picture is forgotten, so it stays on the server (skip mode)", VPS + "plan.js", "if (existing.photo_url) oldUrls.push(existing.photo_url);\n          await q.query('UPDATE vehicle_versions SET photo_url = $1", "await q.query('UPDATE vehicle_versions SET photo_url = $1"),
 ("the old picture is forgotten, so it stays on the server (update mode)", VPS + "plan.js", "if (apply && photoUrl !== existing.photo_url && existing.photo_url) oldUrls.push(existing.photo_url);", ""),
 ("the preview saves pictures and writes", VPS + "plan.js", "        if (apply) {\n          const saved = await saveImage(d.picture.buffer, d.picture.mime); savedUrls.push(saved.url);", "        if (true) {\n          const saved = await saveImage(d.picture.buffer, d.picture.mime); savedUrls.push(saved.url);"),
 ("the pictures that were replaced are never removed", VPS + "routes.js", "oldPicturesRemoved = await removeIfUnused(db, oldUrls);", "oldPicturesRemoved = 0;"),
 ("the pictures are always replaced, even without asking", VPS + "routes.js", "['1', 'true'].includes(String((req.body || {}).replacePictures))", "true"),
 ("anyone may remove the unused pictures without confirming", VPS + "routes.js", "req.body.confirm !== true", "false"),
 ("anyone may look at the unused pictures", VPS + "routes.js", "router.get('/unused-pictures', ...guard,", "router.get('/unused-pictures',"),
 ("anyone may remove the unused pictures", VPS + "routes.js", "router.post('/unused-pictures/remove', ...guard,", "router.post('/unused-pictures/remove',"),
 ("a picture that is still used is removed", VPU, "if (used.has(name)) continue;", ""),
 ("pictures younger than a day are removed", VPU, "now - f.modified >= minAgeMs", "true"),
 ("any file in the folder counts as a picture (placeholders, logos)", VPU, "const HASHED = /^[0-9a-f]{32}\\.(png|jpe?g|webp)$/;", "const HASHED = /.+/;"),
 ("pictures kept in a setting or in a list are not noticed as used", VPU, "c.data_type IN ('text', 'character varying', 'json', 'jsonb')", "c.data_type IN ('json')"),
 ("the used pictures of the vehicle tables are not noticed", VPU, "AND c.table_name NOT LIKE '%audit%'", "AND c.table_name NOT LIKE '%vehicle%' AND c.table_name NOT LIKE '%audit%'"),
]
VP_ADMIN = [
 ("the choice is off at first", VPA + "VehicleImportPanel.jsx", "const [replacePictures, setReplacePictures] = useState(true);", "const [replacePictures, setReplacePictures] = useState(false);"),
 ("the choice is never sent as on", VPA + "auth.js", 'formData.append("replacePictures", replacePictures ? "1" : "0");', 'formData.append("replacePictures", "0");'),
 ("the import forgets the choice", VPA + "VehicleImportPanel.jsx", "commitVehicleImport(getStoredToken(), file, mode, replacePictures)", "commitVehicleImport(getStoredToken(), file, mode)"),
 ("changing the choice does not re-check the file", VPA + "VehicleImportPanel.jsx", 'if (file && phase === "checked") runCheck(file, mode, next); };', "};"),
 ("the 'pictures replace old ones' tile shows when none do", VPA + "VehicleImportPanel.jsx", "{s.picturesReplaced > 0 && tile(", "{true && tile("),
 ("the choice stays unticked for the next file", VPA + "VehicleImportPanel.jsx", 'setMode("skip"); setReplacePictures(true); };', 'setMode("skip"); };'),
 ("the choice can be changed while updating", VPA + "VehicleImportPanel.jsx", 'disabled={mode === "update"}', "disabled={false}"),
 ("one old picture is described in the plural", VPA + "VehicleImportPanel.jsx", 'plural(result.oldPicturesRemoved, "old picture was", "old pictures were")', 'plural(result.oldPicturesRemoved, "old pictures were", "old pictures were")'),
 ("the removed message shows when none were removed", VPA + "VehicleImportPanel.jsx", "{result.oldPicturesRemoved > 0 &&", "{true &&"),
 ("the cleanup removes without asking", VPA + "UnusedPicturesCard.jsx", 'onClick={() => setPhase("asking")}', "onClick={remove}"),
 ("the cleanup button can be pressed twice", VPA + "UnusedPicturesCard.jsx", 'disabled={phase === "removing"} onClick={remove}', "disabled={false} onClick={remove}"),
 ("a failed removal loses the question", VPA + "UnusedPicturesCard.jsx", 'catch (err) { setPhase("asking"); fail(err); }', 'catch (err) { setPhase("found"); fail(err); }'),
 ("the removal is sent without the confirm", VPA + "auth.js", "JSON.stringify({ confirm: true })", "JSON.stringify({})"),
 ("looking sends a POST (which removes)", VPA + "auth.js", 'fetchUnusedPictures = (token) => unusedPicturesCall("GET"', 'fetchUnusedPictures = (token) => unusedPicturesCall("POST"'),
]
CRV = "services/api/src/modules/catalogImport/"; CRA = "apps/admin-dashboard/src/"
CR_SERVER = [
 ("a part a product uses is removed", CRV + "replace.js", "if (n === 0 && !other) removedParts.push(", "if (true) removedParts.push("),
 ("a category a product uses is removed", CRV + "replace.js", "if (n === 0 && count(partsLeft, c.id) === 0 && !other) removedCategories.push(", "if (true) removedCategories.push("),
 ("a product that was ordered is deleted", CRV + "replace.js", "const doomed = alsoProducts ? using.filter((p) => !isHeld(p)) : [];", "const doomed = alsoProducts ? using : [];"),
 ("the products choice does nothing", CRV + "replace.js", "const doomed = alsoProducts ? using.filter((p) => !isHeld(p)) : [];", "const doomed = [];"),
 ("sub-categories the sheet does not list stay (in a category the sheet has)", CRV + "replace.js", "const oldParts = parts.filter((p) => !keep.partIds.has(p.id));", "const oldParts = parts.filter((p) => !keep.categoryIds.has(p.category_id));"),
 ("the cart lines of a deleted product are left, so the import fails", CRV + "replace.js", "'WITH carts AS (DELETE FROM cart_items WHERE product_id = ANY($1)) DELETE FROM products pr", "'DELETE FROM products pr"),
 ("the pictures of what is removed are not noticed", CRV + "replace.js", "const photoUrls = [...removed.categories.map((id) => plan.photos.categories.get(id)), ...removed.parts.map((id) => plan.photos.parts.get(id))].filter(Boolean);", "const photoUrls = [];"),
 ("the import removes without the typed sentence", CRV + "routes.js", "if (removeOthers && String((req.body || {}).confirm || '').trim() !== REPLACE_PHRASE)", "if (false)"),
 ("the typed sentence is accepted in small letters", CRV + "routes.js", "String((req.body || {}).confirm || '').trim() !== REPLACE_PHRASE", "String((req.body || {}).confirm || '').trim().toUpperCase() !== REPLACE_PHRASE"),
 ("the CHECK removes what it lists", CRV + "routes.js", "await planRemoval(db, run.keep, { alsoProducts }) : null;", "await (async () => { const p = await planRemoval(db, run.keep, { alsoProducts }); await applyRemoval(db, p); return p; })() : null;"),
 ("an import that only removes is not allowed to go ahead", CRV + "routes.js", "ready: !blocking && (toImport > 0 || removing > 0)", "ready: !blocking && toImport > 0"),
 ("an import with nothing new but something old to remove is called 'nothing to import'", CRV + "routes.js", "nothingToImport: !blocking && toImport === 0 && removing === 0", "nothingToImport: !blocking && toImport === 0"),
 ("the products choice is ignored by the server", CRV + "routes.js", "alsoProducts: flag(req, 'alsoProducts')", "alsoProducts: false"),
 ("every import removes the old catalog, even when not asked", CRV + "routes.js", "removeOthers: flag(req, 'removeOthers')", "removeOthers: true"),
  ("a table that points at a product is not looked for (a quote request would be offered for deletion)", CRV + "replace.js", "const pointedAt = await blockers(q, 'products', using.map((p) => p.id), { ignore: ['cart_items'] });", "const pointedAt = new Map();"),
 ("a table that points at a sub-category is not looked for", CRV + "replace.js", "const partBlockers = await blockers(q, 'category_parts', oldParts.map((p) => p.id));", "const partBlockers = new Map();"),
 ("a table that points at a category is not looked for", CRV + "replace.js", "const catBlockers = await blockers(q, 'product_categories', oldCats.map((c) => c.id), { ignore: ['category_parts'] });", "const catBlockers = new Map();"),
 ("a refusal by the database fails the whole import (no safety net)", CRV + "replace.js", "if (err.code === '23503') return -1; throw err;", "throw err;"),
 ("a refusal on the whole lot is not tried one by one", CRV + "replace.js", "if (out === -1) { out = [];", "if (out === -1) { throw new Error('refused'); out = [];"),
 ("the answer keeps the counts of what was PLANNED, not of what really happened", CRV + "replace.js", "plan.counts = { categories: plan.categories.length, parts: plan.parts.length, products: plan.products.length };", ""),
 ("the pictures of the removed items stay on the server", CRV + "routes.js", "picturesRemoved = await removeIfUnused(db, [...applied.photoUrls, ...applied.imageUrls]);", "picturesRemoved = 0;"),
 ("parts the sheet matches are not noticed, so they are removed", CRV + "plan.js", "      keepPartIds.add(existing.id);\n", ""),
 ("parts the sheet creates are not noticed, so they are removed", CRV + "plan.js", "    keepPartIds.add(id);\n", ""),
 ("no category of the sheet is noticed", CRV + "plan.js", "keep: { categoryIds: new Set([...state.values()].filter((s) => s.id).map((s) => s.id)), partIds: keepPartIds }", "keep: { categoryIds: new Set(), partIds: keepPartIds }"),
]
RO = CRA + "CatalogReplaceOptions.jsx"; RP = CRA + "CatalogImportPanel.jsx"
CR_ADMIN = [
 ("the choice is on at first", RO, "checked={replace.on} onChange", "checked={true} onChange"),
 ("the typed sentence is not sent", CRA + "catalogAdminApi.js", 'formData.append("confirm", replace.confirm || "");', 'formData.append("confirm", "");'),
 ("the products choice is never sent as on", CRA + "catalogAdminApi.js", 'replace.alsoProducts ? "1" : "0"', '"0"'),
 ("the import button works without the typed sentence", RP, 'disabled={!preview.ready || phase === "importing" || (replace.on && replace.confirm !== REPLACE_PHRASE)} onClick', 'disabled={!preview.ready || phase === "importing"} onClick'),
 ("the sentence to type is not the server's", RO, 'export const REPLACE_PHRASE = "REPLACE CATALOG";', 'export const REPLACE_PHRASE = "REPLACE";'),
 ("changing the choice does not check the file again", RP, 'if (file && phase === "checked" && ("on" in patch || "alsoProducts" in patch)) runCheck(file, mode, next); };', "};"),
 ("the choice stays on for the next file", RP, 'setUndone(null); setReplace({ on: false, alsoProducts: false, confirm: "" }); };', "setUndone(null); };"),
 ("products are counted when the choice is off", RO, "{replace.alsoProducts && <>, <b>", "{true && <>, <b>"),
 ("a long list shows 50 first", RO, "const SHOWN = 12;", "const SHOWN = 50;"),
 ("the downloaded list says staying items are removed", RO, 'stays: "stays", reason: c.reason }))', 'stays: "removed", reason: c.reason }))'),
 ("the 'cannot be undone' warning is gone", RO, "<b>This cannot be undone.</b>", "<b>It is fine.</b>"),
 ("the result shows a removal line for an ordinary import", RP, "{result.removal && <div", "{true && <div"),
 ("the headings of the box are swapped", RO, '{none ? "Nothing old to remove" : "Will be removed (it is not in this sheet)"}', '{none ? "Will be removed (it is not in this sheet)" : "Nothing old to remove"}'),
 ("the banner is hidden", RP, "{preview.removal && <CatalogRemovalBanner removal={preview.removal} />}", ""),
 ("the banner shows when nothing would be removed", RO, "const total = counts.categories + counts.parts + counts.products; if (total === 0) return null;", ""),
 ("the banner button goes nowhere", RO, 'document.getElementById("catalog-removal-box")?.scrollIntoView?.', 'document.getElementById("nothing")?.scrollIntoView?.'),
 ("the typed sentence is kept when the products choice changes", RO, "onChange({ alsoProducts: e.target.checked, confirm: \"\" })", "onChange({ alsoProducts: e.target.checked })"),
]
FW = "apps/web-storefront/"
FF_STOREFRONT = [
 ("the font address loses display=swap (text invisible until the font arrives)", FW + "lib/homeFontLinks.ts", "&display=swap`;", "`;"),
 ("a page that uses no chosen font still links to Google", FW + "lib/homeFontLinks.ts", "if (used.length === 0) return null;", ""),
 ("a font used twice is asked for twice", FW + "lib/homeFontLinks.ts", "const used = [...new Set(", "const used = [...("),
 ("the website's Arabic font is no longer the fallback", FW + "lib/homeFonts.ts", ", var(--font-arabic), sans-serif", ", sans-serif"),
 ("the component shows a link even when there is nothing to link", FW + "components/HomeFontLink.tsx", "return href ? <link rel=\"stylesheet\" href={href} /> : null;", "return <link rel=\"stylesheet\" href={href ?? \"\"} />;"),
 ("the home page forgets to link the fonts", FW + "app/page.tsx", "          <HomeFontLink fonts={[homeText?.headline.font, homeText?.subheadline.font]} />\n", ""),
 ("a home font is downloaded at build time again (what stopped the storefront)", FW + "lib/homeFonts.ts", "import type { HomeFont } from \"./homeText\";", "import { Inter } from \"next/font/google\";\nimport type { HomeFont } from \"./homeText\";"),
 ("the page loses the font variables", FW + "app/layout.tsx", 'className="h-full antialiased" style={SITE_FONT_VARS}>', 'className="h-full antialiased">'),
 ("the page forgets to link the website's fonts", FW + "app/layout.tsx", '        <link rel="stylesheet" href={SITE_FONTS_HREF} />\n', ""),
 ("the website's fonts lose display=swap", FW + "lib/siteFonts.ts", "JetBrains+Mono:wght@500;600;700&display=swap", "JetBrains+Mono:wght@500;600;700"),
 ("the Arabic font variable names another font", FW + "lib/siteFonts.ts", '"--font-arabic": \'"IBM Plex Sans Arabic"\'', '"--font-arabic": \'"Cairo"\''),
 ("the layout downloads a font at build time again", FW + "app/layout.tsx", 'import { SITE_FONTS_HREF, SITE_FONT_VARS } from "@/lib/siteFonts";', 'import { Outfit } from "next/font/google";\nimport { SITE_FONTS_HREF, SITE_FONT_VARS } from "@/lib/siteFonts";'),
 ("the default font gets a style", FW + "lib/homeFonts.ts", "if (!font || font === \"default\" || !(font in GOOGLE_FONT)) return undefined;", "if (!font || !(font in GOOGLE_FONT)) return { fontFamily: \"Outfit\" };"),
]
CLN = "services/api/src/modules/catalogImport/cleanup.js"
CL_SERVER = [
 ("a table that points at a product is not looked for", CLN, "const pointedAt = await blockers(client, 'products', users.map((u) => u.id), { ignore: ['cart_items'] });", "const pointedAt = new Map();"),
 ("a refusal by the database fails the whole cleanup (no safety net)", CLN, "if (err.code === '23503') return -1; throw err;", "throw err;"),
 ("a refusal on the whole lot is not tried one by one", CLN, "const done = []; for (const id of ids) {", "const done = []; for (const id of []) {"),
 ("a table that points at a sub-category is not looked for", CLN, "const partHeld = await blockers(client, 'category_parts', candParts.map((p) => p.id));", "const partHeld = new Map();"),
 ("the cart lines of a deleted product are left (the product then cannot go)", CLN, "'WITH carts AS (DELETE FROM cart_items WHERE product_id = ANY($1)) DELETE FROM products pr", "'DELETE FROM products pr"),
 ("the answer lists products as removed that the database kept", CLN, "removed.products = deletable.filter((u) => gone.has(u.id)).map(describe);", "removed.products = deletable.map(describe);"),
 ("a product that a quote request points at is called an ordered one in the answer", CLN, "const t = holders(u); return t.size === 1 && t.has('order_line_items') ?", "const t = holders(u); return true ?"),
]
PDS = "services/api/src/modules/catalog/productDelete.js"; PDA = "apps/admin-dashboard/src/"
PD_SERVER = [
 ("anyone may delete products", PDS, "router.post('/delete', ...guard,", "router.post('/delete',"),
 ("anyone may check products", PDS, "router.post('/delete-check', ...guard,", "router.post('/delete-check',"),
 ("several products are deleted without the typed sentence", PDS, "if (ids.length > 1 && String(confirm || '').trim() !== PHRASE)", "if (false)"),
 ("one product is deleted without the confirmation", PDS, "if (ids.length === 1 && confirm !== true && String(confirm || '').trim() !== PHRASE)", "if (false)"),
 ("a quote request (or any table pointing at a product) is not looked for", PDS, "const pointedAt = await blockers(q, 'products', found.map((p) => p.id), { ignore: ['cart_items'] });", "const pointedAt = new Map();"),
 ("a refusal by the database fails the whole deletion (no safety net)", PDS, "if (err.code === '23503') return -1; throw err;", "throw err;"),
 ("a refusal on the whole lot is not tried one by one", PDS, "for (const id of toDelete) {", "for (const id of []) {"),
 ("the cart lines of a deleted product are left (the product then cannot go)", PDS, "'WITH carts AS (DELETE FROM cart_items WHERE product_id = ANY($1)) DELETE FROM products pr", "'DELETE FROM products pr"),
 ("the picture files of deleted products stay on the server", PDS, ".filter((r) => goneSet.has(r.product_id)).map((r) => r.url)", ".filter((r) => false).map((r) => r.url)"),
 ("more than 200 products at once are accepted", PDS, "const MAX_IDS = 200;", "const MAX_IDS = 2000;"),
 ("the same id twice counts twice", PDS, "[...new Set(body.ids.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()))]", "body.ids.filter((x) => typeof x === 'string' && x.trim() !== '').map((x) => x.trim())"),
 ("a product that is not there is not reported", PDS, "missing: ids.filter((id) => !there.has(id))", "missing: []"),
 ("the deletion is not in the audit log", PDS, "if (deleted.length > 0) await logAdminAction(", "if (false) await logAdminAction("),
 ("the hidden list shows live products", "services/api/src/modules/catalog/routes.js", "let where = req.query.status === 'hidden' ?", "let where = false ?"),
 ("send to review puts the product straight back on sale", PDS, "SET status = 'translating' WHERE id = ANY($1)", "SET status = 'active' WHERE id = ANY($1)"),
 ("send to review also changes live products", PDS, "WHERE id = ANY($1) AND status = 'inactive' RETURNING id, name", "WHERE id = ANY($1) RETURNING id, name"),
 ("anyone may send products to review", PDS, "router.post('/send-to-review', ...guard,", "router.post('/send-to-review',"),
 ("sending to review is not in the audit log", PDS, "if (rows.length > 0) await logAdminAction(req, 'products_sent_to_review'", "if (false) await logAdminAction(req, 'products_sent_to_review'"),
 ("what goes with the products is counted wrongly", PDS, "(counts.get(label) || 0) + n)", "(counts.get(label) || 0) + 1)"),
]
PDD = PDA + "ProductDeleteDialog.jsx"
PD_ADMIN = [
 ("several products need no typed sentence", PDD, "const needsPhrase = deletable.length > 1;", "const needsPhrase = false;"),
 ("the Delete button works without the typed sentence", PDD, "(!needsPhrase || typed === DELETE_PHRASE)", "true"),
 ("the window sends every chosen product, not only those that can go", PDD, "deleteProducts(getStoredToken(), deletable.map((p) => p.id), needsPhrase ? typed : true)", "deleteProducts(getStoredToken(), ids, needsPhrase ? typed : true)"),
 ("'Hide them instead' also hides ones that are already hidden", PDD, 'const targets = held.filter((p) => p.status !== "inactive"); setHiding(true);', "const targets = held; setHiding(true);"),
 ("'Hide them instead' approves instead of hiding", PDD, 'action: "reject"', 'action: "approve"'),
 ("hiding does not refresh the list", PDD, 'if (ok > 0) onChanged?.("hidden");', ""),
 ("deleting does not refresh the list", PDD, 'if (r.deleted.length > 0) onChanged?.("deleted");', ""),
 ("the 'cannot be undone' warning is gone", PDD, "This cannot be undone.</div>", "</div>"),
 ("ticking a row also opens the product", PDD, " onClick={(e) => e.stopPropagation()} />;", " />;"),
 ("the header tick never unticks the page", PDD, "const all = ids.length > 0 && ids.every((id) => s.has(id));", "const all = false;"),
 ("the header tick looks ticked on an empty page", PDD, "checked={ids.length > 0 && ids.every((id) => picked.has(id))}", "checked={ids.every((id) => picked.has(id))}"),
 ("the sentence to type is not the server's", PDD, 'export const DELETE_PHRASE = "DELETE PRODUCTS";', 'export const DELETE_PHRASE = "DELETE";'),
 ("the Live and Hidden switch reacts when the same one is pressed again", PDD, "onClick={() => view !== id && onChange(id)}", "onClick={() => onChange(id)}"),
 ("'Send back to review' is offered in the Live list too", PDD, "{onReview && <button", "{true && <button"),
 ("the review window sends nothing", PDD, "sendProductsToReview(getStoredToken(), ids)", "sendProductsToReview(getStoredToken(), [])"),
 ("the list is not refreshed after products are sent to review", PDD, 'if (r.sent.length > 0) onChanged?.("reviewed");', ""),
 ("the list never asks for the hidden products", PDA + "auth.js", 'if (status) params.set("status", status);', ""),
 ("send to review calls the wrong route", PDA + "auth.js", 'productDeleteCall("send-to-review"', 'productDeleteCall("delete-check"'),
 ("deleting from a product's own page leaves you on the page of a product that no longer exists", PDD, "if (wasDeleted) onBack();", ""),
 ("hiding a product from its own page throws you out to the list", PDD, 'if (kind === "deleted") setWasDeleted(true);', "setWasDeleted(true);"),
 ("the product page's window is opened for nothing", PDD, "ids={[productId]}", "ids={[]}"),
 ("the check asks for the wrong thing (a deletion)", PDA + "auth.js", 'checkProductDelete = (token, ids) => productDeleteCall("delete-check"', 'checkProductDelete = (token, ids) => productDeleteCall("delete"'),
]
CXS = "services/api/src/modules/catalog/categoryRemove.js"; CXA = "apps/admin-dashboard/src/"
CX_SERVER = [
 ("anyone may see what uses a category", CXS, "router.get('/:id/in-use', ...guard,", "router.get('/:id/in-use',"),
 ("anyone may remove a category with its products", CXS, "router.post('/:id/remove', ...guard,", "router.post('/:id/remove',"),
 ("the category is removed without the typed sentence", CXS, "if (String((req.body || {}).confirm || '').trim() !== PHRASE)", "if (false)"),
 ("the category is deleted even though products had to stay", CXS, "if (stay.length > 0) categoryReason =", "if (false) categoryReason ="),
 ("the category is deleted while a sub-category had to stay", CXS, "else if (partsStay.length > 0) categoryReason =", "else if (false) categoryReason ="),
 ("a sub-category that a product still uses is deleted", CXS, "AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en))) RETURNING p.id", "RETURNING p.id"),
 ("the sub-categories are never deleted", CXS, "const free = parts.filter((p) => !partHeld.has(p.id)).map((p) => p.id);", "const free = [];"),
 ("a table that points at a sub-category is not looked for", CXS, "const partHeld = await blockers(client, 'category_parts', parts.map((p) => p.id));", "const partHeld = new Map();"),
 ("hidden products are counted as live", CXS, "inactive: 'hidden'", "inactive: 'live'"),
 ("the picture files of the deleted products stay", CXS, ".filter((r) => gone.has(r.product_id)).map((r) => r.url)", ".filter(() => false).map((r) => r.url)"),
 ("the removal is not in the audit log", CXS, "await logAdminAction(req, 'category_removed_with_products'", "void (req, 'category_removed_with_products'"),
 ("the refusal no longer says why (inUse)", "services/api/src/modules/catalog/routes.js", "real products still reference it', inUse: true });", "real products still reference it' });"),
]
CD = CXA + "CategoryInUseDialog.jsx"
CX_ADMIN = [
 ("the sentence to type is not the server's", CD, 'export const REMOVE_PHRASE = "DELETE CATEGORY";', 'export const REMOVE_PHRASE = "DELETE";'),
 ("the button works without the typed sentence", CD, "disabled={typed !== REMOVE_PHRASE || phase === \"removing\"}", "disabled={phase === \"removing\"}"),
 ("the page behind is refreshed even when nothing was removed", CD, "if (r.removedProducts > 0 || r.removedSubCategories > 0 || r.categoryRemoved) onChanged?.();", "onChanged?.();"),
 ("the result says the category was deleted when it stays", CD, 'result.categoryRemoved ? "The category was deleted." : "The category stays."', 'result.categoryRemoved ? "The category stays." : "The category was deleted."'),
 ("the window does not say the category cannot be fully deleted while products must stay", CD, "<b>So this category cannot be deleted completely while they exist.</b>", ""),
 ("the window does not explain that hidden products and drafts still count", CD, "{hidden > 0 && <span", "{false && <span"),
 ("the button label does not change when some products must stay", CD, "info.heldTotal > 0 ? `Delete the", "false ? `Delete the"),
 ("the refusal loses its details (the screen cannot know products are in the way)", CXA + "auth.js", "error.payload = data; throw error; }          // payload.inUse = products still use it", "throw error; }"),
 ("the removal sends no sentence", CXA + "auth.js", 'removeCategoryWithProducts = (token, id, confirm) => categoryCall("POST", id, "remove", token, { confirm });', 'removeCategoryWithProducts = (token, id, confirm) => categoryCall("POST", id, "remove", token, {});'),
]
mode = sys.argv[1] if len(sys.argv) > 1 else "server"; BREAKS = {"cxserver": CX_SERVER, "cxadmin": CX_ADMIN, "pdserver": PD_SERVER, "pdadmin": PD_ADMIN, "clserver": CL_SERVER, "ffstorefront": FF_STOREFRONT, "crserver": CR_SERVER, "cradmin": CR_ADMIN, "vpserver": VP_SERVER, "vpadmin": VP_ADMIN, "cpserver": CP_SERVER, "cpadmin": CP_ADMIN, "ftserver": FT_SERVER, "ftadmin": FT_ADMIN, "ftstorefront": FT_STOREFRONT, "spacing": SPACING, "ppserver": PP_SERVER, "ppstorefront": PP_STOREFRONT, "ppadmin": PP_ADMIN, "hpserver": HP_SERVER, "hpadmin": HP_ADMIN, "hpstorefront": HP_STOREFRONT, "server": SERVER, "screens": SCREENS, "storefront": STOREFRONT, "uistorefront": UI_STOREFRONT, "uiserver": UI_SERVER, "ui2storefront": UI2_STOREFRONT}[mode]
lo, hi = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1, len(BREAKS))
def fresh():
    subprocess.run(["su", "postgres", "-c", "psql -q -c 'DROP DATABASE IF EXISTS leap_catalog_import_test' -c \"CREATE DATABASE leap_catalog_import_test TEMPLATE leap_marketplace_dev OWNER leap_dev\""], check=True, capture_output=True)
def run():
    if mode == "uiserver": return subprocess.run(["node", "--test", "test/siteStats.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "spacing": return subprocess.run(["npx", "vitest", "run", "app/homeSpacing.test.tsx", "app/homeText.test.tsx", "app/homePictures.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=200).returncode
    if mode == "ftserver": return subprocess.run(["node", "--test", "test/footer.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "ftadmin": return subprocess.run(["npx", "vitest", "run", "src/FooterTextSection.test.jsx", "src/SocialLinksSection.test.jsx", "src/LegalPagesSection.test.jsx", "src/pageEditorFormat.test.js", "src/miniMarkdown.test.js"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=250).returncode
    if mode == "ftstorefront": return subprocess.run(["npx", "vitest", "run", "components/SiteFooter.test.tsx", "components/LegalPage.test.tsx", "components/RichText.test.tsx", "lib/miniMarkdown.test.ts", "lib/footerContent.test.ts", "lib/miniMarkdownContract.test.ts", "app/legalPages.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=250).returncode
    if mode == "cpserver": return subprocess.run(["node", "--test", "test/catalogPhotos.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "cpadmin": return subprocess.run(["npx", "vitest", "run", "src/CatalogPhotosPanel.test.jsx", "src/photoPrep.test.js", "src/CategoriesPhotosTab.test.jsx"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=250).returncode
    if mode == "vpserver": return subprocess.run(["node", "--test", "test/vehiclePictures.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "vpadmin": return subprocess.run(["npx", "vitest", "run", "src/VehicleImportPictures.test.jsx", "src/UnusedPicturesCard.test.jsx", "src/unusedPicturesApi.test.js", "src/VehicleImportPanel.test.jsx"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=250).returncode
    if mode == "crserver": return subprocess.run(["node", "--test", "test/catalogReplace.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=250).returncode
    if mode == "cradmin": return subprocess.run(["npx", "vitest", "run", "src/CatalogReplace.test.jsx", "src/CatalogImportPanel.test.jsx"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=250).returncode
    if mode == "ffstorefront": return subprocess.run(["npx", "vitest", "run", "lib/homeFontLinks.test.ts", "components/HomeFontLink.test.tsx", "app/homeFontLink.test.tsx", "app/homeText.test.tsx", "lib/siteFonts.test.ts", "app/layoutFonts.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=250).returncode
    if mode == "clserver": return subprocess.run(["node", "--test", "test/catalogCleanup.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "pdserver": return subprocess.run(["node", "--test", "test/productDelete.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "pdadmin": return subprocess.run(["npx", "vitest", "run", "src/ProductDeleteDialog.test.jsx", "src/productDeleteApi.test.js"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=250).returncode
    if mode == "cxserver": return subprocess.run(["node", "--test", "test/categoryRemove.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "cxadmin": return subprocess.run(["npx", "vitest", "run", "src/CategoryInUseDialog.test.jsx", "src/productDeleteApi.test.js"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=250).returncode
    if mode == "ppserver": return subprocess.run(["node", "--test", "test/homeText.test.js", "test/productPage.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "ppadmin": return subprocess.run(["npx", "vitest", "run", "src/HomeTextSection.test.jsx"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=200).returncode
    if mode == "ppstorefront": return subprocess.run(["npx", "vitest", "run", "components/ProductDetails.test.tsx", "components/LazyProductRow.test.tsx", "components/VehicleFilterOrder.test.tsx", "components/FitsMyCarLabel.test.tsx", "app/stage1c-page.test.tsx", "app/homeText.test.tsx", "components/SiteHeaderTopBar.test.tsx", "lib/gridSourceModel.test.ts", "lib/homeText.test.ts", "app/api/products/routeSameModel.test.ts"], cwd=SF, capture_output=True, text=True, timeout=250).returncode
    if mode == "hpserver": return subprocess.run(["node", "--test", "test/homePictures.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "hpadmin": return subprocess.run(["npx", "vitest", "run", "src/HomePicturesSection.test.jsx", "src/homePictureCrop.test.js"], cwd=f"{ROOT}/apps/admin-dashboard", capture_output=True, text=True, timeout=200).returncode
    if mode == "hpstorefront": return subprocess.run(["npx", "vitest", "run", "app/homePictures.test.tsx", "app/pages-i18n.test.tsx", "app/homeLazy.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=200).returncode
    if mode == "ui2storefront": return subprocess.run(["npx", "vitest", "run", "components/BackToTop.test.tsx", "components/NavDropdownRoot.test.tsx", "components/FitsMyCarHeight.test.tsx", "components/FindToolsColumns.test.tsx", "components/SiteHeaderMenu.test.tsx", "app/layoutBackToTop.test.tsx", "app/searchLayout.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=200).returncode
    if mode == "uistorefront": return subprocess.run(["npx", "vitest", "run", "components/TileRow.test.tsx", "app/pages-i18n.test.tsx", "app/searchLayout.test.tsx", "app/homeLazy.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=200).returncode
    if mode == "server": return subprocess.run(["node", "--test", "test/orderVehicles.test.js", "test/productCars.test.js", "test/orderVehiclesReplacement.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
    if mode == "screens": return subprocess.run(["npx", "vitest", "run", "src/OrderVehicle.test.jsx", "src/OrderVehicleFlow.test.jsx"], cwd=SP, capture_output=True, text=True, timeout=150).returncode
    return subprocess.run(["npx", "vitest", "run", "components/FitCheck.test.tsx", "app/stage1c-page.test.tsx", "app/cartFitCheck.test.tsx"], cwd=SF, capture_output=True, text=True, timeout=150).returncode
if mode in ("server", "uiserver", "hpserver", "ppserver", "ftserver", "cpserver", "vpserver", "crserver", "clserver", "pdserver", "cxserver"): fresh()
if run() != 0: sys.exit("The tests do not pass on the UNBROKEN code, so a break check would prove nothing.")
print("baseline: the tests pass on the unbroken code\n", flush=True); caught = 0
for n, (what, rel, old, new) in enumerate(BREAKS, start=1):
    if not lo <= n <= hi: continue
    path = f"{ROOT}/{rel}"; src = open(path, encoding="utf-8").read()
    if src.count(old) != 1: print(f"{n:2d}. SKIPPED (the line to break was not found exactly once): {what}"); continue
    shutil.copy(path, path + ".keep"); open(path, "w", encoding="utf-8").write(src.replace(old, new))
    try:
        if mode in ("server", "uiserver", "hpserver", "ppserver", "ftserver", "cpserver", "vpserver", "crserver", "clserver", "pdserver", "cxserver"): fresh()
        failed = run() != 0
    finally: shutil.move(path + ".keep", path)
    caught += failed; print(f"{n:2d}. {'CAUGHT ' if failed else 'MISSED!'}  {what}", flush=True)
print(f"\n{caught} of {sum(1 for i in range(1, len(BREAKS) + 1) if lo <= i <= hi)} breaks were caught")
if mode in ("server", "uiserver", "hpserver", "ppserver", "ftserver", "cpserver", "vpserver", "crserver", "clserver", "pdserver", "cxserver"): fresh()
print("code restored; the tests pass again:", "yes" if run() == 0 else "NO (investigate)")
