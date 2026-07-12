# Mobile App (Buyer)

Buyer-facing storefront for iOS and Android. Corresponds to SRS Section 3.1
(Buyer-Facing Application) and the clickable reference in
`docs/prototypes/leap_mobile_prototype.jsx`.

## Scope (Phase 1 / Must Have)

- Account management & authentication (BUY-001–005)
- Vehicle selector & Year/Make/Model/Trim fitment search (BUY-010–015; VIN is Phase 2)
- Product catalog, browsing & search (BUY-020–025)
- Cart & checkout, split by supplier (BUY-030–035)
- Payments: Stripe, PayPal, Google Pay, major card networks (BUY-040–044)
- Orders, tracking, returns/warranty via the Platform, reviews (BUY-050–055)
- Support: buyer ↔ Platform only, no direct supplier contact (BUY-060–062)
- Localization: English at launch, RTL-ready architecture (BUY-070–072)

Full requirement text and priority tags: `docs/SRS.docx`, Section 3.1.

## Suggested stack

Not yet finalized — see Charter Section 1, "Mobile development approach".
Leading candidate: React Native or Flutter (cross-platform) to fit the
16-week Phase 1 timeline and budget.

## Getting started

This folder is currently a placeholder. Once the framework decision is
confirmed:

1. Scaffold the app here (e.g. `npx react-native init` or `flutter create .`
   run *inside* this folder so it stays at `apps/mobile/`).
2. Wire up the core screens per `docs/prototypes/leap_mobile_prototype.jsx`:
   Home, My Garage, Category/Search, Product Detail, Cart, Checkout, Orders,
   Order Detail, Account, Support Chat.
3. Point API calls at `services/api` once that service is running locally
   (see that folder's README for local dev setup).

## Do not

- Hardcode buyer-facing strings — route through the localization layer so
  additional languages can be added without code changes (NFR-050).
- Add any direct buyer-to-supplier messaging path — this is an explicit
  business requirement (see SRS Section 2.5).
