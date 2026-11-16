# LEAP security check

2026-11-08 06:00 · read 1396 files · 430 API routes

| | Count |
|---|---|
| 🔴 High (fix before going live) | 4 |
| 🟠 Medium (check) | 13 |
| 🟡 Low (good to fix) | 14 |
| 🟢 OK | 2 |

**Who can call the API routes:** role (admin / supplier / hub) 295 · signed-in 57 · optional sign-in 21 · anyone 57

This reads the code as text: a check written inside a handler may not be seen. Every line is "check by hand", not "broken".

## 🔴 High

- **Routes:** POST /quotations/public/:code/shares/:shareId can be called by anyone, no sign-in (services/api/src/modules/quotations/routes.js:122)
- **Routes:** POST /user/guest-claim can be called by anyone, no sign-in (services/api/src/modules/user/routes.js:22)
- **Routes:** POST /payment/intent can be called by anyone, no sign-in (services/api/src/modules/payment/routes.js:76)
- **Routes:** POST /payment/paypal/capture/:orderId can be called by anyone, no sign-in (services/api/src/modules/payment/routes.js:167)

## 🟠 Medium

- **Secrets:** apps/hub-mobile/lib/core/hub_strings.dart:161 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Secrets:** apps/hub-portal/src/App.jsx:115 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Secrets:** apps/supplier-portal/src/LoginPage.jsx:28 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Secrets:** apps/web-storefront/lib/testSupport.ts:23 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Secrets:** scripts/check-data-loading.ps1:16 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Secrets:** scripts/patch-delivery-open.js:16 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Secrets:** scripts/patch-delivery-proof.js:17 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Secrets:** services/api/db/seed.js:15 looks like a password or secret written in the code. If it is real, move it to .env and replace it (treat the old one as leaked).
- **Server:** CORS accepts calls from ANY website (cors() without "origin"). On the real server allow only your own domains (storefront, admin, portals).
- **Server:** 'trust proxy' is true: right behind a real proxy/load balancer; without one anyone can fake their IP (weakens country detection and any limit per IP). Set it to the number of proxies (e.g. 1).
- **Server:** No security headers (helmet is not used): add helmet to the API, and the same headers on the websites (frame, content type, referrer).
- **Settings:** JWT_SECRET is not set: the API uses its built-in development secret, so anyone could make a login for any account. Set a long random one.
- **Settings:** The database password in DATABASE_URL is weak (7 characters). Fine on your PC; on the server use a long random one.

## 🟡 Low

- **Routes:** /uploads serves files from disk to anyone (uploads): make sure only images go there and no folder listing.
- **Routes:** POST /proof/:token can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/deliveryProof/routes.js:57)
- **Routes:** POST /proof/:token/attempt can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/deliveryProof/routes.js:88)
- **Routes:** POST /order can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/order/routes.js:90)
- **Routes:** POST /auth/signup can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/auth/routes.js:40)
- **Routes:** POST /auth/login can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/auth/routes.js:105)
- **Routes:** POST /auth/login/2fa can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/auth/routes.js:164)
- **Routes:** POST /auth/forgot-password can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/auth/routes.js:413)
- **Routes:** POST /auth/reset-password can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries) (services/api/src/modules/auth/routes.js:465)
- **Routes:** POST /webhooks/17track can be called by anyone, no sign-in (expected for this kind of route, but check it limits repeated tries); it checks a signature (services/api/src/modules/webhooks/routes.js:61)
- **Server:** No general limit on repeated requests (no express-rate-limit). Some modules count attempts themselves; Sign-in, password reset, guest order lookup and promo codes must limit tries, or a script can guess thousands of times.
- **Server:** /health is public and shows the environment and pending migrations: keep it short on the real server (status only).
- **Server:** express.json() has no size limit set (default 100 kb, fine); keep upload routes limited by size too.
- **Settings:** NODE_ENV is "not set": on the real server it must be "production" (the API then refuses weak secrets).

## 🟢 OK

- **Secrets:** .env is in .gitignore.
- **Settings:** The database is on the same machine (not open to the internet from this setting).

## Routes anyone can read (GET, no sign-in): 44

Check none of these returns private data (emails, phones, addresses, prices paid, other people's orders).

- GET /catalog/attribute-definitions (services/api/src/modules/catalog/routes.js:1636)
- GET /catalog/categories (services/api/src/modules/catalog/routes.js:1520)
- GET /catalog/categories/:id/parts (services/api/src/modules/catalog/routes.js:1904)
- GET /catalog/discount-rules (services/api/src/modules/catalog/routes.js:1654)
- GET /catalog/product-requirements (services/api/src/modules/catalog/routes.js:1551)
- GET /catalog/products (services/api/src/modules/catalog/routes.js:454)
- GET /catalog/products/:id (services/api/src/modules/catalog/routes.js:542)
- GET /catalog/products/:id/alternatives (services/api/src/modules/catalog/routes.js:583)
- GET /catalog/products/:id/oem-alternatives (services/api/src/modules/catalog/routes.js:639)
- GET /catalog/products/:id/reviews (services/api/src/modules/catalog/routes.js:772)
- GET /catalog/products/:id/same-brand (services/api/src/modules/catalog/routes.js:676)
- GET /catalog/products/:id/same-model (services/api/src/modules/catalog/routes.js:731)
- GET /catalog/search-autocomplete (services/api/src/modules/catalog/routes.js:1484)
- GET /catalog/stats (services/api/src/modules/catalog/routes.js:30)
- GET /catalog/trending-searches (services/api/src/modules/catalog/routes.js:1503)
- GET /config/markets (services/api/src/modules/config/routes.js:11)
- GET /config/markets/:countryCode (services/api/src/modules/config/routes.js:19)
- GET /fitment/brands (services/api/src/modules/fitment/routes.js:62)
- GET /fitment/brands/:brandId/models (services/api/src/modules/fitment/routes.js:74)
- GET /fitment/generations/:generationId (services/api/src/modules/fitment/routes.js:1111)
- GET /fitment/generations/:generationId/engines (services/api/src/modules/fitment/routes.js:100)
- GET /fitment/generations/:generationId/transmissions (services/api/src/modules/fitment/routes.js:109)
- GET /fitment/generations/:generationId/versions (services/api/src/modules/fitment/routes.js:986)
- GET /fitment/makes (services/api/src/modules/fitment/routes.js:31)
- GET /fitment/models/:modelId/generations (services/api/src/modules/fitment/routes.js:88)
- GET /fitment/vehicles (services/api/src/modules/fitment/routes.js:40)
- GET /fitment/vin-decode/:vin (services/api/src/modules/fitment/routes.js:643)
- GET /h/:code (services/api/src/modules/hubCode/page.js:26)
- GET /hub/locations (services/api/src/modules/hub/routes.js:50)
- GET /p/:token (services/api/src/modules/deliveryProof/routes.js:107)
- GET /payment-methods/for-country/:countryCode (services/api/src/modules/paymentMethods/routes.js:84)
- GET /payment/methods (services/api/src/modules/payment/routes.js:68)
- GET /platform-settings/announcements (services/api/src/modules/platform-settings/routes.js:92)
- GET /platform-settings/footer (services/api/src/modules/platform-settings/footer.js:110)
- GET /platform-settings/footer/pages/:key (services/api/src/modules/platform-settings/footer.js:180)
- GET /platform-settings/free-shipping (services/api/src/modules/platform-settings/freeShipping.js:24)
- GET /platform-settings/home-banner (services/api/src/modules/platform-settings/homeBanner.js:103)
- GET /platform-settings/home-pictures (services/api/src/modules/platform-settings/homePictures.js:56)
- GET /platform-settings/home-text (services/api/src/modules/platform-settings/homeText.js:49)
- GET /pricing/display-rates (services/api/src/modules/pricing/routes.js:260)
- GET /pricing/loyalty-tiers (services/api/src/modules/pricing/routes.js:285)
- GET /proof/:token (services/api/src/modules/deliveryProof/routes.js:49)
- GET /quotations/public/:code (services/api/src/modules/quotations/routes.js:110)
- GET /reset-password (services/api/src/modules/auth/resetPageRoutes.js:6)

## Every route

| Method | Route | Who | File |
|---|---|---|---|
| GET | /addresses/me | auth | services/api/src/modules/addresses/routes.js:37 |
| POST | /addresses/me | auth | services/api/src/modules/addresses/routes.js:49 |
| DELETE | /addresses/me/:id | auth | services/api/src/modules/addresses/routes.js:137 |
| PATCH | /addresses/me/:id | auth | services/api/src/modules/addresses/routes.js:97 |
| GET | /admin-counts | role | services/api/src/modules/adminCounts/routes.js:16 |
| GET | /admin-users | role | services/api/src/modules/admin-users/routes.js:42 |
| POST | /admin-users | role | services/api/src/modules/admin-users/routes.js:56 |
| DELETE | /admin-users/:id | role | services/api/src/modules/admin-users/routes.js:141 |
| PATCH | /admin-users/:id/permissions | role | services/api/src/modules/admin-users/routes.js:105 |
| GET | /admin/audit-log | role | services/api/src/modules/audit/routes.js:31 |
| GET | /admin/discount-hold/events | role | services/api/src/modules/discountHold/routes.js:23 |
| GET | /admin/discount-hold/rules | role | services/api/src/modules/discountHold/routes.js:12 |
| PUT | /admin/discount-hold/rules | role | services/api/src/modules/discountHold/routes.js:15 |
| POST | /admin/price-drop-alerts/check | role | services/api/src/modules/priceDropAlerts/routes.js:14 |
| POST | /admin/saved-searches/check | role | services/api/src/modules/savedSearches/adminRoutes.js:13 |
| GET | /admin/search | role | services/api/src/modules/search/routes.js:25 |
| POST | /admin/supplier-digest/check | role | services/api/src/modules/supplierDigest/routes.js:13 |
| POST | /auth/2fa/confirm | auth | services/api/src/modules/auth/routes.js:334 |
| POST | /auth/2fa/disable | auth | services/api/src/modules/auth/routes.js:368 |
| POST | /auth/2fa/setup | auth | services/api/src/modules/auth/routes.js:310 |
| POST | /auth/forgot-password | public | services/api/src/modules/auth/routes.js:413 |
| POST | /auth/login | public | services/api/src/modules/auth/routes.js:105 |
| POST | /auth/login/2fa | public | services/api/src/modules/auth/routes.js:164 |
| GET | /auth/me | auth | services/api/src/modules/auth/routes.js:207 |
| PATCH | /auth/me/avatar | auth | services/api/src/modules/auth/routes.js:247 |
| POST | /auth/me/delete | auth | services/api/src/modules/auth/routes.js:271 |
| PATCH | /auth/me/email | auth | services/api/src/modules/auth/routes.js:506 |
| PATCH | /auth/me/password | auth | services/api/src/modules/auth/routes.js:222 |
| POST | /auth/reset-password | public | services/api/src/modules/auth/routes.js:465 |
| POST | /auth/signup | public | services/api/src/modules/auth/routes.js:40 |
| POST | /bug-reports | optional | services/api/src/modules/bugReports/routes.js:13 |
| GET | /cart/:cartId | optional | services/api/src/modules/cart/routes.js:312 |
| POST | /cart/:cartId/items | optional | services/api/src/modules/cart/routes.js:452 |
| DELETE | /cart/:cartId/items/:productId | optional | services/api/src/modules/cart/routes.js:517 |
| PATCH | /cart/:cartId/items/:productId | optional | services/api/src/modules/cart/routes.js:485 |
| POST | /cart/:cartId/lock-prices | optional | services/api/src/modules/cart/routes.js:330 |
| PATCH | /cart/:cartId/promo-code | optional | services/api/src/modules/cart/routes.js:381 |
| GET | /catalog/admin/categories | role | services/api/src/modules/catalogImport/routes.js:160 |
| PATCH | /catalog/admin/categories/:id | role | services/api/src/modules/catalogImport/routes.js:217 |
| GET | /catalog/admin/categories/:id/in-use | role | services/api/src/modules/catalog/categoryRemove.js:76 |
| GET | /catalog/admin/categories/:id/parts | role | services/api/src/modules/catalogImport/routes.js:166 |
| POST | /catalog/admin/categories/:id/remove | role | services/api/src/modules/catalog/categoryRemove.js:91 |
| POST | /catalog/admin/cleanup/commit | role | services/api/src/modules/catalogImport/routes.js:188 |
| GET | /catalog/admin/cleanup/preview | role | services/api/src/modules/catalogImport/routes.js:174 |
| POST | /catalog/admin/discount-rules | role | services/api/src/modules/catalog/routes.js:1707 |
| DELETE | /catalog/admin/discount-rules/:id | role | services/api/src/modules/catalog/routes.js:1767 |
| PATCH | /catalog/admin/discount-rules/:id | role | services/api/src/modules/catalog/routes.js:1736 |
| GET | /catalog/admin/health | role | services/api/src/modules/catalogImport/routes.js:207 |
| GET | /catalog/admin/import/batches | role | services/api/src/modules/catalogImport/routes.js:126 |
| POST | /catalog/admin/import/batches/:id/undo | role | services/api/src/modules/catalogImport/routes.js:134 |
| POST | /catalog/admin/import/commit | role | services/api/src/modules/catalogImport/routes.js:86 |
| POST | /catalog/admin/import/preview | role | services/api/src/modules/catalogImport/routes.js:74 |
| GET | /catalog/admin/import/template | role | services/api/src/modules/catalogImport/routes.js:32 |
| PATCH | /catalog/admin/parts/:id | role | services/api/src/modules/catalogImport/routes.js:224 |
| GET | /catalog/admin/parts/:id/in-use | role | services/api/src/modules/catalog/categoryRemove.js:76 |
| POST | /catalog/admin/parts/:id/remove | role | services/api/src/modules/catalog/categoryRemove.js:91 |
| POST | /catalog/admin/parts/review | role | services/api/src/modules/catalogImport/routes.js:231 |
| GET | /catalog/admin/photos/batches | role | services/api/src/modules/catalogPhotos/routes.js:44 |
| POST | /catalog/admin/photos/batches/:id/undo | role | services/api/src/modules/catalogPhotos/routes.js:45 |
| GET | /catalog/admin/photos/coverage | role | services/api/src/modules/catalogPhotos/routes.js:17 |
| POST | /catalog/admin/photos/import | role | services/api/src/modules/catalogPhotos/routes.js:29 |
| GET | /catalog/admin/photos/settings | role | services/api/src/modules/catalogPhotos/routes.js:55 |
| PUT | /catalog/admin/photos/settings | role | services/api/src/modules/catalogPhotos/routes.js:56 |
| GET | /catalog/admin/photos/shot-list.xlsx | role | services/api/src/modules/catalogPhotos/routes.js:19 |
| PATCH | /catalog/admin/product-requirements | role | services/api/src/modules/catalog/routes.js:1560 |
| GET | /catalog/admin/products | role | services/api/src/modules/catalog/routes.js:1084 |
| GET | /catalog/admin/products/:id | role | services/api/src/modules/catalog/routes.js:1193 |
| PATCH | /catalog/admin/products/:id | role | services/api/src/modules/catalog/routes.js:1256 |
| POST | /catalog/admin/products/delete | role | services/api/src/modules/catalog/productDelete.js:148 |
| POST | /catalog/admin/products/delete-check | role | services/api/src/modules/catalog/productDelete.js:140 |
| POST | /catalog/admin/products/send-to-review | role | services/api/src/modules/catalog/productDelete.js:176 |
| GET | /catalog/attribute-definitions | public | services/api/src/modules/catalog/routes.js:1636 |
| GET | /catalog/categories | public | services/api/src/modules/catalog/routes.js:1520 |
| POST | /catalog/categories | role | services/api/src/modules/catalog/routes.js:1800 |
| DELETE | /catalog/categories/:id | role | services/api/src/modules/catalog/routes.js:1876 |
| PATCH | /catalog/categories/:id | role | services/api/src/modules/catalog/routes.js:1830 |
| PATCH | /catalog/categories/:id/commission | role | services/api/src/modules/catalog/routes.js:1781 |
| POST | /catalog/categories/:id/move | role | services/api/src/modules/catalog/routes.js:1860 |
| GET | /catalog/categories/:id/parts | public | services/api/src/modules/catalog/routes.js:1904 |
| POST | /catalog/categories/:id/parts | role | services/api/src/modules/catalog/routes.js:1913 |
| PATCH | /catalog/categories/:id/photo | role | services/api/src/modules/catalog/routes.js:1844 |
| GET | /catalog/discount-rules | public | services/api/src/modules/catalog/routes.js:1654 |
| GET | /catalog/moderation-queue | role | services/api/src/modules/catalog/routes.js:816 |
| DELETE | /catalog/parts/:id | role | services/api/src/modules/catalog/routes.js:1949 |
| PATCH | /catalog/parts/:id | role | services/api/src/modules/catalog/routes.js:1975 |
| POST | /catalog/parts/:id/move | role | services/api/src/modules/catalog/routes.js:2027 |
| PATCH | /catalog/parts/:id/photo | role | services/api/src/modules/catalog/routes.js:2012 |
| GET | /catalog/product-requirements | public | services/api/src/modules/catalog/routes.js:1551 |
| GET | /catalog/products | public | services/api/src/modules/catalog/routes.js:454 |
| GET | /catalog/products/:id | public | services/api/src/modules/catalog/routes.js:542 |
| GET | /catalog/products/:id/alternatives | public | services/api/src/modules/catalog/routes.js:583 |
| PATCH | /catalog/products/:id/moderate | role | services/api/src/modules/catalog/routes.js:864 |
| GET | /catalog/products/:id/oem-alternatives | public | services/api/src/modules/catalog/routes.js:639 |
| GET | /catalog/products/:id/reviews | public | services/api/src/modules/catalog/routes.js:772 |
| GET | /catalog/products/:id/same-brand | public | services/api/src/modules/catalog/routes.js:676 |
| GET | /catalog/products/:id/same-model | public | services/api/src/modules/catalog/routes.js:731 |
| POST | /catalog/products/bulk-moderate | role | services/api/src/modules/catalog/routes.js:961 |
| GET | /catalog/search-autocomplete | public | services/api/src/modules/catalog/routes.js:1484 |
| GET | /catalog/stats | public | services/api/src/modules/catalog/routes.js:30 |
| GET | /catalog/trending-searches | public | services/api/src/modules/catalog/routes.js:1503 |
| GET | /config/markets | public | services/api/src/modules/config/routes.js:11 |
| GET | /config/markets/:countryCode | public | services/api/src/modules/config/routes.js:19 |
| GET | /delivery-rules | role | services/api/src/modules/deliveryRules/routes.js:205 |
| POST | /delivery-rules | role | services/api/src/modules/deliveryRules/routes.js:220 |
| DELETE | /delivery-rules/:id | role | services/api/src/modules/deliveryRules/routes.js:279 |
| PATCH | /delivery-rules/:id | role | services/api/src/modules/deliveryRules/routes.js:244 |
| GET | /delivery-rules/countries | role | services/api/src/modules/deliveryRules/routes.js:103 |
| GET | /delivery-rules/country-groups | role | services/api/src/modules/deliveryRules/routes.js:128 |
| POST | /delivery-rules/country-groups | role | services/api/src/modules/deliveryRules/routes.js:142 |
| DELETE | /delivery-rules/country-groups/:id | role | services/api/src/modules/deliveryRules/routes.js:156 |
| POST | /delivery-rules/country-groups/:id/members | role | services/api/src/modules/deliveryRules/routes.js:171 |
| DELETE | /delivery-rules/country-groups/:id/members/:isoCode | role | services/api/src/modules/deliveryRules/routes.js:190 |
| POST | /delivery-rules/preview | role | services/api/src/modules/deliveryRules/routes.js:90 |
| POST | /delivery-rules/reorder | role | services/api/src/modules/deliveryRules/routes.js:294 |
| GET | /delivery-rules/settings | role | services/api/src/modules/deliveryRules/routes.js:82 |
| PUT | /delivery-rules/settings | role | services/api/src/modules/deliveryRules/routes.js:85 |
| GET | /delivery-rules/warehouse-countries | role | services/api/src/modules/deliveryRules/routes.js:114 |
| POST | /fault-cases | role | services/api/src/modules/faultCases/routes.js:92 |
| POST | /fault-cases/:id/close | role | services/api/src/modules/faultCases/routes.js:130 |
| POST | /fault-cases/:id/confirm-refund | role | services/api/src/modules/faultCases/routes.js:102 |
| POST | /fault-cases/:id/confirm-replacement | role | services/api/src/modules/faultCases/routes.js:111 |
| POST | /fault-cases/:id/mark-refunded | role | services/api/src/modules/faultCases/routes.js:137 |
| POST | /fault-cases/:id/release-supplier-payment | role | services/api/src/modules/faultCases/routes.js:120 |
| GET | /fault-cases/supplier/me | role | services/api/src/modules/faultCases/routes.js:53 |
| POST | /fault-cases/supplier/me/:id/answer | role | services/api/src/modules/faultCases/routes.js:81 |
| GET | /fitment/brands | public | services/api/src/modules/fitment/routes.js:62 |
| POST | /fitment/brands | role | services/api/src/modules/fitment/routes.js:146 |
| GET | /fitment/brands/:brandId/models | public | services/api/src/modules/fitment/routes.js:74 |
| POST | /fitment/brands/:brandId/models | role | services/api/src/modules/fitment/routes.js:242 |
| DELETE | /fitment/brands/:id | role | services/api/src/modules/fitment/routes.js:226 |
| PATCH | /fitment/brands/:id | role | services/api/src/modules/fitment/routes.js:179 |
| POST | /fitment/brands/:id/move | role | services/api/src/modules/fitment/routes.js:212 |
| PATCH | /fitment/brands/:id/photo | role | services/api/src/modules/fitment/routes.js:196 |
| POST | /fitment/catalog-image | role | services/api/src/modules/fitment/routes.js:956 |
| DELETE | /fitment/engines/:id | role | services/api/src/modules/fitment/routes.js:500 |
| PATCH | /fitment/engines/:id | role | services/api/src/modules/fitment/routes.js:486 |
| POST | /fitment/engines/:id/move | role | services/api/src/modules/fitment/routes.js:470 |
| GET | /fitment/export | role | services/api/src/modules/fitment/routes.js:1092 |
| GET | /fitment/generations/:generationId | public | services/api/src/modules/fitment/routes.js:1111 |
| GET | /fitment/generations/:generationId/engines | public | services/api/src/modules/fitment/routes.js:100 |
| POST | /fitment/generations/:generationId/engines | role | services/api/src/modules/fitment/routes.js:452 |
| GET | /fitment/generations/:generationId/transmissions | public | services/api/src/modules/fitment/routes.js:109 |
| POST | /fitment/generations/:generationId/transmissions | role | services/api/src/modules/fitment/routes.js:516 |
| GET | /fitment/generations/:generationId/versions | public | services/api/src/modules/fitment/routes.js:986 |
| POST | /fitment/generations/:generationId/versions | role | services/api/src/modules/fitment/routes.js:995 |
| DELETE | /fitment/generations/:id | role | services/api/src/modules/fitment/routes.js:436 |
| PATCH | /fitment/generations/:id | role | services/api/src/modules/fitment/routes.js:403 |
| POST | /fitment/generations/:id/move | role | services/api/src/modules/fitment/routes.js:387 |
| PATCH | /fitment/generations/:id/photo | role | services/api/src/modules/fitment/routes.js:422 |
| POST | /fitment/import/commit | role | services/api/src/modules/vehicleImport/routes.js:80 |
| POST | /fitment/import/preview | role | services/api/src/modules/vehicleImport/routes.js:69 |
| GET | /fitment/import/template | role | services/api/src/modules/vehicleImport/routes.js:22 |
| GET | /fitment/import/unused-pictures | role | services/api/src/modules/vehicleImport/routes.js:113 |
| POST | /fitment/import/unused-pictures/remove | role | services/api/src/modules/vehicleImport/routes.js:116 |
| GET | /fitment/makes | public | services/api/src/modules/fitment/routes.js:31 |
| DELETE | /fitment/models/:id | role | services/api/src/modules/fitment/routes.js:314 |
| PATCH | /fitment/models/:id | role | services/api/src/modules/fitment/routes.js:267 |
| POST | /fitment/models/:id/move | role | services/api/src/modules/fitment/routes.js:298 |
| PATCH | /fitment/models/:id/photo | role | services/api/src/modules/fitment/routes.js:283 |
| GET | /fitment/models/:modelId/generations | public | services/api/src/modules/fitment/routes.js:88 |
| POST | /fitment/models/:modelId/generations | role | services/api/src/modules/fitment/routes.js:340 |
| DELETE | /fitment/transmissions/:id | role | services/api/src/modules/fitment/routes.js:566 |
| PATCH | /fitment/transmissions/:id | role | services/api/src/modules/fitment/routes.js:552 |
| POST | /fitment/transmissions/:id/move | role | services/api/src/modules/fitment/routes.js:534 |
| GET | /fitment/vehicles | public | services/api/src/modules/fitment/routes.js:40 |
| DELETE | /fitment/versions/:id | role | services/api/src/modules/fitment/routes.js:1050 |
| PATCH | /fitment/versions/:id | role | services/api/src/modules/fitment/routes.js:1019 |
| PATCH | /fitment/versions/:id/photo | role | services/api/src/modules/fitment/routes.js:1037 |
| GET | /fitment/vin-decode/:vin | public | services/api/src/modules/fitment/routes.js:643 |
| GET | /fitment/vin-model-patterns | role | services/api/src/modules/fitment/routes.js:783 |
| POST | /fitment/vin-model-patterns | role | services/api/src/modules/fitment/routes.js:798 |
| DELETE | /fitment/vin-model-patterns/:prefix | role | services/api/src/modules/fitment/routes.js:825 |
| POST | /fitment/vin-model-patterns/bulk-upload | role | services/api/src/modules/fitment/routes.js:855 |
| POST | /fitment/vin-model-patterns/resolve-conflict | role | services/api/src/modules/fitment/routes.js:912 |
| GET | /fitment/vin-wmi-codes | role | services/api/src/modules/fitment/routes.js:733 |
| POST | /fitment/vin-wmi-codes | role | services/api/src/modules/fitment/routes.js:742 |
| DELETE | /fitment/vin-wmi-codes/:wmiPrefix | role | services/api/src/modules/fitment/routes.js:764 |
| GET | /garage/me | auth | services/api/src/modules/garage/routes.js:82 |
| POST | /garage/me | auth | services/api/src/modules/garage/routes.js:99 |
| DELETE | /garage/me/:generationId/:year | auth | services/api/src/modules/garage/routes.js:198 |
| PATCH | /garage/me/:generationId/:year/default | auth | services/api/src/modules/garage/routes.js:160 |
| PATCH | /garage/me/:generationId/:year/version | auth | services/api/src/modules/garage/routes.js:230 |
| GET | /h/:code | public | services/api/src/modules/hubCode/page.js:26 |
| GET | /hub-staff | role | services/api/src/modules/hub-staff/routes.js:79 |
| POST | /hub-staff | role | services/api/src/modules/hub-staff/routes.js:90 |
| PATCH | /hub-staff/:id | role | services/api/src/modules/hub-staff/routes.js:119 |
| POST | /hub-staff/:id/disable | role | services/api/src/modules/hub-staff/routes.js:163 |
| POST | /hub-staff/:id/enable | role | services/api/src/modules/hub-staff/routes.js:164 |
| POST | /hub-staff/:id/reset-password | role | services/api/src/modules/hub-staff/routes.js:168 |
| PATCH | /hub/assign/:subOrderId | role | services/api/src/modules/hub/routes.js:333 |
| GET | /hub/flagged | role | services/api/src/modules/hub/routes.js:357 |
| PATCH | /hub/flagged/:id/resolve | role | services/api/src/modules/hub/routes.js:236 |
| GET | /hub/locations | public | services/api/src/modules/hub/routes.js:50 |
| POST | /hub/locations | role | services/api/src/modules/hub/routes.js:59 |
| DELETE | /hub/locations/:id | role | services/api/src/modules/hub/routes.js:96 |
| PATCH | /hub/locations/:id | role | services/api/src/modules/hub/routes.js:81 |
| GET | /hub/me/shipments | role | services/api/src/modules/hub/routes.js:440 |
| GET | /hub/me/shipments/:id | role | services/api/src/modules/hub/routes.js:474 |
| GET | /hub/me/shipments/:id/address-label | role | services/api/src/modules/hub/routes.js:596 |
| PATCH | /hub/me/shipments/:id/confirm-delivery | role | services/api/src/modules/hub/routes.js:921 |
| POST | /hub/me/shipments/:id/draft-photos/${action} | role | services/api/src/modules/hub/routes.js:705 |
| POST | /hub/me/shipments/:id/events | role | services/api/src/modules/hub/routes.js:735 |
| PUT | /hub/me/shipments/:id/items/:productId/checks | role | services/api/src/modules/hub/routes.js:719 |
| PATCH | /hub/me/shipments/:id/items/:productId/received | role | services/api/src/modules/hub/routes.js:682 |
| GET | /hub/performance | role | services/api/src/modules/hub/routes.js:171 |
| GET | /hub/workload | role | services/api/src/modules/hub/routes.js:117 |
| DELETE | /loyalty-tier-photos/:id | role | services/api/src/modules/loyalty/tierPhotos.js:46 |
| PUT | /loyalty-tier-photos/:id | role | services/api/src/modules/loyalty/tierPhotos.js:26 |
| GET | /loyalty/me | auth | services/api/src/modules/loyalty/routes.js:13 |
| GET | /notifications/me | auth | services/api/src/modules/notifications/routes.js:40 |
| PATCH | /notifications/me/:id/read | auth | services/api/src/modules/notifications/routes.js:70 |
| PATCH | /notifications/me/read-all | auth | services/api/src/modules/notifications/routes.js:83 |
| GET | /notifications/me/unread-count | auth | services/api/src/modules/notifications/routes.js:57 |
| DELETE | /notifications/register-device | auth | services/api/src/modules/push/routes.js:37 |
| POST | /notifications/register-device | auth | services/api/src/modules/push/routes.js:15 |
| GET | /order | role | services/api/src/modules/order/routes.js:863 |
| POST | /order | public | services/api/src/modules/order/routes.js:90 |
| GET | /order/:id | role | services/api/src/modules/order/routes.js:558 |
| PATCH | /order/:id/address | optional | services/api/src/modules/order/routes.js:1187 |
| PUT | /order/:id/address-english | role | services/api/src/modules/order/routes.js:1226 |
| PUT | /order/:id/address-english/confirm | optional | services/api/src/modules/order/routes.js:1242 |
| POST | /order/:id/cancel | optional | services/api/src/modules/order/routes.js:1055 |
| GET | /order/:id/receipt | optional | services/api/src/modules/order/routes.js:1289 |
| POST | /order/:id/sub-orders/:subOrderId/cancel | optional | services/api/src/modules/order/routes.js:1117 |
| GET | /order/:id/tracking | optional | services/api/src/modules/order/routes.js:1372 |
| GET | /order/me/annual-summary | auth | services/api/src/modules/order/routes.js:537 |
| GET | /overview | role | services/api/src/modules/overview/routes.js:30 |
| GET | /p/:token | public | services/api/src/modules/deliveryProof/routes.js:107 |
| GET | /parcel-costs | role | services/api/src/modules/parcelCosts/routes.js:28 |
| POST | /parcel-costs/:id/${path} | role | services/api/src/modules/parcelCosts/routes.js:33 |
| GET | /parcel-costs/hub/:shipmentId | role | services/api/src/modules/parcelCosts/routes.js:19 |
| POST | /parcel-costs/hub/:shipmentId | role | services/api/src/modules/parcelCosts/routes.js:23 |
| GET | /payment-methods | role | services/api/src/modules/paymentMethods/routes.js:65 |
| POST | /payment-methods | role | services/api/src/modules/paymentMethods/routes.js:103 |
| DELETE | /payment-methods/:id | role | services/api/src/modules/paymentMethods/routes.js:253 |
| PATCH | /payment-methods/:id | role | services/api/src/modules/paymentMethods/routes.js:126 |
| PATCH | /payment-methods/:id/active | role | services/api/src/modules/paymentMethods/routes.js:159 |
| POST | /payment-methods/:id/countries-bulk | role | services/api/src/modules/paymentMethods/routes.js:198 |
| DELETE | /payment-methods/:id/countries/:countryCode | role | services/api/src/modules/paymentMethods/routes.js:240 |
| POST | /payment-methods/:id/countries/:countryCode | role | services/api/src/modules/paymentMethods/routes.js:223 |
| POST | /payment-methods/:id/move | role | services/api/src/modules/paymentMethods/routes.js:174 |
| PATCH | /payment-methods/:id/photo | role | services/api/src/modules/paymentMethods/routes.js:143 |
| GET | /payment-methods/available-countries | role | services/api/src/modules/paymentMethods/routes.js:51 |
| GET | /payment-methods/available-providers | role | services/api/src/modules/paymentMethods/routes.js:59 |
| GET | /payment-methods/for-country/:countryCode | public | services/api/src/modules/paymentMethods/routes.js:84 |
| GET | /payment-providers | role | services/api/src/modules/paymentProviders/routes.js:56 |
| DELETE | /payment-providers/:providerId | role | services/api/src/modules/paymentProviders/routes.js:124 |
| PUT | /payment-providers/:providerId | role | services/api/src/modules/paymentProviders/routes.js:90 |
| POST | /payment/intent | public | services/api/src/modules/payment/routes.js:76 |
| GET | /payment/methods | public | services/api/src/modules/payment/routes.js:68 |
| POST | /payment/paypal/capture/:orderId | public | services/api/src/modules/payment/routes.js:167 |
| GET | /payouts | role | services/api/src/modules/payouts/routes.js:119 |
| POST | /payouts | role | services/api/src/modules/payouts/routes.js:147 |
| GET | /payouts/owed | role | services/api/src/modules/payouts/routes.js:42 |
| GET | /payouts/owed/:supplierId | role | services/api/src/modules/payouts/routes.js:76 |
| GET | /payouts/terms/:supplierId | role | services/api/src/modules/payouts/routes.js:93 |
| PUT | /payouts/terms/:supplierId | role | services/api/src/modules/payouts/routes.js:103 |
| GET | /platform-settings/announcements | public | services/api/src/modules/platform-settings/routes.js:92 |
| PATCH | /platform-settings/announcements | role | services/api/src/modules/platform-settings/routes.js:101 |
| GET | /platform-settings/footer | public | services/api/src/modules/platform-settings/footer.js:110 |
| GET | /platform-settings/footer/pages/:key | public | services/api/src/modules/platform-settings/footer.js:180 |
| PUT | /platform-settings/footer/pages/:key | role | services/api/src/modules/platform-settings/footer.js:188 |
| PUT | /platform-settings/footer/social | role | services/api/src/modules/platform-settings/footer.js:129 |
| DELETE | /platform-settings/footer/social/:id/icon | role | services/api/src/modules/platform-settings/footer.js:169 |
| PUT | /platform-settings/footer/social/:id/icon | role | services/api/src/modules/platform-settings/footer.js:150 |
| PUT | /platform-settings/footer/text | role | services/api/src/modules/platform-settings/footer.js:119 |
| GET | /platform-settings/free-shipping | public | services/api/src/modules/platform-settings/freeShipping.js:24 |
| PUT | /platform-settings/free-shipping | role | services/api/src/modules/platform-settings/freeShipping.js:30 |
| GET | /platform-settings/free-shipping/admin | role | services/api/src/modules/platform-settings/freeShipping.js:27 |
| GET | /platform-settings/home-banner | public | services/api/src/modules/platform-settings/homeBanner.js:103 |
| GET | /platform-settings/home-banner/admin | role | services/api/src/modules/platform-settings/homeBanner.js:112 |
| PUT | /platform-settings/home-banner/mode | role | services/api/src/modules/platform-settings/homeBanner.js:115 |
| PUT | /platform-settings/home-banner/order | role | services/api/src/modules/platform-settings/homeBanner.js:124 |
| POST | /platform-settings/home-banner/slides | role | services/api/src/modules/platform-settings/homeBanner.js:136 |
| DELETE | /platform-settings/home-banner/slides/:id | role | services/api/src/modules/platform-settings/homeBanner.js:167 |
| PUT | /platform-settings/home-banner/slides/:id | role | services/api/src/modules/platform-settings/homeBanner.js:150 |
| DELETE | /platform-settings/home-banner/slides/:id/image/:lang | role | services/api/src/modules/platform-settings/homeBanner.js:202 |
| PUT | /platform-settings/home-banner/slides/:id/image/:lang | role | services/api/src/modules/platform-settings/homeBanner.js:181 |
| GET | /platform-settings/home-pictures | public | services/api/src/modules/platform-settings/homePictures.js:56 |
| DELETE | /platform-settings/home-pictures/:slot | role | services/api/src/modules/platform-settings/homePictures.js:83 |
| PUT | /platform-settings/home-pictures/:slot | role | services/api/src/modules/platform-settings/homePictures.js:64 |
| GET | /platform-settings/home-text | public | services/api/src/modules/platform-settings/homeText.js:49 |
| PUT | /platform-settings/home-text | role | services/api/src/modules/platform-settings/homeText.js:58 |
| GET | /platform-settings/require-verified-purchase-for-reviews | role | services/api/src/modules/platform-settings/routes.js:63 |
| PATCH | /platform-settings/require-verified-purchase-for-reviews | role | services/api/src/modules/platform-settings/routes.js:72 |
| GET | /platform-settings/return-window | role | services/api/src/modules/platform-settings/routes.js:30 |
| PATCH | /platform-settings/return-window | role | services/api/src/modules/platform-settings/routes.js:42 |
| GET | /pricing/display-rates | public | services/api/src/modules/pricing/routes.js:260 |
| GET | /pricing/fee-components | role | services/api/src/modules/pricing/routes.js:33 |
| POST | /pricing/fee-components | role | services/api/src/modules/pricing/routes.js:42 |
| DELETE | /pricing/fee-components/:id | role | services/api/src/modules/pricing/routes.js:89 |
| PATCH | /pricing/fee-components/:id | role | services/api/src/modules/pricing/routes.js:64 |
| POST | /pricing/fee-components/:id/move | role | services/api/src/modules/pricing/routes.js:108 |
| GET | /pricing/fx-rate | role | services/api/src/modules/pricing/routes.js:161 |
| PATCH | /pricing/fx-rate | role | services/api/src/modules/pricing/routes.js:173 |
| GET | /pricing/fx-rate-mode | role | services/api/src/modules/pricing/routes.js:206 |
| PATCH | /pricing/fx-rate-mode | role | services/api/src/modules/pricing/routes.js:215 |
| GET | /pricing/loyalty-tiers | public | services/api/src/modules/pricing/routes.js:285 |
| POST | /pricing/loyalty-tiers | role | services/api/src/modules/pricing/routes.js:322 |
| DELETE | /pricing/loyalty-tiers/:id | role | services/api/src/modules/pricing/routes.js:359 |
| PATCH | /pricing/loyalty-tiers/:id | role | services/api/src/modules/pricing/routes.js:340 |
| POST | /pricing/preview | role | services/api/src/modules/pricing/routes.js:240 |
| GET | /profits | role | services/api/src/modules/profits/routes.js:10 |
| GET | /promo-codes | role | services/api/src/modules/promo-codes/routes.js:42 |
| POST | /promo-codes | role | services/api/src/modules/promo-codes/routes.js:57 |
| DELETE | /promo-codes/:code | role | services/api/src/modules/promo-codes/routes.js:120 |
| PATCH | /promo-codes/:code | role | services/api/src/modules/promo-codes/routes.js:91 |
| POST | /promo-codes/validate | optional | services/api/src/modules/promo-codes/routes.js:139 |
| GET | /proof/:token | public | services/api/src/modules/deliveryProof/routes.js:49 |
| POST | /proof/:token | public | services/api/src/modules/deliveryProof/routes.js:57 |
| POST | /proof/:token/attempt | public | services/api/src/modules/deliveryProof/routes.js:88 |
| POST | /quotations | auth | services/api/src/modules/quotations/routes.js:60 |
| GET | /quotations/admin | role | services/api/src/modules/quotations/routes.js:164 |
| POST | /quotations/fit-check | auth | services/api/src/modules/quotations/routes.js:52 |
| GET | /quotations/me | auth | services/api/src/modules/quotations/routes.js:69 |
| GET | /quotations/me/:id | auth | services/api/src/modules/quotations/routes.js:84 |
| POST | /quotations/me/:id/renew | auth | services/api/src/modules/quotations/routes.js:93 |
| GET | /quotations/public/:code | public | services/api/src/modules/quotations/routes.js:110 |
| POST | /quotations/public/:code/shares/:shareId | public | services/api/src/modules/quotations/routes.js:122 |
| GET | /quotations/supplier-settings | role | services/api/src/modules/quotations/routes.js:147 |
| PUT | /quotations/supplier-settings | role | services/api/src/modules/quotations/routes.js:154 |
| POST | /quote-requests | auth | services/api/src/modules/quote-requests/routes.js:110 |
| GET | /quote-requests/:id | auth | services/api/src/modules/quote-requests/routes.js:139 |
| POST | /quote-requests/:id/cancel | auth | services/api/src/modules/quote-requests/routes.js:252 |
| POST | /quote-requests/:id/items | auth | services/api/src/modules/quote-requests/routes.js:150 |
| DELETE | /quote-requests/:id/items/:itemId | auth | services/api/src/modules/quote-requests/routes.js:219 |
| PATCH | /quote-requests/:id/items/:itemId | auth | services/api/src/modules/quote-requests/routes.js:178 |
| POST | /quote-requests/:id/place-order | auth | services/api/src/modules/quote-requests/routes.js:274 |
| POST | /quote-requests/:id/submit | auth | services/api/src/modules/quote-requests/routes.js:236 |
| GET | /quote-requests/mine | auth | services/api/src/modules/quote-requests/routes.js:129 |
| GET | /quote-requests/supplier/:id | role | services/api/src/modules/quote-requests/routes.js:353 |
| POST | /quote-requests/supplier/:id/send-quote | role | services/api/src/modules/quote-requests/routes.js:373 |
| GET | /quote-requests/supplier/queue | role | services/api/src/modules/quote-requests/routes.js:331 |
| POST | /recently-viewed/:productId | auth | services/api/src/modules/recentlyViewed/routes.js:25 |
| GET | /recently-viewed/me | auth | services/api/src/modules/recentlyViewed/routes.js:44 |
| GET | /referrals/me | auth | services/api/src/modules/referrals/routes.js:12 |
| GET | /referrals/me/history | auth | services/api/src/modules/referrals/routes.js:36 |
| GET | /reset-password | public | services/api/src/modules/auth/resetPageRoutes.js:6 |
| GET | /returns | role | services/api/src/modules/returns/routes.js:293 |
| POST | /returns | optional | services/api/src/modules/returns/routes.js:63 |
| GET | /returns/:id | role | services/api/src/modules/returns/routes.js:302 |
| PATCH | /returns/:id | role | services/api/src/modules/returns/routes.js:360 |
| POST | /returns/:id/buyer-messages | role | services/api/src/modules/returns/routes.js:328 |
| POST | /returns/:id/supplier-messages | role | services/api/src/modules/returns/routes.js:344 |
| GET | /returns/my-cases | auth | services/api/src/modules/returns/routes.js:220 |
| GET | /returns/my-cases/:id | optional | services/api/src/modules/returns/routes.js:237 |
| POST | /returns/my-cases/:id/messages | optional | services/api/src/modules/returns/routes.js:266 |
| GET | /returns/supplier/me | role | services/api/src/modules/returns/routes.js:151 |
| GET | /returns/supplier/me/:id | role | services/api/src/modules/returns/routes.js:166 |
| POST | /returns/supplier/me/:id/messages | role | services/api/src/modules/returns/routes.js:190 |
| POST | /reviews | auth | services/api/src/modules/reviews/routes.js:88 |
| DELETE | /reviews/:id | auth | services/api/src/modules/reviews/routes.js:163 |
| POST | /reviews/:id/dismiss-flags | role | services/api/src/modules/reviews/routes.js:278 |
| POST | /reviews/:id/flag | auth | services/api/src/modules/reviews/routes.js:222 |
| PATCH | /reviews/:id/moderate | role | services/api/src/modules/reviews/routes.js:195 |
| GET | /reviews/flagged | role | services/api/src/modules/reviews/routes.js:246 |
| GET | /reviews/me | auth | services/api/src/modules/reviews/routes.js:152 |
| GET | /reviews/pending | role | services/api/src/modules/reviews/routes.js:175 |
| GET | /saved-searches/me | auth | services/api/src/modules/savedSearches/routes.js:22 |
| POST | /saved-searches/me | auth | services/api/src/modules/savedSearches/routes.js:34 |
| DELETE | /saved-searches/me/:id | auth | services/api/src/modules/savedSearches/routes.js:56 |
| GET | /supplier | role | services/api/src/modules/supplier/routes.js:57 |
| GET | /supplier-counts/me | role | services/api/src/modules/supplierCounts/routes.js:9 |
| POST | /supplier-counts/me/messages-read | role | services/api/src/modules/supplierCounts/routes.js:13 |
| GET | /supplier-messages/admin | role | services/api/src/modules/supplier-messages/routes.js:77 |
| GET | /supplier-messages/admin/:supplierId | role | services/api/src/modules/supplier-messages/routes.js:102 |
| POST | /supplier-messages/admin/:supplierId | role | services/api/src/modules/supplier-messages/routes.js:116 |
| GET | /supplier-messages/me | role | services/api/src/modules/supplier-messages/routes.js:49 |
| POST | /supplier-messages/me | role | services/api/src/modules/supplier-messages/routes.js:61 |
| GET | /supplier-responses | role | services/api/src/modules/orderResponse/routes.js:43 |
| GET | /supplier-responses/:subOrderId/alternatives | role | services/api/src/modules/orderResponse/routes.js:94 |
| GET | /supplier-responses/:subOrderId/candidates | role | services/api/src/modules/orderResponse/routes.js:64 |
| POST | /supplier-responses/:subOrderId/handled | role | services/api/src/modules/orderResponse/routes.js:97 |
| GET | /supplier-responses/:subOrderId/history | role | services/api/src/modules/orderResponse/routes.js:60 |
| POST | /supplier-responses/:subOrderId/move | role | services/api/src/modules/orderResponse/routes.js:86 |
| POST | /supplier-responses/:subOrderId/reassign | role | services/api/src/modules/orderResponse/routes.js:101 |
| POST | /supplier-responses/:subOrderId/refunded | role | services/api/src/modules/orderResponse/routes.js:77 |
| POST | /supplier-responses/:subOrderId/resend | role | services/api/src/modules/orderResponse/routes.js:68 |
| GET | /supplier-responses/no-answer-rules | role | services/api/src/modules/orderResponse/routes.js:49 |
| PUT | /supplier-responses/no-answer-rules | role | services/api/src/modules/orderResponse/routes.js:52 |
| GET | /supplier-responses/reasons | role | services/api/src/modules/orderResponse/routes.js:46 |
| GET | /supplier-responses/waiting-orders | role | services/api/src/modules/orderResponse/routes.js:56 |
| GET | /supplier/:id | role | services/api/src/modules/supplier/routes.js:250 |
| GET | /supplier/:id/analytics | role | services/api/src/modules/supplier/routes.js:134 |
| PATCH | /supplier/:id/country | role | services/api/src/modules/supplier/routes.js:110 |
| GET | /supplier/:id/payout-method | role | services/api/src/modules/supplier/routes.js:374 |
| GET | /supplier/:id/return-address | role | services/api/src/modules/supplier/routes.js:346 |
| PUT | /supplier/:id/return-address | role | services/api/src/modules/supplier/routes.js:356 |
| PATCH | /supplier/:id/verify | role | services/api/src/modules/supplier/routes.js:82 |
| GET | /supplier/me | role | services/api/src/modules/supplier/routes.js:222 |
| GET | /supplier/me/finance | role | services/api/src/modules/supplier/routes.js:283 |
| GET | /supplier/me/orders | role | services/api/src/modules/supplier/routes.js:1133 |
| PATCH | /supplier/me/orders/:subOrderId | role | services/api/src/modules/supplier/routes.js:1202 |
| POST | /supplier/me/orders/:subOrderId/accept | role | services/api/src/modules/orderResponse/routes.js:21 |
| POST | /supplier/me/orders/:subOrderId/refuse | role | services/api/src/modules/orderResponse/routes.js:29 |
| GET | /supplier/me/overview | role | services/api/src/modules/supplier/routes.js:1327 |
| GET | /supplier/me/payout-method | role | services/api/src/modules/supplier/routes.js:295 |
| PUT | /supplier/me/payout-method | role | services/api/src/modules/supplier/routes.js:305 |
| GET | /supplier/me/products | role | services/api/src/modules/supplier/routes.js:385 |
| POST | /supplier/me/products | role | services/api/src/modules/supplier/routes.js:410 |
| PATCH | /supplier/me/products/:id | role | services/api/src/modules/supplier/routes.js:1067 |
| PATCH | /supplier/me/products/:id/complete | role | services/api/src/modules/supplier/routes.js:840 |
| PATCH | /supplier/me/products/:id/resubmit | role | services/api/src/modules/supplier/routes.js:932 |
| POST | /supplier/me/products/bulk-import | role | services/api/src/modules/supplier/routes.js:654 |
| POST | /supplier/me/products/bulk-import/match | role | services/api/src/modules/supplier/routes.js:630 |
| PATCH | /supplier/me/products/bulk-price-update | role | services/api/src/modules/supplier/routes.js:989 |
| PATCH | /supplier/me/products/bulk-update | role | services/api/src/modules/supplier/routes.js:1022 |
| GET | /supplier/me/products/drafts | role | services/api/src/modules/supplier/routes.js:803 |
| GET | /supplier/me/products/export-fitment | role | services/api/src/modules/supplier/routes.js:771 |
| GET | /supplier/me/return-address | role | services/api/src/modules/supplier/routes.js:326 |
| PUT | /supplier/me/return-address | role | services/api/src/modules/supplier/routes.js:334 |
| GET | /support/my-tickets | auth | services/api/src/modules/support/routes.js:215 |
| GET | /support/my-tickets/:id | optional | services/api/src/modules/support/routes.js:234 |
| POST | /support/my-tickets/:id/feedback | optional | services/api/src/modules/support/routes.js:287 |
| POST | /support/my-tickets/:id/messages | optional | services/api/src/modules/support/routes.js:260 |
| GET | /support/tickets | role | services/api/src/modules/support/routes.js:78 |
| POST | /support/tickets | optional | services/api/src/modules/support/routes.js:45 |
| GET | /support/tickets/:id | role | services/api/src/modules/support/routes.js:88 |
| PATCH | /support/tickets/:id | role | services/api/src/modules/support/routes.js:185 |
| POST | /support/tickets/:id/messages | role | services/api/src/modules/support/routes.js:107 |
| POST | /support/tickets/for-order/:orderId | role | services/api/src/modules/support/routes.js:144 |
| POST | /uploads/product-image | role | services/api/src/modules/uploads/routes.js:58 |
| POST | /uploads/product-video | role | services/api/src/modules/uploads/routes.js:121 |
| GET | /user/:id | auth | services/api/src/modules/user/routes.js:59 |
| POST | /user/guest-claim | public | services/api/src/modules/user/routes.js:22 |
| POST | /webhooks/17track | public | services/api/src/modules/webhooks/routes.js:61 |
| GET | /wishlist/me | auth | services/api/src/modules/wishlist/routes.js:17 |
| DELETE | /wishlist/me/:productId | auth | services/api/src/modules/wishlist/routes.js:78 |
| GET | /wishlist/me/:productId | auth | services/api/src/modules/wishlist/routes.js:48 |
| POST | /wishlist/me/:productId | auth | services/api/src/modules/wishlist/routes.js:60 |

## Also run

- `npm audit` in services\api and each apps\* web folder (fix high and critical)
- `flutter pub outdated` in the apps
- OWASP ZAP "Automated Scan" on the storefront and http://localhost:4000
- Before launch: a penetration test by an outside company
