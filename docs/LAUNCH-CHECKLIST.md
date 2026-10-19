# Launch checklist

Two parts: what a **script can check** (run it, fix every `[FAIL]`), and what **only a person can do**.

## 1. Run the checker, on the server you are about to launch

```
cd services/api
node scripts/check-launch-readiness.js
```

It reads the server's settings and the database, **changes nothing**, and prints each problem with the exact fix:

- `[FAIL]` blocks going live (a security hole, or something customers would see break). Exit code 1.
- `[WARN]` should be dealt with soon, but will not hurt on day one.
- `[PASS]` is fine.

Run it **on the production server**, because it judges the settings it can see there. On your own computer it will, correctly, say "not ready".

What it covers: the secrets that sign logins and protect payment credentials; accounts still using a password that is written in the project files; leftover test admins, accounts, orders, products and hubs; invented review counts on the seed products; owners without two-factor; the public addresses emails link to (must be https and public); real email instead of the fake test inbox; live (not test) payment keys; the courier-tracking secret; push, photo storage and translation; and database migrations.

The server also **refuses to start in production** (`NODE_ENV=production`) on a missing, default or too-short `JWT_SECRET` or `CREDENTIALS_ENCRYPTION_KEY`, and without a database URL or Stripe key.

To clean test data (take a backup first; the tool prints the command): `node scripts/remove-test-data.js` previews, `--apply` does it.

## 2. What only a person can do

### Hosting and addresses
- [ ] A server for the backend (Node 20+) and a **managed PostgreSQL** with automatic daily backups.
- [ ] The three portals (admin, supplier, hub) built (`npm run build`) and served over **https**.
- [ ] A domain and a certificate (https everywhere, including the API). The apps' `API_BASE_URL` and `PUBLIC_API_URL` must be that https address, never a computer's IP.
- [ ] All secrets set as the server's environment variables, **not** committed to git. Never reuse the development values.

### Email (so password reset works)
- [ ] An email provider, and your sending domain verified: **SPF, DKIM and DMARC** records in your DNS. Without them, mail lands in spam.
- [ ] Send yourself a real test: `node scripts/send-test-email.js you@yourdomain.com both`, then do a real password reset.

### Money
- [ ] Live payment keys for at least one provider, and the provider's webhook pointed at the server.
- [ ] **One real small payment and one real refund**, end to end, before announcing anything.
- [ ] Decide who handles refunds, disputes and supplier payouts day to day, and how often payouts run.

### Accounts
- [ ] Every real person has **their own** account. Nobody shares the owner login.
- [ ] Two-factor on for the owner and every admin.
- [ ] The seeded accounts (`admin@leap.dev`, `supplier@leap.dev`, `hub@leap.dev`, `leap-supplier@leap.dev`) changed to strong passwords or removed.

### Backups and recovery
- [ ] Daily database backups **and a restore you have actually tried** on another machine. An untested backup is a hope, not a backup.
- [ ] Photos: either S3 storage, or the server's uploads folder backed up too.
- [ ] Written down: what you do if the server dies, and who can do it.

### Watching it run
- [ ] An uptime monitor on `https://<your api>/health` that messages you when it stops answering.
- [ ] Error logging you will actually read (for example Sentry), and server logs kept for a few weeks.

### The phone apps
- [ ] **Release signing.** Both apps are currently signed with the temporary *debug* key. Create a release keystore, keep it safe (lose it and you can never update the app) and sign with it.
- [ ] **The hub app is still called `com.example.leap_hub_mobile`** (Android) and `com.example.leapHubMobile` (iOS). Stores reject `com.example`. Change both to your own name, for example `com.leapautoparts.leap_hub`, **before** the first release, because it cannot be changed afterwards.
- [ ] Build both with the production address: `--dart-define=API_BASE_URL=https://<your api>`.
- [ ] Store accounts (Google Play; Apple Developer for iOS), listings, screenshots, a privacy policy address, and the data-safety / privacy answers each store asks for.
- [ ] Firebase set up (the service account in `FIREBASE_SERVICE_ACCOUNT_JSON`, the apps registered) if you want push notifications.

### Search engines (the public storefront only)
- [ ] The storefront is served publicly over **https**, and `NEXT_PUBLIC_SITE_URL` is that exact address (every canonical address and the sitemap use it).
- [ ] Registered in **Google Search Console** and **Bing Webmaster Tools**, and `/sitemap.xml` submitted. Check "Pages" a week later for pages that are excluded or not indexed.
- [ ] Test products, test categories and fake review counts are removed **before** the sitemap is submitted (the readiness checker lists them): they would be indexed.
- [ ] Open a few product pages in Google's [Rich Results Test](https://search.google.com/test/rich-results) to see the structured data is read.
- [ ] Every product's weight and size can be worked out (its own, or its part's): the checker's "can be priced" line. A product that cannot be priced is **hidden from buyers**, and so from search.
- [ ] The Arabic text in `apps/web-storefront/lib/i18n.ts` is read by a native speaker (the storefront serves Arabic under `/ar`, with its own address, canonical link and sitemap entries).
- [ ] `NEXT_PUBLIC_LEGAL_BASE_URL` points at where the legal pages really live (terms, delivery, refund, privacy, cancellation), and the announcement lines in `lib/i18n.ts` say what is true on launch day.
- [ ] **Decide how payment is collected.** Today neither the app nor the website collects payment online (the checkout only lists the payment methods for the country and places the order). Before real customers order, decide how orders get paid; online payment means new work in the apps and on the server.
- [ ] "Use my location" on the website calls OpenStreetMap's public service from the buyer's browser (as the app does from the phone). Check its usage rules against the expected volume, or put a geocoding service of your own behind it.
- [ ] The new Arabic texts in `apps/web-storefront/lib/i18n.ts` (the cart, checkout and address book) are read by a native speaker.
- [ ] The Arabic texts of the order pages (written for the web, not taken from the app) in `apps/web-storefront/lib/i18n.ts` are read by a native speaker.
- [ ] The return window (`return_window_days`, 7 by default) says what you promise buyers: the website's "Request a return" is shown on every part and the server decides.
- [ ] **Decide who reads bug reports.** The website's and the app's "Report a bug" save the report in the `bug_reports` table, and nothing in the admin dashboard shows it yet.
- [ ] The Arabic texts of the support, returns and bug report pages (written for the web, not taken from the app) in `apps/web-storefront/lib/i18n.ts` are read by a native speaker.
- [ ] Decide whether a guest's email should match a ticket or a return ignoring capitals, as it does for orders (a small server change in `services/api/src/modules/support` and `returns`).
- [ ] **The website runs on https in production.** The sign-in cookie is `Secure` only when the site is on https, and a sign-in over plain http can be read on the network.
- [ ] The password-reset email opens a page served by the BACKEND (`/reset-password?token=...`). Check how it looks and that it is in the language you want (it is not part of the new storefront look).
- [ ] The new Arabic texts of the account and sign-in pages (the ones written for the web, not taken from the app) in `apps/web-storefront/lib/i18n.ts` are read by a native speaker.
- [ ] **Part requests need someone to answer them.** A buyer's "request a quote" waits until Leap staff make and price each part through the supplier portal (as the Leap Supplier account); a quote is then valid for 7 days. Decide who watches that queue, and how fast, before buyers can use the page.
- [ ] The Arabic texts of My requests, referrals, notifications, saved searches and the wishlist that were written for the web are read by a native speaker.
- [ ] **Lazy loading and the website's own server.** The request limit (120 a minute per visitor) is kept in the server's memory and reads the visitor from `x-forwarded-for`: put the website behind a proxy that sets it, and remember that with several website server processes the limit is approximate.
- [ ] **The product list's order is now stable** (oldest first; the id breaks ties) for the website AND the mobile app; before, it had no order. Check you are happy with oldest-first as the default, or tell the developer which order buyers should see.
- [ ] **Restart the backend** after this change (the list cache and the stable order live there). `CATALOG_LIST_CACHE_MS` (default 60000, 0 = off) sets how long a scrolled list is shared; a price or stock change shows in later pages within that time.
- [ ] The first page of a product list is still computed in full on every request (about 0.6 s with 150 parts, and it grows with the catalog): plan real paging in the database before the catalog gets large.
- [ ] **Home page announcements.** Run the migration (`node db/migrate.js`, adds 105) and restart the backend. Open the admin portal > Settings > "Home page announcements" and write the real announcements (English required, Arabic recommended). They show on the home page only; a change appears within about 15 seconds. Check the Arabic text with a native speaker.
- [ ] Consider Google Merchant Center free listings (a product feed) and an Arabic version of the storefront: see `apps/web-storefront/README.md`, "SEO".

### Words and rules
- [ ] A **native Arabic speaker** reads every Arabic text (the buyer app, the emails, the reset page) before launch. The Chinese in the hub app too.
- [ ] Privacy policy, terms of sale, and a refund and returns policy, written for the countries you sell in. These need a person who knows that law; the code cannot supply them.
- [ ] Decide how long you keep personal data and how a customer asks for it to be deleted.

### The first day
- [ ] A smoke test in production with real accounts: sign up, order, pay, supplier ships, hub receives and inspects, ships to the buyer, the buyer sees it delivered. Plus one flagged parcel through the whole fault process.
- [ ] Hub staff shown how the app works (including the faulty-unit panel and choosing their own password).

## 3. Known gaps found while preparing this list (not fixed yet)

Honest list, so nothing is a surprise:

1. **Nothing limits repeated failed logins** (no lockout, no rate limit), so someone could guess passwords against the admin login for as long as they like. Two-factor helps a lot, which is why it is on the list above; a login limiter should still be added before launch.
2. **The server accepts requests from any website** (CORS is open) and sends no security headers (no `helmet`). Logins use a header, not cookies, which limits the harm, but in production the allowed websites should be only your own portals.
3. **The server will not start in production without `STRIPE_SECRET_KEY`**, even if you only use PayPal or Amazon Payment Services. The rule should be "at least one live provider".
4. **Server refusal messages are still in English** inside the Arabic app, and the price-drop, back-in-stock and saved-search emails are not translated yet.
5. **The hub web portal prints the return label; the hub phone app shows the supplier's address instead.**
6. **The QR scanner in the hub app** failed on one Huawei phone in a release build; a fix is in place (code shrinking turned off) but should be confirmed on the phones your hub staff really use.
