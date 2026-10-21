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
mode = sys.argv[1] if len(sys.argv) > 1 else "server"; BREAKS = {"ppserver": PP_SERVER, "ppstorefront": PP_STOREFRONT, "ppadmin": PP_ADMIN, "hpserver": HP_SERVER, "hpadmin": HP_ADMIN, "hpstorefront": HP_STOREFRONT, "server": SERVER, "screens": SCREENS, "storefront": STOREFRONT, "uistorefront": UI_STOREFRONT, "uiserver": UI_SERVER, "ui2storefront": UI2_STOREFRONT}[mode]
lo, hi = (int(sys.argv[2]), int(sys.argv[3])) if len(sys.argv) > 3 else (1, len(BREAKS))
def fresh():
    subprocess.run(["su", "postgres", "-c", "psql -q -c 'DROP DATABASE IF EXISTS leap_catalog_import_test' -c \"CREATE DATABASE leap_catalog_import_test TEMPLATE leap_marketplace_dev OWNER leap_dev\""], check=True, capture_output=True)
def run():
    if mode == "uiserver": return subprocess.run(["node", "--test", "test/siteStats.test.js"], cwd=API, env=ENV, capture_output=True, text=True, timeout=200).returncode
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
if mode in ("server", "uiserver", "hpserver", "ppserver"): fresh()
if run() != 0: sys.exit("The tests do not pass on the UNBROKEN code, so a break check would prove nothing.")
print("baseline: the tests pass on the unbroken code\n", flush=True); caught = 0
for n, (what, rel, old, new) in enumerate(BREAKS, start=1):
    if not lo <= n <= hi: continue
    path = f"{ROOT}/{rel}"; src = open(path, encoding="utf-8").read()
    if src.count(old) != 1: print(f"{n:2d}. SKIPPED (the line to break was not found exactly once): {what}"); continue
    shutil.copy(path, path + ".keep"); open(path, "w", encoding="utf-8").write(src.replace(old, new))
    try:
        if mode in ("server", "uiserver", "hpserver", "ppserver"): fresh()
        failed = run() != 0
    finally: shutil.move(path + ".keep", path)
    caught += failed; print(f"{n:2d}. {'CAUGHT ' if failed else 'MISSED!'}  {what}", flush=True)
print(f"\n{caught} of {sum(1 for i in range(1, len(BREAKS) + 1) if lo <= i <= hi)} breaks were caught")
if mode in ("server", "uiserver", "hpserver", "ppserver"): fresh()
print("code restored; the tests pass again:", "yes" if run() == 0 else "NO (investigate)")
