# Leap Auto Parts — Web Storefront

A real, public, search-engine-visible storefront — the piece the
mobile app alone couldn't provide. Built with Next.js (App Router)
specifically because it renders real, crawlable HTML on the server:
someone searching Google for a part lands on a real page with the
real product name, price, and description already in the HTML, not an
empty shell waiting for client-side JavaScript.

## Why this exists

The mobile app (`apps/mobile`) technically runs in a browser too (via
Flutter's web target), but it's a client-rendered, mobile-first app —
weak for search visibility and not built for wide desktop screens.
This is a separate, purpose-built app for exactly that gap: findable
on a computer, usable on a phone's browser, while the native app stays
the primary way to actually place an order.

## Status

**Phase 1 (this pass): browsing and product pages, the SEO-critical
surfaces.** Confirmed working — every page below was verified by
starting a real production build against the real backend and
directly inspecting the raw server-rendered HTML (not just "it loads
in a browser").

**Phase 2 (deliberately deferred): cart, checkout, and account.** Not
built yet — a real, separate, confirmed decision, not an oversight.
The current product page tells a visitor to use the mobile app to
actually place an order.

## Pages

- **`/`** — homepage: hero, real categories, most recently listed
  real products.
- **`/search`** — real, filterable browsing by category and search
  term (`?q=...&category=...`), a real server-rendered response per
  query so each filtered result is its own real, indexable URL.
- **`/products/[id]`** — a real product's own page, with real
  per-product SEO metadata (`generateMetadata`) built from that
  product's own real name and description — not a generic, repeated
  site-wide title on every page. Includes real reviews already
  submitted for that product.
- **`/sitemap.xml`** — a real, dynamic sitemap generated from the
  actual current product catalog every time it's requested, so every
  real product page is genuinely discoverable, not just the ones a
  crawler happens to stumble onto by following links.
- **`/robots.txt`** — points crawlers at the real sitemap above.

## Brand system — carried over, not reinvented

Since this is the same real product as the mobile app, not a
rebrand, every design token here is carried over exactly from
`apps/mobile/lib/core/theme.dart` (itself from
`docs/prototypes/leap_mobile_prototype.jsx`):

- **Colors** (`app/globals.css`): `ink`, `chalk`, `line`, `signal`,
  `signal-dark`, `torque`, `gauge`, `amber`, `muted` — the exact real
  hex values from the mobile app's own theme file.
- **Type**: Barlow Condensed for display/headlines (an industrial,
  gauge-cluster face — fitting for an auto parts catalog), Inter for
  body copy, JetBrains Mono for part numbers.
- **Signature element — the "plate chip"**: the license-plate-styled
  badge (`.plate-chip` in `globals.css`) used for real part
  numbers and real vehicle fitment tags, carried over directly from
  `apps/mobile/lib/widgets/plate_chip.dart`'s own header comment:
  "keep it consistent rather than reskinning per-screen."

## Real API integration

`lib/api.ts` is the only place this app talks to the backend —
plain, typed `fetch` calls (no client-side state library needed,
since every call runs inside a real React Server Component). Every
field in its TypeScript interfaces was verified directly against
`services/api/src/modules/catalog/routes.js`'s own real DTO-building
functions (`toBuyerProductDto`, `attachBuyerImages`,
`attachBuyerPrice`, `attachPrimaryFitment`, `toCategoryDto`) rather
than assumed.

Real product images come back from the backend two different real
ways (see `services/api/src/modules/uploads/routes.js`): a real,
relative path for local dev storage, or an already-absolute URL for
real cloud storage. `resolveImageUrl()` in `lib/api.ts` handles both
rather than assuming one shape — prefixing an already-absolute cloud
URL with the API base would have silently broken production images.

Real, server-side revalidation is set to 60 seconds
(`REVALIDATE_SECONDS` in `lib/api.ts`) — product data doesn't need
refetching on every single real request (needless load on the
backend for what's mostly read traffic), but also shouldn't go stale
for long. Tune this once real traffic patterns are known.

## HONEST LIMITATION: Google Fonts could not be verified in this sandbox

`app/layout.tsx` uses `next/font/google` for Barlow Condensed, Inter,
and JetBrains Mono — the real, correct, production implementation.
This sandbox's network access does not include `fonts.googleapis.com`,
so `next build` fails here with a real `403` trying to fetch them —
confirmed directly, not assumed. Every other part of this app (data
fetching, routing, SEO metadata, the sitemap, all three main pages)
was fully built and verified using a temporary, local-fonts-only
version of the layout, then the real Google Fonts version was
restored for this delivered code and separately confirmed to
type-check and lint cleanly (`npx tsc --noEmit`, `npx eslint .` — both
clean) — but the actual real font fetch itself needs verifying once
running somewhere with real internet access.

## A real bug worth knowing about, found while testing this

Twice while testing, a stale `next start` process from an earlier test
was still running and silently serving an outdated build — once
producing a real, confusing 404 for a real, valid product; once
serving the wrong page entirely for `/robots.txt` and `/sitemap.xml`.
Neither was a real bug in the app itself — both resolved by finding
and killing the actual stale process (`ps aux | grep next`) before
starting a fresh one. Worth remembering if a change doesn't seem to
take effect: confirm nothing older is still bound to the port first.

## Setup

```bash
cd apps/web-storefront
npm install
```

Copy `.env.local` and adjust as needed:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

```bash
npm run dev          # local development, http://localhost:3000
npm run build         # real production build
npm run start          # serve the real production build
```

## Next steps to make this real

1. **Verify the real Google Fonts fetch** once deployed somewhere
   with real internet access (see the honest limitation above).
2. **Phase 2**: cart, checkout, and account — a real, separate,
   confirmed pass, not built here.
3. **A real, production domain** for `NEXT_PUBLIC_SITE_URL` — the
   sitemap and metadata currently default to `localhost`.
4. **Real analytics** (e.g. Google Search Console verification) once
   deployed, to actually track real search-visibility results.
5. **Image optimization** — `next/image` was deliberately not used
   for product photos (see the code comment in `app/page.tsx`), since
   photo origins are runtime-configurable (local vs. cloud storage)
   and `next/image`'s domain allowlist isn't set up for that yet in
   this project. Worth revisiting once a single, real, fixed image
   host is settled on.
