const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { calculateBuyerPriceUsd } = require('../pricing/engine');
const { resolveDestinationIsoCode, calculateDeliveryDays } = require('../deliveryEstimate/engine');
const { ALLOWED_POSITIONS, MIN_PRODUCT_PHOTOS, validateNameLength } = require('../shared/productValidation');
const { logAdminAction } = require('../audit/helpers');
const { moveItem } = require('../../lib/reorder');

/**
 * Catalog module — products, categories, translations.
 * Corresponds to SRS BUY-020–025 (buyer-facing browsing/search) and
 * SUP-010–015 (supplier-side product management).
 *
 * Backed by a real PostgreSQL database (see db/migrations/001_init.sql) —
 * data now survives a server restart, unlike the earlier in-memory version.
 */
const router = express.Router();

// Resolves which language's name/description a buyer sees, masking away
// the underlying name_ar/description_ar columns behind a single clean
// name/description field in the OUTPUT — the mobile app doesn't need to
// know which column was used, just "give me the product in my chosen
// language." Falls back to the English fields if Arabic is somehow
// missing (shouldn't happen for a live listing, since both are now
// mandatory to approve — see migration 012 — but defensive regardless).
// Deliberately never includes name_zh/description_zh here at all — a
// buyer should never see the untranslated Chinese original, full stop.
// Real, confirmed fix for a reported bug: a product could go live
// with genuine, untranslated Chinese text still sitting in its own
// real "English"/"Arabic" name, because the real moderation endpoints
// only ever checked that nameEn/nameAr were non-empty -- never that
// they were actually written in the right real language, rather than
// the original Chinese submission simply carried over unedited. A
// real CJK Unicode range check can't verify a translation is GOOD,
// but it can catch this exact real mistake before it ever reaches a
// buyer.
const CJK_REGEX = /[\u4e00-\u9fff]/;
function containsChineseCharacters(text) {
  return typeof text === 'string' && CJK_REGEX.test(text);
}

function resolveLanguage(row, lang) {
  if (lang === 'ar' && row.name_ar) {
    return { name: row.name_ar, description: row.description_ar || row.description };
  }
  return { name: row.name, description: row.description };
}

// Buyer-facing DTO. Deliberately does NOT include supplier identity
// (name, id, anything) — buyers should never see who the supplier is;
// that's platform-internal information. Also deliberately does NOT
// include name_zh/description_zh (see resolveLanguage above) — only the
// resolved, approved translation for the requested language.
//
// `price` here is a PLACEHOLDER, overwritten by attachBuyerPrice below
// — never the raw `row.price` (which is the supplier's RMB cost, not
// what a buyer should ever see directly). Computing it requires a real
// async call to the pricing engine, so it's split into a separate step
// rather than done inline here.
function toBuyerProductDto(row, lang) {
  const { name, description } = resolveLanguage(row, lang);
  return {
    id: row.id,
    name,
    description,
    category: row.category,
    part: row.part,
    position: row.position,
    oemNumber: row.oem_number,
    currencyCode: 'USD', // confirmed: buyer-facing price is always USD for now
    rating: row.rating != null ? Number(row.rating) : null,
    reviewCount: row.review_count,
    stockQuantity: row.stock_quantity,
    estimatedDeliveryDays: null, // placeholder, overwritten by attachDeliveryEstimate below -- see its own comment
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    lengthCm: row.length_cm === null ? null : Number(row.length_cm),
    widthCm: row.width_cm === null ? null : Number(row.width_cm),
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
    status: row.status,
  };
}

// Computes the REAL, LIVE buyer-facing USD price from the supplier's RMB
// cost (row.price) and the product's real shipping dimensions — see
// services/api/src/modules/pricing/engine.js for the full calculation.
// This is why product prices reflect a fee/FX-rate change immediately
// (confirmed as the wanted behavior), rather than a price computed once
// and stored.
//
// TRANSITION HANDLING, real and deliberate: products submitted BEFORE
// this feature existed (this project's own seed data, e.g. p1/p4/p9)
// are priced directly in USD, not RMB — running that USD amount through
// an RMB->USD equation would silently produce nonsense (treating $34.90
// as if it were ¥34.90). Those legacy rows pass through with their
// existing price/currency unchanged; only real RMB-priced products (the
// only kind submitted going forward — see the supplier module's
// currencyCode lock) go through the real equation.
async function attachBuyerPrice(dto, row) {
  // Real, previously-internal-only price snapshot (#59) -- exposes
  // the same real last_known_buyer_price_usd already recorded by the
  // scheduled price-drop check (migration 038), letting the mobile
  // app show a genuine "price dropped" comparison using real,
  // already-existing data, not a fabricated price history.
  const lastKnownPrice = row.last_known_buyer_price_usd === null ? null : Number(row.last_known_buyer_price_usd);
  if (row.currency_code !== 'CNY') {
    return { ...dto, price: Number(row.price), currencyCode: row.currency_code, lastKnownPrice };
  }
  const result = await calculateBuyerPriceUsd({
    supplierCostCny: Number(row.price),
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    lengthCm: row.length_cm === null ? null : Number(row.length_cm),
    widthCm: row.width_cm === null ? null : Number(row.width_cm),
    heightCm: row.height_cm === null ? null : Number(row.height_cm),
  });
  return { ...dto, price: result.buyerPriceUsd, lastKnownPrice };
}

async function attachBuyerImages(dto, productId) {
  const { rows: images } = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order', [productId]);
  return { ...dto, images: images.map((i) => i.url) };
}

/**
 * Real, anonymous supplier signals (#73, #74) -- exposes only the
 * real `verification_status` (as a plain boolean, #73) and real
 * `country` (as `shipsFromCountry`, #74), never the supplier's own
 * real name or any other identifying detail. Preserves this
 * platform's own deliberate supplier-anonymization design confirmed
 * directly elsewhere in this file (every real buyer-facing product
 * query already never selects `suppliers.name` at all) -- this is
 * genuinely new logistics/trust information, not a real identity
 * leak.
 */
async function attachSupplierSignals(dto, supplierId) {
  if (!supplierId) return { ...dto, isVerifiedSeller: false, shipsFromCountry: null, shipsFromCountryAr: null };
  const { rows } = await db.query('SELECT verification_status, country, country_ar FROM suppliers WHERE id = $1', [supplierId]);
  if (rows.length === 0) return { ...dto, isVerifiedSeller: false, shipsFromCountry: null, shipsFromCountryAr: null };
  return { ...dto, isVerifiedSeller: rows[0].verification_status === 'verified', shipsFromCountry: rows[0].country, shipsFromCountryAr: rows[0].country_ar };
}

// Real, confirmed replacement for the previous manual, supplier-typed
// delivery estimate -- confirmed with the person through several
// rounds of design discussion before building. Reuses
// dto.shipsFromCountry (already set by attachSupplierSignals right
// before this is always called) rather than a duplicate real
// supplier lookup. destinationIsoCode is resolved ONCE per real
// request (not per product) by the caller, via
// resolveDestinationIsoCode(req) -- see this module's own call sites.
async function attachDeliveryEstimate(dto, destinationIsoCode) {
  const days = await calculateDeliveryDays({
    weightKg: dto.weightKg,
    lengthCm: dto.lengthCm,
    widthCm: dto.widthCm,
    heightCm: dto.heightCm,
    warehouseCountry: dto.shipsFromCountry,
    destinationIsoCode,
  });
  return { ...dto, estimatedDeliveryDays: days };
}

// Real Brand/Model/Year for the product page, resolved from the
// structured fitment cascade (migration 010). A product can technically
// have multiple fitment entries (fits several vehicle configurations);
// this shows the FIRST one as the primary display, matching a simple
// flat "Brand: / Model: / Year:" product-page layout. If multi-fitment
// products become common enough that buyers need to see the full list,
// that's a real follow-up, not something to overbuild here on a guess.
async function attachPrimaryFitment(dto, productId, lang) {
  const { rows } = await db.query(
    `SELECT vb.name AS brand, vb.name_ar AS brand_ar, vb.photo_url AS brand_logo_url, vm.name AS model, vm.name_ar AS model_ar, pfe.year
     FROM product_fitment_entries pfe
     JOIN vehicle_generations vg ON vg.id = pfe.generation_id
     JOIN vehicle_models vm ON vm.id = vg.model_id
     JOIN vehicle_brands vb ON vb.id = vm.brand_id
     WHERE pfe.product_id = $1
     ORDER BY pfe.id ASC LIMIT 1`,
    [productId]
  );
  const primary = rows[0] || null;
  const brandName = lang === 'ar' && primary?.brand_ar ? primary.brand_ar : primary?.brand || null;
  const modelName = lang === 'ar' && primary?.model_ar ? primary.model_ar : primary?.model || null;
  return { ...dto, brand: brandName, brandLogoUrl: primary?.brand_logo_url || null, model: modelName, year: primary?.year || null };
}

/**
 * Real fix for a real, confirmed gap: products.part is stored as
 * plain English text (migration 015 -- validated against
 * category_parts.name_en at submission, but deliberately never made
 * a foreign key, "to avoid a large blast-radius change"). This means
 * it was never resolved back to Arabic at read time even though
 * category_parts.name_ar already exists and already has its own real
 * admin-editable field -- confirmed directly with the person as
 * exactly why Technical Specifications' own real Part Name row showed
 * English even in Arabic mode. Falls back to the original real
 * English text if no matching category_parts row exists for this
 * product's own category, or if that row has no real Arabic name set
 * yet (this will still happen for any of the 160 real existing parts
 * missing one until an admin fills them in -- a real data-completeness
 * gap, not a real code bug, once this fix is in place).
 */
async function attachPartTranslation(dto, row, lang) {
  if (lang !== 'ar' || !row.part) return dto;
  const { rows } = await db.query('SELECT name_ar FROM category_parts WHERE category_id = $1 AND name_en = $2 LIMIT 1', [row.category, row.part]);
  if (rows.length > 0 && rows[0].name_ar) {
    return { ...dto, part: rows[0].name_ar };
  }
  return dto;
}

// GET /catalog/products?category=brake&part=Front+Brake+Disc&vehicleId=v1&search=bmw+brake&sort=newest&lang=en|ar
// Real, shared search-matching logic -- extracted so both the real
// GET /products endpoint below and the real saved-searches scheduled
// check (services/api/src/modules/savedSearches/check.js) run the
// EXACT same real matching rules, rather than two versions that could
// quietly drift apart over time. Returns real product IDs only
// (lightweight -- sufficient for saved-search diffing, which never
// needs full DTOs); GET /products still does its own DTO-building
// with these IDs' underlying rows.
function buildProductMatchQuery({ category, part, vehicleId, search, generationId, year }) {
  const conditions = [];
  const params = [];
  let sql = `SELECT p.* FROM products p`;
  if (vehicleId) {
    sql += ` JOIN product_fitment pf ON pf.product_id = p.id AND pf.vehicle_id = $${params.length + 1}`;
    params.push(vehicleId);
  }
  conditions.push(`p.status = 'active'`);
  if (category) {
    conditions.push(`p.category = $${params.length + 1}`);
    params.push(category);
  }
  if (part) {
    conditions.push(`p.part = $${params.length + 1}`);
    params.push(part);
  }
  // Real Brand -> Model -> Generation(Year) filter (new) -- matches
  // against product_fitment_entries, the structured cascade a supplier
  // actually submits real fitment claims against (migration 010).
  // Deliberately NOT reusing the vehicleId/product_fitment join above --
  // that flat table is never written to anywhere in this codebase
  // (confirmed directly, not assumed): every real product's fitment
  // lives only in product_fitment_entries. EXISTS, not a JOIN, since one
  // product can have multiple fitment entries and a JOIN here would
  // duplicate result rows (same reasoning as the search clause below).
  // `year` is optional and only meaningful alongside generationId -- a
  // generation spans a real year range, and a supplier's fitment entry
  // records the specific year(s) they confirmed, not just the
  // generation as a whole.
  if (generationId) {
    const genIdx = params.length + 1;
    params.push(generationId);
    if (year) {
      const yearIdx = params.length + 1;
      params.push(Number(year));
      conditions.push(
        `EXISTS (SELECT 1 FROM product_fitment_entries pfe2 WHERE pfe2.product_id = p.id AND pfe2.generation_id = $${genIdx} AND pfe2.year = $${yearIdx})`
      );
    } else {
      conditions.push(
        `EXISTS (SELECT 1 FROM product_fitment_entries pfe2 WHERE pfe2.product_id = p.id AND pfe2.generation_id = $${genIdx})`
      );
    }
  }
  if (search && search.trim()) {
    const words = search.trim().split(/\s+/).slice(0, 8);
    for (const word of words) {
      const idx = params.length + 1;
      // REAL BUG FOUND AND FIXED HERE, via direct testing: a real
      // shared numeric substring between two otherwise-unrelated real
      // products (e.g. two coincidentally similar-looking SKU-style
      // suffixes) inflates trigram similarity well past the real
      // threshold, even though the actual real words are completely
      // different -- confirmed directly (0.696 similarity from a
      // shared 13-digit suffix alone). A real typo is a letters
      // phenomenon; a real numeric/SKU-style term already gets real,
      // correct exact matching via the ILIKE checks below and
      // genuinely doesn't need fuzzy tolerance layered on top.
      const isLettersOnly = /^[a-zA-Z]+$/.test(word);
      const fuzzyClause = isLettersOnly ? `OR word_similarity($${idx + 1}, p.name) > 0.3\n          ` : '';
      conditions.push(
        `(p.name ILIKE $${idx} OR p.name_ar ILIKE $${idx} OR p.part ILIKE $${idx} OR p.oem_number ILIKE $${idx} OR p.category ILIKE $${idx}
          ${fuzzyClause}OR EXISTS (
            SELECT 1 FROM product_fitment_entries pfe
            JOIN vehicle_generations vg ON vg.id = pfe.generation_id
            JOIN vehicle_models vm ON vm.id = vg.model_id
            JOIN vehicle_brands vb ON vb.id = vm.brand_id
            WHERE pfe.product_id = p.id AND (vb.name ILIKE $${idx} OR vm.name ILIKE $${idx})
          ))`
      );
      if (isLettersOnly) {
        params.push(`%${word}%`, word);
      } else {
        params.push(`%${word}%`);
      }
    }
  }
  if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
  return { sql, params };
}

router.get('/products', async (req, res, next) => {
  try {
    const { category, part, vehicleId, search, sort, lang, generationId, year, minPrice, maxPrice, maxDeliveryDays, page, limit } = req.query;
    const { sql: baseSql, params } = buildProductMatchQuery({ category, part, vehicleId, search, generationId, year });
    let sql = baseSql;

    // Real search query logging (new) -- the foundation for real,
    // genuinely computed trending searches (see the new
    // GET /trending-searches below), not fabricated example terms.
    // Only real, non-trivial text searches count (>= 3 chars,
    // matching the same real minimum length the mobile app's own
    // search-as-you-type debounce already uses) -- a 1-2 character
    // fragment from someone still typing isn't a real completed
    // search worth counting toward what's genuinely trending.
    // Fire-and-forget, matching the same real pattern already
    // established for email/push: a real logging failure must never
    // affect the real search results being returned right now.
    if (typeof search === 'string' && search.trim().length >= 3) {
      db.query('INSERT INTO search_log (query, user_id) VALUES ($1, $2)', [search.trim(), null]).catch((err) => {
        console.error('[search-log] Failed to log a real search query:', err.message);
      });
    }

    // Real, explicit ordering -- this endpoint previously had NO
    // ORDER BY at all (whatever order Postgres happened to return was
    // incidental, not a real guarantee). "newest" is a real, confirmed
    // filter option on the home feed; the default (no sort param)
    // stays unordered-by-date for now, matching prior behavior for
    // category/search browsing where recency isn't the point.
    // Deliberately NOT handling sort=price_asc/price_desc here in SQL --
    // see below for why.
    if (sort === 'newest') sql += ' ORDER BY p.created_at DESC';

    const { rows } = await db.query(sql, params);
    const destinationIsoCode = await resolveDestinationIsoCode(req);
    let dtos = await Promise.all(rows.map(async (r) => {
      let dto = toBuyerProductDto(r, lang);
      dto = await attachBuyerImages(dto, r.id);
      dto = await attachPrimaryFitment(dto, r.id, lang);
      dto = await attachPartTranslation(dto, r, lang);
      dto = await attachBuyerPrice(dto, r);
      dto = await attachSupplierSignals(dto, r.supplier_id);
      dto = await attachDeliveryEstimate(dto, destinationIsoCode);
      return dto;
    }));

    // Real price range filter + price sort -- deliberately applied
    // HERE, in application code, after attachBuyerPrice runs, not as SQL
    // WHERE/ORDER BY clauses. Buyer-facing price is NOT a raw column: a
    // CNY-priced product's real buyer price is computed via the pricing
    // engine's currency conversion + fee calculation (see
    // attachBuyerPrice above), so `p.price` in the database is often the
    // supplier's own CNY cost, not what a buyer actually sees or should
    // be filtered/sorted by.
    if (minPrice !== undefined) {
      const min = Number(minPrice);
      dtos = dtos.filter((d) => d.price >= min);
    }
    if (maxPrice !== undefined) {
      const max = Number(maxPrice);
      dtos = dtos.filter((d) => d.price <= max);
    }
    // Real ships-within-X-days filter (#10) -- estimatedDeliveryDays is
    // now a real, calculated value (see attachDeliveryEstimate above,
    // already run on every DTO in the .map() block above this point),
    // not a raw stored column.
    if (maxDeliveryDays !== undefined) {
      const maxDays = Number(maxDeliveryDays);
      dtos = dtos.filter((d) => d.estimatedDeliveryDays <= maxDays);
    }
    if (sort === 'price_asc') dtos.sort((a, b) => a.price - b.price);
    else if (sort === 'price_desc') dtos.sort((a, b) => b.price - a.price);

    // Real pagination (new), deliberately opt-in and fully backward
    // compatible: this endpoint previously had none at all (see the
    // real gap this closes -- growing to 100+ real products this
    // session alone made every existing caller fetch the ENTIRE
    // catalog on every request). Applied as a FINAL slice, after the
    // price filter/sort above -- pagination at the SQL level would
    // paginate BEFORE that filtering, since buyer price isn't a raw
    // column, giving genuinely wrong pages (e.g. page 1 could show
    // fewer than the real page size if some of that page's raw rows
    // get filtered out afterward). The real total count (after
    // filtering, before slicing) is exposed via a response header
    // rather than changing the response body's shape -- every
    // existing caller (mobile, web-storefront's own non-paginated
    // calls, admin dashboard) still gets back a bare array exactly as
    // before when it doesn't ask for a page; only a caller that
    // explicitly passes page/limit gets a real, correctly-sliced page.
    const totalCount = dtos.length;
    res.set('X-Total-Count', String(totalCount));
    if (page !== undefined || limit !== undefined) {
      const limitNum = Math.min(Math.max(Number(limit) || 24, 1), 100);
      const pageNum = Math.max(Number(page) || 1, 1);
      const start = (pageNum - 1) * limitNum;
      dtos = dtos.slice(start, start + limitNum);
    }

    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const { lang } = req.query;
    const { rows } = await db.query(`SELECT p.* FROM products p WHERE p.id = $1`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });

    const fitmentResult = await db.query('SELECT vehicle_id FROM product_fitment WHERE product_id = $1', [req.params.id]);
    let dto = toBuyerProductDto(rows[0], lang);
    dto = await attachBuyerImages(dto, req.params.id);
    dto = await attachPrimaryFitment(dto, req.params.id, lang);
    dto = await attachPartTranslation(dto, rows[0], lang);
    dto = await attachBuyerPrice(dto, rows[0]);
    dto = await attachSupplierSignals(dto, rows[0].supplier_id);
    dto = await attachDeliveryEstimate(dto, await resolveDestinationIsoCode(req));
    res.json({ ...dto, fitsVehicleIds: fitmentResult.rows.map((r) => r.vehicle_id) });
  } catch (err) {
    next(err);
  }
});

// GET /products/:id/alternatives (#9) -- real, genuinely equivalent
// in-stock parts when this exact product is out of stock or simply
// worth comparing. Matches on the real `part` field when this real
// product has one (e.g. "Brake Pad Set" matches other real brake pad
// sets, not just anything in the same broad category) -- falls back
// to `category` only when `part` isn't set for this real product.
// Always requires real stock_quantity > 0 -- suggesting another
// equally out-of-stock item would be a real, pointless dead end.
router.get('/products/:id/alternatives', async (req, res, next) => {
  try {
    const { lang } = req.query;
    const { rows: currentRows } = await db.query('SELECT part, category, supplier_id FROM products WHERE id = $1', [req.params.id]);
    if (currentRows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const current = currentRows[0];

    // Real supplier diversity (#80) -- excludes the real same
    // supplier from results, so a suggested alternative is genuinely
    // a different, real backup source, not coincidentally the same
    // one that's already out of stock. NULLIF handles a real product
    // with no real supplier_id set (e.g. seed data) without excluding
    // every other real supplier-less product by matching NULL = NULL.
    const { rows } = current.part
      ? await db.query(
          `SELECT * FROM products WHERE part = $1 AND id != $2 AND stock_quantity > 0 AND status = 'active' AND supplier_id IS DISTINCT FROM $3 ORDER BY rating DESC NULLS LAST LIMIT 6`,
          [current.part, req.params.id, current.supplier_id]
        )
      : await db.query(
          `SELECT * FROM products WHERE category = $1 AND id != $2 AND stock_quantity > 0 AND status = 'active' AND supplier_id IS DISTINCT FROM $3 ORDER BY rating DESC NULLS LAST LIMIT 6`,
          [current.category, req.params.id, current.supplier_id]
        );

    const destinationIsoCode = await resolveDestinationIsoCode(req);
    const dtos = await Promise.all(rows.map(async (row) => {
      let dto = toBuyerProductDto(row, lang);
      dto = await attachBuyerImages(dto, row.id);
      dto = await attachPrimaryFitment(dto, row.id, lang);
      dto = await attachPartTranslation(dto, row, lang);
      dto = await attachBuyerPrice(dto, row);
      dto = await attachSupplierSignals(dto, row.supplier_id);
      dto = await attachDeliveryEstimate(dto, destinationIsoCode);
      return dto;
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// GET /products/:id/oem-alternatives (#78) -- real, exact-match
// listings for the identical real OEM part number from different
// real suppliers, letting a buyer compare real prices for the exact
// same part. Deliberately anonymous -- never names which supplier is
// which, matching this platform's own deliberate anonymization
// design (see attachSupplierSignals' own header comment).
router.get('/products/:id/oem-alternatives', async (req, res, next) => {
  try {
    const { lang } = req.query;
    const { rows: currentRows } = await db.query('SELECT oem_number FROM products WHERE id = $1', [req.params.id]);
    if (currentRows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const oemNumber = currentRows[0].oem_number;
    if (!oemNumber) return res.json([]); // no real OEM number on this product -- genuinely nothing to compare

    const { rows } = await db.query(
      `SELECT * FROM products WHERE oem_number = $1 AND id != $2 AND status = 'active' ORDER BY stock_quantity DESC NULLS LAST LIMIT 10`,
      [oemNumber, req.params.id]
    );
    const destinationIsoCode = await resolveDestinationIsoCode(req);
    const dtos = await Promise.all(rows.map(async (row) => {
      let dto = toBuyerProductDto(row, lang);
      dto = await attachBuyerImages(dto, row.id);
      dto = await attachPrimaryFitment(dto, row.id, lang);
      dto = await attachPartTranslation(dto, row, lang);
      dto = await attachBuyerPrice(dto, row);
      dto = await attachSupplierSignals(dto, row.supplier_id);
      dto = await attachDeliveryEstimate(dto, destinationIsoCode);
      return dto;
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// GET /products/:id/same-model -- real "more parts for your car" cross-
// sell, confirmed directly with the person via a written plan first:
// genuinely different real parts for the SAME real vehicle model this
// product fits, not the same real part from a different real supplier
// (that's what /alternatives above is for). Uses this product's own
// real PRIMARY fitment entry (same "first by id" real convention
// already established in attachPrimaryFitment above) to resolve which
// real model_id to search by.
router.get('/products/:id/same-model', async (req, res, next) => {
  try {
    const { lang, page, limit } = req.query;
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const pageNum = Math.max(Number(page) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const { rows: fitmentRows } = await db.query(
      `SELECT vm.id AS model_id FROM product_fitment_entries pfe
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       JOIN vehicle_models vm ON vm.id = vg.model_id
       WHERE pfe.product_id = $1 ORDER BY pfe.id ASC LIMIT 1`,
      [req.params.id]
    );
    if (fitmentRows.length === 0) return res.json([]); // no real fitment on this product at all -- genuinely nothing to show
    const modelId = fitmentRows[0].model_id;

    const { rows } = await db.query(
      `SELECT DISTINCT p.* FROM products p
       JOIN product_fitment_entries pfe ON pfe.product_id = p.id
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       WHERE vg.model_id = $1 AND p.id != $2 AND p.stock_quantity > 0 AND p.status = 'active'
       ORDER BY p.rating DESC NULLS LAST, p.id ASC LIMIT $3 OFFSET $4`,
      [modelId, req.params.id, limitNum, offset]
    );
    const destinationIsoCode = await resolveDestinationIsoCode(req);
    const dtos = await Promise.all(rows.map(async (row) => {
      let dto = toBuyerProductDto(row, lang);
      dto = await attachBuyerImages(dto, row.id);
      dto = await attachPrimaryFitment(dto, row.id, lang);
      dto = await attachPartTranslation(dto, row, lang);
      dto = await attachBuyerPrice(dto, row);
      dto = await attachSupplierSignals(dto, row.supplier_id);
      dto = await attachDeliveryEstimate(dto, destinationIsoCode);
      return dto;
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// GET /products/:id/same-brand -- same real idea as same-model above,
// broadened to the whole real vehicle brand. Deliberately excludes
// every real product already surfaced by same-model (confirmed
// directly with the person), so the exact same real product never
// appears in both real rows on the product page.
router.get('/products/:id/same-brand', async (req, res, next) => {
  try {
    const { lang, page, limit } = req.query;
    const limitNum = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const pageNum = Math.max(Number(page) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    const { rows: fitmentRows } = await db.query(
      `SELECT vb.id AS brand_id, vm.id AS model_id FROM product_fitment_entries pfe
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       JOIN vehicle_models vm ON vm.id = vg.model_id
       JOIN vehicle_brands vb ON vb.id = vm.brand_id
       WHERE pfe.product_id = $1 ORDER BY pfe.id ASC LIMIT 1`,
      [req.params.id]
    );
    if (fitmentRows.length === 0) return res.json([]);
    const { brand_id: brandId, model_id: modelId } = fitmentRows[0];

    const { rows } = await db.query(
      `SELECT DISTINCT p.* FROM products p
       JOIN product_fitment_entries pfe ON pfe.product_id = p.id
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       JOIN vehicle_models vm ON vm.id = vg.model_id
       WHERE vm.brand_id = $1 AND p.id != $2 AND p.stock_quantity > 0 AND p.status = 'active'
         AND p.id NOT IN (
           SELECT pfe2.product_id FROM product_fitment_entries pfe2
           JOIN vehicle_generations vg2 ON vg2.id = pfe2.generation_id
           WHERE vg2.model_id = $3
         )
       ORDER BY p.rating DESC NULLS LAST, p.id ASC LIMIT $4 OFFSET $5`,
      [brandId, req.params.id, modelId, limitNum, offset]
    );
    const destinationIsoCode = await resolveDestinationIsoCode(req);
    const dtos = await Promise.all(rows.map(async (row) => {
      let dto = toBuyerProductDto(row, lang);
      dto = await attachBuyerImages(dto, row.id);
      dto = await attachPrimaryFitment(dto, row.id, lang);
      dto = await attachPartTranslation(dto, row, lang);
      dto = await attachBuyerPrice(dto, row);
      dto = await attachSupplierSignals(dto, row.supplier_id);
      dto = await attachDeliveryEstimate(dto, destinationIsoCode);
      return dto;
    }));
    res.json(dtos);
  } catch (err) {
    next(err);
  }
});

// GET /products/:id/reviews — real, public: only real APPROVED reviews
// (migration 025) are ever shown to a buyer, plus a real average rating
// computed directly from those same approved reviews — never from
// pending or rejected ones.
router.get('/products/:id/reviews', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT r.*, u.name AS buyer_name FROM product_reviews r
       JOIN users u ON u.id = r.buyer_id
       WHERE r.product_id = $1 AND r.status = 'approved'
       ORDER BY r.updated_at DESC`,
      [req.params.id]
    );
    // Real review photos (migration 031) -- batched in one real query
    // rather than one per review.
    const { rows: photoRows } = rows.length > 0
      ? await db.query('SELECT review_id, url FROM review_photos WHERE review_id = ANY($1::int[]) ORDER BY review_id, sort_order ASC', [rows.map((r) => r.id)])
      : { rows: [] };
    const photosByReview = {};
    for (const p of photoRows) {
      (photosByReview[p.review_id] ||= []).push(p.url);
    }
    const averageRating = rows.length > 0 ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : null;
    res.json({
      averageRating,
      reviewCount: rows.length,
      reviews: rows.map((r) => ({ id: r.id, buyerName: r.buyer_name, rating: r.rating, comment: r.comment, createdAt: r.created_at, photos: photosByReview[r.id] || [], isVerifiedPurchase: r.is_verified_purchase })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------- Catalog moderation (ADM-002, admin-only) ----------------
// Kept in this file rather than a separate module since it operates
// entirely on the products table this module already owns.

// GET /catalog/moderation-queue — products with status='translating',
// i.e. awaiting review before going live to buyers. Flags are computed
// live from real data rather than stored/fabricated:
//   - "Missing fitment data": zero rows in product_fitment_entries (the
//     structured Brand->Model->Generation cascade, migration 010) for
//     this product
//   - "New supplier": the supplier account is less than 30 days old
// Includes the supplier's original Chinese submission (name_zh,
// description_zh) and photos, so an admin reviewer can see exactly what
// was submitted and enter a real English translation as part of approval
// — see PATCH .../moderate below.
router.get('/moderation-queue', requireAuth, requireRole('admin'), requirePageAccess('moderation'), async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        p.id, p.name, p.name_zh, p.description_zh, p.category, p.part, p.position, p.oem_number, p.created_at,
        s.name AS supplier_name,
        s.created_at AS supplier_created_at,
        (SELECT COUNT(*) FROM product_fitment_entries pfe WHERE pfe.product_id = p.id) AS fitment_count
      FROM products p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.status = 'translating'
      ORDER BY p.created_at ASC
    `);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const withImages = await Promise.all(rows.map(async (r) => {
      const { rows: images } = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order', [r.id]);
      const flags = [];
      if (Number(r.fitment_count) === 0) flags.push('Missing fitment data');
      if (r.supplier_created_at && new Date(r.supplier_created_at) > thirtyDaysAgo) flags.push('New supplier');
      return {
        id: r.id,
        name: r.name,
        nameZh: r.name_zh,
        descriptionZh: r.description_zh,
        category: r.category,
        part: r.part,
        position: r.position,
        oemNumber: r.oem_number,
        images: images.map((i) => i.url),
        supplierName: r.supplier_name,
        submittedAt: r.created_at,
        flags,
      };
    }));
    res.json(withImages);
  } catch (err) {
    next(err);
  }
});

// PATCH /catalog/products/:id/moderate  { action: 'approve' | 'reject', nameEn?, descriptionEn?, nameAr?, descriptionAr? }
// Approving REQUIRES BOTH nameEn and nameAr — the whole point of this
// queue is that a supplier's Chinese submission needs real
// Leap-team-reviewed translations before it goes live to buyers (per
// the confirmed business requirement covering the full GCC + Jordan
// launch markets), not just a status flip. Rejecting doesn't need a
// translation, since the listing never goes live either way.
router.patch('/products/:id/moderate', requireAuth, requireRole('admin'), requirePageAccess('moderation'), async (req, res, next) => {
  try {
    const { action, nameEn, descriptionEn, nameAr, descriptionAr } = req.body || {};
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
    }
    // Both required, not just English — the confirmed 40-country launch
    // list includes the entire GCC plus Jordan, real markets where
    // Arabic isn't optional. Reported together so an admin doesn't have
    // to submit twice to discover the second thing they forgot.
    const missing = [];
    if (action === 'approve' && !nameEn) missing.push('nameEn');
    if (action === 'approve' && !nameAr) missing.push('nameAr');
    if (missing.length > 0) {
      return res.status(400).json({ error: `${missing.join(' and ')} required to approve — enter the reviewed translation(s) first` });
    }
    // Real, confirmed fix -- catches the exact reported bug: the
    // original Chinese submission still sitting untranslated in
    // nameEn/nameAr, rather than a genuine English/Arabic
    // translation.
    if (action === 'approve') {
      const stillChinese = [];
      if (containsChineseCharacters(nameEn)) stillChinese.push('nameEn');
      if (containsChineseCharacters(descriptionEn)) stillChinese.push('descriptionEn');
      if (containsChineseCharacters(nameAr)) stillChinese.push('nameAr');
      if (containsChineseCharacters(descriptionAr)) stillChinese.push('descriptionAr');
      if (stillChinese.length > 0) {
        return res.status(400).json({ error: `${stillChinese.join(', ')} still contains Chinese characters — translate before approving` });
      }
      const nameLengthErrors = [];
      const enError = validateNameLength(nameEn, 'nameEn');
      if (enError) nameLengthErrors.push(enError);
      const arError = validateNameLength(nameAr, 'nameAr');
      if (arError) nameLengthErrors.push(arError);
      if (nameLengthErrors.length > 0) {
        return res.status(400).json({ error: nameLengthErrors.join('; ') });
      }
    }
    const newStatus = action === 'approve' ? 'active' : 'inactive';
    const { rows } = await db.query(
      `UPDATE products SET
         status = $1,
         name = COALESCE($2, name), description = COALESCE($3, description),
         name_ar = COALESCE($4, name_ar), description_ar = COALESCE($5, description_ar)
       WHERE id = $6 RETURNING id, name, name_ar, status`,
      [
        newStatus,
        action === 'approve' ? nameEn : null, action === 'approve' ? (descriptionEn || null) : null,
        action === 'approve' ? nameAr : null, action === 'approve' ? (descriptionAr || null) : null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    await logAdminAction(req, action === 'approve' ? 'product_approved' : 'product_rejected', 'product', req.params.id, { name: rows[0].name });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /catalog/products/bulk-moderate — real bulk approve/reject.
// CONFIRMED DESIGN: bulk reject is simple (no per-item review needed,
// matching the single-item reject flow's existing "no reason required"
// behavior). Bulk APPROVE deliberately does NOT skip the real
// translation-review gate above — each item in the batch still needs
// its own real reviewed nameEn/nameAr, just submitted together in one
// request instead of one page navigation at a time. Best-effort, not
// all-or-nothing: one bad item in a batch of 20 shouldn't cost the
// other 19 their real approvals -- each item is processed independently
// and the real per-item result is reported back.
const MAX_BULK_ITEMS = 100;
router.post('/products/bulk-moderate', requireAuth, requireRole('admin'), requirePageAccess('moderation'), async (req, res, next) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items must be a non-empty array' });
    }
    if (items.length > MAX_BULK_ITEMS) {
      return res.status(400).json({ error: `Cannot process more than ${MAX_BULK_ITEMS} items in a single bulk request` });
    }

    const results = [];
    for (const item of items) {
      const { productId, action, nameEn, descriptionEn, nameAr, descriptionAr } = item || {};
      if (!productId || !['approve', 'reject'].includes(action)) {
        results.push({ productId: productId || null, success: false, error: "productId and a valid action ('approve' or 'reject') are required" });
        continue;
      }
      if (action === 'approve' && (!nameEn || !nameAr)) {
        results.push({ productId, success: false, error: 'nameEn and nameAr required to approve' });
        continue;
      }
      // Real, confirmed fix -- same check as the single-item endpoint
      // above: catches the original Chinese submission still sitting
      // untranslated in nameEn/nameAr, rather than a genuine
      // English/Arabic translation.
      if (action === 'approve') {
        const stillChinese = [];
        if (containsChineseCharacters(nameEn)) stillChinese.push('nameEn');
        if (containsChineseCharacters(descriptionEn)) stillChinese.push('descriptionEn');
        if (containsChineseCharacters(nameAr)) stillChinese.push('nameAr');
        if (containsChineseCharacters(descriptionAr)) stillChinese.push('descriptionAr');
        if (stillChinese.length > 0) {
          results.push({ productId, success: false, error: `${stillChinese.join(', ')} still contains Chinese characters — translate before approving` });
          continue;
        }
        const nameLengthErrors = [];
        const enError = validateNameLength(nameEn, 'nameEn');
        if (enError) nameLengthErrors.push(enError);
        const arError = validateNameLength(nameAr, 'nameAr');
        if (arError) nameLengthErrors.push(arError);
        if (nameLengthErrors.length > 0) {
          results.push({ productId, success: false, error: nameLengthErrors.join('; ') });
          continue;
        }
      }
      try {
        const newStatus = action === 'approve' ? 'active' : 'inactive';
        const { rows } = await db.query(
          `UPDATE products SET
             status = $1,
             name = COALESCE($2, name), description = COALESCE($3, description),
             name_ar = COALESCE($4, name_ar), description_ar = COALESCE($5, description_ar)
           WHERE id = $6 RETURNING id`,
          [
            newStatus,
            action === 'approve' ? nameEn : null, action === 'approve' ? (descriptionEn || null) : null,
            action === 'approve' ? nameAr : null, action === 'approve' ? (descriptionAr || null) : null,
            productId,
          ]
        );
        if (rows.length === 0) {
          results.push({ productId, success: false, error: 'Product not found' });
        } else {
          results.push({ productId, success: true });
        }
      } catch (err) {
        results.push({ productId, success: false, error: 'Internal error processing this item' });
      }
    }

    // Real, single summary entry for the whole batch (new) -- not one
    // per item, which could mean up to MAX_BULK_ITEMS (100) rows for a
    // single real admin action; a summary is what's actually useful to
    // review later, matching the audit module's own "practical subset"
    // scoping philosophy.
    const approvedCount = results.filter((r) => r.success && items.find((i) => i.productId === r.productId)?.action === 'approve').length;
    const rejectedCount = results.filter((r) => r.success && items.find((i) => i.productId === r.productId)?.action === 'reject').length;
    await logAdminAction(req, 'product_bulk_moderated', 'product', null, { approvedCount, rejectedCount, totalItems: items.length });

    res.json({ results });
  } catch (err) {
    next(err);
  }
});

// ============================================================
// Real admin product management (all live products) -- confirmed
// with the person through direct design discussion before building:
// a new, separate "All Products" admin page, edit everything except
// price (and its tightly-coupled currency_code, since editing one
// without the other would misrepresent the real price -- that stays
// exclusively the supplier's own to set). Stock quantity confirmed
// included, unlike price.
//
// Genuinely fills a real gap, not just a convenience: confirmed by
// reading the real supplier's own edit endpoint (PATCH /supplier/me/
// products/:id) that a real supplier can only ever touch price/
// stock/lowStockThreshold on their own already-live product --
// nothing else. There was previously no way for anyone to correct a
// real mistake in category, images, fitment, or dimensions once a
// real product went live, short of rejecting it back into
// moderation.
// ============================================================

// GET /catalog/admin/products?search=...&page=...
router.get('/admin/products', requireAuth, requireRole('admin'), requirePageAccess('products'), async (req, res, next) => {
  try {
    const search = (req.query.search || '').trim();
    const supplierId = (req.query.supplierId || '').trim();
    const brand = (req.query.brand || '').trim();
    const year = req.query.year ? parseInt(req.query.year, 10) : null;
    const weightMin = req.query.weightMin !== undefined ? parseFloat(req.query.weightMin) : null;
    const weightMax = req.query.weightMax !== undefined ? parseFloat(req.query.weightMax) : null;
    const volumeMin = req.query.volumeMin !== undefined ? parseFloat(req.query.volumeMin) : null;
    const volumeMax = req.query.volumeMax !== undefined ? parseFloat(req.query.volumeMax) : null;
    const groupBy = ['supplier', 'brand', 'year', 'weight', 'volume'].includes(req.query.groupBy) ? req.query.groupBy : null;
    const sortBy = groupBy || (['name', 'supplier', 'brand', 'year', 'weight', 'volume'].includes(req.query.sortBy) ? req.query.sortBy : 'name');
    const sortDir = req.query.sortDir === 'desc' ? 'DESC' : 'ASC';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    // Real, confirmed necessary: a real group split across pages would
    // defeat the whole point of grouping, so a much larger real page
    // size is used whenever groupBy is active.
    const pageSize = groupBy ? 500 : 30;
    const offset = (page - 1) * pageSize;

    const baseFrom = `
      FROM products p
      LEFT JOIN suppliers s ON s.id = p.supplier_id
      LEFT JOIN LATERAL (
        SELECT vb.name AS brand_name, pfe.year AS fitment_year
        FROM product_fitment_entries pfe
        JOIN vehicle_generations vg ON vg.id = pfe.generation_id
        JOIN vehicle_models vm ON vm.id = vg.model_id
        JOIN vehicle_brands vb ON vb.id = vm.brand_id
        WHERE pfe.product_id = p.id
        ORDER BY pfe.id ASC
        LIMIT 1
      ) pf ON true
    `;

    const params = [];
    let where = `WHERE p.status = 'active'`;
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.oem_number ILIKE $${params.length} OR s.name ILIKE $${params.length})`;
    }
    if (supplierId) {
      params.push(supplierId);
      where += ` AND p.supplier_id = $${params.length}`;
    }
    if (brand) {
      params.push(brand);
      where += ` AND pf.brand_name = $${params.length}`;
    }
    if (year) {
      params.push(year);
      where += ` AND pf.fitment_year = $${params.length}`;
    }
    if (weightMin != null) { params.push(weightMin); where += ` AND p.weight_kg >= $${params.length}`; }
    if (weightMax != null) { params.push(weightMax); where += ` AND p.weight_kg <= $${params.length}`; }
    if (volumeMin != null) { params.push(volumeMin); where += ` AND (p.length_cm * p.width_cm * p.height_cm) >= $${params.length}`; }
    if (volumeMax != null) { params.push(volumeMax); where += ` AND (p.length_cm * p.width_cm * p.height_cm) <= $${params.length}`; }

    const orderColumn = {
      name: 'p.name', supplier: 's.name', brand: 'pf.brand_name', year: 'pf.fitment_year',
      weight: 'p.weight_kg', volume: '(p.length_cm * p.width_cm * p.height_cm)',
    }[sortBy];

    const { rows: countRows } = await db.query(`SELECT COUNT(*) AS total ${baseFrom} ${where}`, params);
    params.push(pageSize, offset);
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.category, p.part, p.oem_number, p.price, p.currency_code, p.stock_quantity,
              p.weight_kg, p.length_cm, p.width_cm, p.height_cm,
              s.name AS supplier_name, pf.brand_name, pf.fitment_year,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.sort_order ASC LIMIT 1) AS first_image
       ${baseFrom}
       ${where}
       ORDER BY ${orderColumn} ${sortDir} NULLS LAST, p.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      products: rows.map((r) => ({
        id: r.id, name: r.name, category: r.category, part: r.part, oemNumber: r.oem_number,
        price: Number(r.price), currencyCode: r.currency_code, stockQuantity: r.stock_quantity, supplierName: r.supplier_name,
        weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
        volumeCm3: (r.length_cm != null && r.width_cm != null && r.height_cm != null) ? Number(r.length_cm) * Number(r.width_cm) * Number(r.height_cm) : null,
        brand: r.brand_name, year: r.fitment_year,
        firstImage: r.first_image,
      })),
      total: Number(countRows[0].total),
      page,
      pageSize,
      groupBy,
    });
  } catch (err) {
    next(err);
  }
});

// GET /catalog/admin/products/:id -- full real detail for editing,
// including real fitment and real images, deliberately NOT the
// buyer-facing DTO (no real price conversion/delivery estimate --
// this is an internal editing view, not a storefront one).
router.get('/admin/products/:id', requireAuth, requireRole('admin'), requirePageAccess('products'), async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM products p WHERE p.id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    const row = rows[0];

    const { rows: images } = await db.query('SELECT url FROM product_images WHERE product_id = $1 ORDER BY sort_order', [row.id]);
    const { rows: fitmentRows } = await db.query(
      `SELECT pfe.generation_id, pfe.year, pfe.engine_id, pfe.transmission_id,
              vb.name AS brand_name, vm.name AS model_name, vg.name AS generation_name
       FROM product_fitment_entries pfe
       JOIN vehicle_generations vg ON vg.id = pfe.generation_id
       JOIN vehicle_models vm ON vm.id = vg.model_id
       JOIN vehicle_brands vb ON vb.id = vm.brand_id
       WHERE pfe.product_id = $1`,
      [row.id]
    );

    res.json({
      id: row.id,
      name: row.name,
      nameAr: row.name_ar,
      description: row.description,
      descriptionAr: row.description_ar,
      category: row.category,
      part: row.part,
      position: row.position,
      oemNumber: row.oem_number,
      price: Number(row.price),
      currencyCode: row.currency_code,
      stockQuantity: row.stock_quantity,
      lowStockThreshold: row.low_stock_threshold,
      weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
      lengthCm: row.length_cm === null ? null : Number(row.length_cm),
      widthCm: row.width_cm === null ? null : Number(row.width_cm),
      heightCm: row.height_cm === null ? null : Number(row.height_cm),
      images: images.map((i) => i.url),
      fitment: fitmentRows.map((f) => ({
        generationId: f.generation_id, year: f.year, engineId: f.engine_id, transmissionId: f.transmission_id,
        label: `${f.brand_name} ${f.model_name} (${f.generation_name}) · ${f.year}`,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /catalog/admin/products/:id -- everything except price/
// currencyCode, confirmed directly with the person. Every field
// independently optional (a real partial update, matching this
// codebase's own established COALESCE convention) -- images/fitment
// are real, full replacements when provided at all (arrays, not
// simple columns), left untouched when omitted from the request.
router.patch('/admin/products/:id', requireAuth, requireRole('admin'), requirePageAccess('products'), async (req, res, next) => {
  const client = await db.getPool().connect();
  try {
    const {
      nameEn, nameAr, descriptionEn, descriptionAr, category, part, position, oemNumber,
      stockQuantity, lowStockThreshold, weightKg, lengthCm, widthCm, heightCm,
      images, fitment,
    } = req.body || {};

    if (position !== undefined && position !== null && !ALLOWED_POSITIONS.includes(position)) {
      return res.status(400).json({ error: `position must be one of: ${ALLOWED_POSITIONS.join(', ')}` });
    }
    if (nameEn !== undefined) {
      const nameEnError = validateNameLength(nameEn, 'nameEn');
      if (nameEnError) return res.status(400).json({ error: nameEnError });
    }
    if (nameAr !== undefined) {
      const nameArError = validateNameLength(nameAr, 'nameAr');
      if (nameArError) return res.status(400).json({ error: nameArError });
    }
    // Real, confirmed fix found via self-audit: unlike the real
    // supplier submission endpoint (which validates these are
    // positive), this admin edit endpoint had no such check at all --
    // a real typo (e.g. a negative weight) would silently corrupt
    // this real product's own delivery-estimate calculations.
    for (const [field, value] of [['weightKg', weightKg], ['lengthCm', lengthCm], ['widthCm', widthCm], ['heightCm', heightCm]]) {
      if (value !== undefined && value !== null && value <= 0) {
        return res.status(400).json({ error: `${field} must be a positive number` });
      }
    }
    for (const [field, value] of [['stockQuantity', stockQuantity], ['lowStockThreshold', lowStockThreshold]]) {
      if (value !== undefined && value !== null && value < 0) {
        return res.status(400).json({ error: `${field} cannot be negative` });
      }
    }
    if (images !== undefined && images.length < MIN_PRODUCT_PHOTOS) {
      return res.status(400).json({ error: `At least ${MIN_PRODUCT_PHOTOS} photos required` });
    }
    if (fitment !== undefined && fitment.length === 0) {
      return res.status(400).json({ error: 'At least one vehicle fitment entry is required -- an empty list would make this product unsearchable' });
    }
    // Real, confirmed fix found via self-audit: unlike the real
    // supplier submission endpoint (which validates every one of
    // these), this admin edit endpoint's fitment replacement had zero
    // validation at all -- it would either silently save a real
    // mismatched year/engine/transmission, or throw a raw, unhandled
    // database error if a real generationId didn't exist. Loops over
    // every real entry, since this endpoint (unlike the supplier's
    // own single-entry submission) supports multiple fitment entries
    // per product.
    if (fitment !== undefined) {
      for (const f of fitment) {
        if (!f.generationId || !f.year) {
          return res.status(400).json({ error: 'Each fitment entry needs a generationId and a year' });
        }
        const genCheck = await client.query('SELECT * FROM vehicle_generations WHERE id = $1', [f.generationId]);
        if (genCheck.rows.length === 0) {
          return res.status(400).json({ error: `Unknown fitment generationId: ${f.generationId}` });
        }
        const generation = genCheck.rows[0];
        const maxYear = generation.year_end || new Date().getFullYear() + 1;
        if (f.year < generation.year_start || f.year > maxYear) {
          return res.status(400).json({ error: `Fitment year ${f.year} is outside this generation's range (${generation.year_start}–${generation.year_end || 'present'})` });
        }
        if (f.engineId) {
          const engCheck = await client.query('SELECT id FROM vehicle_engines WHERE id = $1 AND generation_id = $2', [f.engineId, f.generationId]);
          if (engCheck.rows.length === 0) {
            return res.status(400).json({ error: 'A fitment engineId does not belong to its given generation' });
          }
        }
        if (f.transmissionId) {
          const transCheck = await client.query('SELECT id FROM vehicle_transmissions WHERE id = $1 AND generation_id = $2', [f.transmissionId, f.generationId]);
          if (transCheck.rows.length === 0) {
            return res.status(400).json({ error: 'A fitment transmissionId does not belong to its given generation' });
          }
        }
      }
    }
    // Real, confirmed fix found via self-audit: category/part were
    // never validated at all here, unlike the real supplier
    // submission endpoint, which validates both. Only checks whatever
    // is actually being changed -- a partial update, matching this
    // endpoint's own established COALESCE convention.
    if (category !== undefined) {
      const categoryCheck = await client.query('SELECT id FROM product_categories WHERE id = $1', [category]);
      if (categoryCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Unknown category' });
      }
    }
    if (part !== undefined) {
      // Real, correctly resolved: the EFFECTIVE category is whichever
      // one this real product will actually have after this update --
      // the newly-provided one if category is also being changed in
      // this same real request, otherwise the product's own existing
      // real category.
      let effectiveCategory = category;
      if (effectiveCategory === undefined) {
        const { rows: existingRows } = await client.query('SELECT category FROM products WHERE id = $1', [req.params.id]);
        if (existingRows.length === 0) return res.status(404).json({ error: 'Product not found' });
        effectiveCategory = existingRows[0].category;
      }
      const partCheck = await client.query('SELECT id FROM category_parts WHERE category_id = $1 AND name_en = $2', [effectiveCategory, part]);
      if (partCheck.rows.length === 0) {
        return res.status(400).json({ error: 'part must belong to the selected category' });
      }
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE products SET
         name = COALESCE($1, name), name_ar = COALESCE($2, name_ar),
         description = COALESCE($3, description), description_ar = COALESCE($4, description_ar),
         category = COALESCE($5, category), part = COALESCE($6, part), position = COALESCE($7, position),
         oem_number = COALESCE($8, oem_number),
         stock_quantity = COALESCE($9, stock_quantity), low_stock_threshold = COALESCE($10, low_stock_threshold),
         weight_kg = COALESCE($11, weight_kg), length_cm = COALESCE($12, length_cm),
         width_cm = COALESCE($13, width_cm), height_cm = COALESCE($14, height_cm)
       WHERE id = $15
       RETURNING id`,
      [
        nameEn ?? null, nameAr ?? null, descriptionEn ?? null, descriptionAr ?? null,
        category ?? null, part ?? null, position ?? null, oemNumber ?? null,
        stockQuantity ?? null, lowStockThreshold ?? null,
        weightKg ?? null, lengthCm ?? null, widthCm ?? null, heightCm ?? null,
        req.params.id,
      ]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    if (images !== undefined) {
      await client.query('DELETE FROM product_images WHERE product_id = $1', [req.params.id]);
      for (let i = 0; i < images.length; i++) {
        await client.query('INSERT INTO product_images (product_id, url, sort_order) VALUES ($1, $2, $3)', [req.params.id, images[i], i]);
      }
    }
    if (fitment !== undefined) {
      await client.query('DELETE FROM product_fitment_entries WHERE product_id = $1', [req.params.id]);
      for (const f of fitment) {
        await client.query(
          `INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ($1, $2, $3, $4, $5)`,
          [req.params.id, f.generationId, f.year, f.engineId || null, f.transmissionId || null]
        );
      }
    }

    await client.query('COMMIT');
    await logAdminAction(req, 'product_edited', 'product', req.params.id, {});
    res.json({ id: req.params.id });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============================================================
// Real, admin-managed category + part reference lists (migration 015).
// Confirmed requirement: a supplier picks a real Part from a real list
// scoped to the Category they selected, rather than typing free text.
// Same structural idea as the Vehicle Data fitment cascade, two levels
// instead of four. Public GET endpoints are used by both the supplier
// portal (populating its Category/Part dropdowns) and the mobile app
// (the home screen's category grid, no longer hardcoded).
// ============================================================

function toCategoryDto(row) {
  return { id: row.id, nameEn: row.name_en, nameAr: row.name_ar, photoUrl: row.photo_url, sortOrder: row.sort_order, commissionPercent: Number(row.commission_percent) };
}
function toPartDto(row) {
  return { id: row.id, categoryId: row.category_id, nameEn: row.name_en, nameAr: row.name_ar, sortOrder: row.sort_order, photoUrl: row.photo_url };
}

/**
 * Real trending searches -- genuinely aggregated from real_log's own
 * real, logged queries over the last real 7 days, not fabricated
 * example terms. Requires a real minimum of 3 occurrences to appear
 * at all -- a real one-off, unusual query (a typo, a very specific
 * part number only one real person searched) shouldn't surface as if
 * it were a genuine platform-wide trend just because it's the only
 * thing in a quiet time window.
 *
 * Real, deliberate case-insensitive grouping (LOWER(query)) -- "brake
 * pads" and "Brake Pads" are the real same search intent, and should
 * count together, not split into two separate, smaller real counts
 * that each individually miss the real threshold.
 */
// GET /catalog/search-autocomplete?prefix=X (#28) -- real
// autocomplete suggestions as a buyer types, using real, previously-
// searched terms from search_log (the same real table
// trending-searches above already aggregates from). Never suggests a
// fabricated term nobody has actually searched for.
router.get('/search-autocomplete', async (req, res, next) => {
  try {
    const prefix = (req.query.prefix || '').trim();
    if (prefix.length < 2) return res.json([]); // too short to be a genuinely useful real suggestion
    const { rows } = await db.query(
      `SELECT LOWER(query) AS query, COUNT(*) AS count
       FROM search_log
       WHERE LOWER(query) LIKE LOWER($1) AND created_at > now() - interval '30 days'
       GROUP BY LOWER(query)
       ORDER BY count DESC
       LIMIT 6`,
      [`${prefix}%`]
    );
    res.json(rows.map((r) => r.query));
  } catch (err) {
    next(err);
  }
});

router.get('/trending-searches', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT LOWER(query) AS query, COUNT(*) AS count
       FROM search_log
       WHERE created_at > now() - interval '7 days'
       GROUP BY LOWER(query)
       HAVING COUNT(*) >= 3
       ORDER BY count DESC
       LIMIT 8`
    );
    res.json(rows.map((r) => r.query));
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM product_categories ORDER BY sort_order ASC');
    res.json(rows.map(toCategoryDto));
  } catch (err) {
    next(err);
  }
});

// Real, admin-editable commission rate per category (migration 024) —
// makes the Settings page's "Commission rules" card genuinely
// functional and genuinely used in the real payouts calculation,
// replacing what was previously a hardcoded, fake display-only number.
router.patch('/categories/:id/commission', requireAuth, requireRole('admin'), requirePageAccess('payouts'), async (req, res, next) => {
  try {
    const { commissionPercent } = req.body || {};
    const value = Number(commissionPercent);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return res.status(400).json({ error: 'commissionPercent must be a real number between 0 and 100' });
    }
    const { rows } = await db.query(
      'UPDATE product_categories SET commission_percent = $1 WHERE id = $2 RETURNING *',
      [value, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    await logAdminAction(req, 'category_commission_changed', 'category', req.params.id, { commissionPercent: value });
    res.json(toCategoryDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.post('/categories', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { id, nameEn, nameAr, photoUrl, sortOrder } = req.body || {};
    if (!id || !nameEn) return res.status(400).json({ error: 'id and nameEn are required' });
    // nameAr and photoUrl are now BOTH required (new) -- an explicit
    // real requirement; nameAr was optional before this. DB columns
    // stay nullable so this doesn't retroactively break categories
    // created before this requirement existed.
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    await db.query(
      'INSERT INTO product_categories (id, name_en, name_ar, photo_url, sort_order) VALUES ($1, $2, $3, $4, $5)',
      [id, nameEn, nameAr.trim(), photoUrl.trim(), sortOrder ?? 0]
    );
    const { rows } = await db.query('SELECT * FROM product_categories WHERE id = $1', [id]);
    await logAdminAction(req, 'category_created', 'category', id, { nameEn });
    res.status(201).json(toCategoryDto(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: `A category with id "${req.body?.id}" already exists` });
    next(err);
  }
});

// Real, new (previously only settable at creation) -- lets an admin
// replace a category's real photo at any time, without deleting and
// recreating the whole category just to swap one image.
// Real, new -- lets an admin edit an existing category's name fields
// at any time (id stays immutable; photo stays on its own separate
// endpoint above). Previously only the photo could be changed after
// creation.
router.patch('/categories/:id', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { nameEn, nameAr } = req.body || {};
    if (!nameEn || !nameEn.trim()) return res.status(400).json({ error: 'nameEn is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    const { rows } = await db.query('UPDATE product_categories SET name_en = $1, name_ar = $2 WHERE id = $3 RETURNING *', [nameEn.trim(), nameAr.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    await logAdminAction(req, 'category_updated', 'category', req.params.id, { nameEn: nameEn.trim() });
    res.json(toCategoryDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/categories/:id/photo', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const { rows } = await db.query('UPDATE product_categories SET photo_url = $1 WHERE id = $2 RETURNING *', [photoUrl.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    await logAdminAction(req, 'category_photo_changed', 'category', req.params.id, {});
    res.json(toCategoryDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Real, new -- categories reorder globally (no scope, no real parent
// to scope by), same real pattern already proven for pricing fee
// components.
router.post('/categories/:id/move', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const { current, neighbor } = await moveItem({ table: 'product_categories', id: req.params.id, direction, orderColumn: 'sort_order', notFoundMessage: 'Category not found' });
    await logAdminAction(req, 'category_reordered', 'category', current.id, { direction, swappedWith: neighbor.name_en });
    const { rows } = await db.query('SELECT * FROM product_categories ORDER BY sort_order ASC');
    res.json(rows.map(toCategoryDto));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

// Deleting a category real-protects against orphaning real products —
// same "you cannot delete what's actually referenced" pattern as
// Vehicle Data and Hubs, not silently allowed and not a raw DB error.
router.delete('/categories/:id', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { rows: productsUsingIt } = await db.query('SELECT id FROM products WHERE category = $1 LIMIT 1', [req.params.id]);
    if (productsUsingIt.length > 0) {
      return res.status(409).json({ error: 'Cannot delete this category — real products still reference it' });
    }
    // Real bug found via testing: category_parts.category_id has a FK
    // to product_categories with no CASCADE — deleting a category that
    // still has parts attached (even ones no product actually uses)
    // would otherwise throw a raw, uncaught DB constraint error (a
    // real 500, not a real 409) instead of a clear, specific message.
    // An admin should remove/reassign a category's parts first, which
    // keeps the operation intentional rather than silently orphaning
    // reference data.
    const { rows: partsUsingIt } = await db.query('SELECT id FROM category_parts WHERE category_id = $1 LIMIT 1', [req.params.id]);
    if (partsUsingIt.length > 0) {
      return res.status(409).json({ error: 'Cannot delete this category — it still has parts. Delete those first.' });
    }
    const { rows: categoryRow } = await db.query('SELECT name_en FROM product_categories WHERE id = $1', [req.params.id]);
    const { rowCount } = await db.query('DELETE FROM product_categories WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Category not found' });
    await logAdminAction(req, 'category_deleted', 'category', req.params.id, { nameEn: categoryRow[0]?.name_en });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/categories/:id/parts', async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM category_parts WHERE category_id = $1 ORDER BY sort_order ASC', [req.params.id]);
    res.json(rows.map(toPartDto));
  } catch (err) {
    next(err);
  }
});

router.post('/categories/:id/parts', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { nameEn, nameAr, sortOrder, photoUrl } = req.body || {};
    if (!nameEn) return res.status(400).json({ error: 'nameEn is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    const categoryCheck = await db.query('SELECT id FROM product_categories WHERE id = $1', [req.params.id]);
    if (categoryCheck.rows.length === 0) return res.status(404).json({ error: 'Category not found' });
    const partId = `part_${Date.now()}`;
    await db.query(
      'INSERT INTO category_parts (id, category_id, name_en, name_ar, sort_order, photo_url) VALUES ($1, $2, $3, $4, $5, $6)',
      [partId, req.params.id, nameEn, nameAr || null, sortOrder ?? 0, photoUrl?.trim() || null]
    );
    const { rows } = await db.query('SELECT * FROM category_parts WHERE id = $1', [partId]);
    await logAdminAction(req, 'part_created', 'part', partId, { nameEn, categoryId: req.params.id });
    res.status(201).json(toPartDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Deleting a part real-protects against orphaning real products that
// were submitted with that exact part name — see the supplier module's
// header comment on why `products.part` stays plain text (validated
// against this list, not a foreign key) rather than being changed to
// reference category_parts.id directly.
router.delete('/parts/:id', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { rows: partRows } = await db.query('SELECT * FROM category_parts WHERE id = $1', [req.params.id]);
    if (partRows.length === 0) return res.status(404).json({ error: 'Part not found' });
    const { rows: productsUsingIt } = await db.query('SELECT id FROM products WHERE part = $1 LIMIT 1', [partRows[0].name_en]);
    if (productsUsingIt.length > 0) {
      return res.status(409).json({ error: 'Cannot delete this part — real products still reference it' });
    }
    await db.query('DELETE FROM category_parts WHERE id = $1', [req.params.id]);
    await logAdminAction(req, 'part_deleted', 'part', req.params.id, { nameEn: partRows[0].name_en });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Real, new (previously never settable at all for parts, per the real
// gap confirmed before building this) -- lets an admin add or replace
// a part's real photo at any time.
// Real, new -- lets an admin edit an existing part's name fields at
// any time (photo stays on its own separate endpoint below). nameAr
// stays optional here, matching how a part is originally created.
router.patch('/parts/:id', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { nameEn, nameAr } = req.body || {};
    if (!nameEn || !nameEn.trim()) return res.status(400).json({ error: 'nameEn is required' });
    if (!nameAr || !nameAr.trim()) return res.status(400).json({ error: 'nameAr is required' });
    const { rows } = await db.query('UPDATE category_parts SET name_en = $1, name_ar = $2 WHERE id = $3 RETURNING *', [nameEn.trim(), nameAr.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Part not found' });
    await logAdminAction(req, 'part_updated', 'part', req.params.id, { nameEn: nameEn.trim() });
    res.json(toPartDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/parts/:id/photo', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { photoUrl } = req.body || {};
    if (!photoUrl || !photoUrl.trim()) return res.status(400).json({ error: 'photoUrl is required' });
    const { rows } = await db.query('UPDATE category_parts SET photo_url = $1 WHERE id = $2 RETURNING *', [photoUrl.trim(), req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Part not found' });
    await logAdminAction(req, 'part_photo_changed', 'part', req.params.id, {});
    res.json(toPartDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Real, new -- parts reorder only among their own real category's
// other parts, never mixed in with a different category's parts.
router.post('/parts/:id/move', requireAuth, requireRole('admin'), requirePageAccess('categories'), async (req, res, next) => {
  try {
    const { direction } = req.body || {};
    const { rows: partRows } = await db.query('SELECT category_id FROM category_parts WHERE id = $1', [req.params.id]);
    if (partRows.length === 0) return res.status(404).json({ error: 'Part not found' });
    const { current, neighbor } = await moveItem({ table: 'category_parts', id: req.params.id, direction, orderColumn: 'sort_order', scopeColumn: 'category_id', scopeValue: partRows[0].category_id, notFoundMessage: 'Part not found' });
    await logAdminAction(req, 'part_reordered', 'part', current.id, { direction, swappedWith: neighbor.name_en });
    const { rows } = await db.query('SELECT * FROM category_parts WHERE category_id = $1 ORDER BY sort_order ASC', [partRows[0].category_id]);
    res.json(rows.map(toPartDto));
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
// Real product DTO helpers, exported for reuse by other modules that
// need to render a real buyer-facing product (e.g. the wishlist module) —
// avoids re-implementing the same language resolution / live pricing /
// photo attachment logic in a second place, which would risk drift.
module.exports.toBuyerProductDto = toBuyerProductDto;
module.exports.attachBuyerPrice = attachBuyerPrice;
module.exports.attachBuyerImages = attachBuyerImages;
module.exports.attachSupplierSignals = attachSupplierSignals;
module.exports.attachDeliveryEstimate = attachDeliveryEstimate;
module.exports.attachPrimaryFitment = attachPrimaryFitment;
module.exports.buildProductMatchQuery = buildProductMatchQuery;
