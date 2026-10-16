# Lazy loading: the exact edits

Included as whole files in `leap_lazy_loading.zip`. **If you have changed `services/api/src/modules/catalog/routes.js` since the project was last shared, do not overwrite it: apply the edits below by hand.** Everything else in the zip is new or website-only. **Restart the backend afterwards.**

## Server: new file `services/api/src/modules/catalog/listCache.js`
New file, nothing to merge: a short-lived cache (`createListCache({ ttlMs, max, now })` with `get(key, compute)`): same key at the same moment shares ONE computation, a failed computation is not remembered, at most `max` lists are kept.

## Server: `services/api/src/modules/catalog/routes.js` (the `GET /products` handler)
1. At the top: `const { createListCache } = require('./listCache');` and, after `const router = express.Router();`:
   `const continuationCache = createListCache({ ttlMs: process.env.CATALOG_LIST_CACHE_MS !== undefined ? Number(process.env.CATALOG_LIST_CACHE_MS) : 60 * 1000, max: 100 });`
2. Add `more` to the destructured `req.query`, and `const isContinuation = more === '1';`.
3. Only log the search when it is NOT a continuation: `if (!isContinuation && typeof search === 'string' && search.trim().length >= 3) { ... }`.
4. Replace `if (sort === 'newest') sql += ' ORDER BY p.created_at DESC';` with
   `sql += sort === 'newest' ? ' ORDER BY p.created_at DESC, p.id' : ' ORDER BY p.created_at, p.id';`
   (a STABLE order: the list had none, so page 2 could repeat or skip what page 1 showed; this also makes the mobile app's order deterministic).
5. Move everything that builds the list (the `db.query(sql, params)`, `buildBuyerList(...)` with its `attach*` calls, the min/max price and delivery-days filters and the price sorts) into `const computeList = async () => { ...; return dtos; };` and use
   `let dtos = isContinuation ? await continuationCache.get(JSON.stringify({ category, part, vehicleId, search, sort, lang, generationId, year, minPrice, maxPrice, maxDeliveryDays, destinationIsoCode }), computeList) : await computeList();`
   (`destinationIsoCode` = `await resolveDestinationIsoCode(req)`, computed BEFORE; delivery estimates depend on it, so it must be in the key). The `X-Total-Count` header and the final `slice` stay as they are (the slice makes a new array: a cached list is never changed).

## Website (`apps/web-storefront`)
New: `components/InfiniteProductGrid.tsx`, `lib/gridMemory.ts`, `lib/gridSource.ts`, `lib/rateLimit.ts`, `app/api/products/route.ts` and their tests. Changed: `app/search/page.tsx`, `components/LoadMoreGrid.tsx`, `components/ProductCard.tsx`, `components/SiteFooter.tsx`, `app/robots.ts`, `lib/api.ts`, `lib/i18n.ts`, README.md, and three test files.

## Server tests (in the admin dashboard's test folder, like the project's other server tests)
`apps/admin-dashboard/src/catalogListCache.test.js` (the cache) and `apps/admin-dashboard/src/catalogLazy.integration.test.js` (the pages of the real list add up to the whole list, in every sort order).

## Heads-up about the older server tests
They share the development database. When rerun many times, `faultCases`, `reviews` and `verifiedPurchaseReview` fail once the seeded products `p1`/`p4` are out of stock, and `savedSearches` fails when old saved searches are left over from earlier runs. This is not caused by this change (restocking `p1`/`p4` and clearing `saved_searches` made all of them pass with it); it is how those older tests treat a reused database.
