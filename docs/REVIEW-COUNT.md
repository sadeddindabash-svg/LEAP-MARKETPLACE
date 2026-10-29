# Product cards: real review count + even spacing

Why the cards said "No reviews yet": the product lists read products.rating and
products.review_count, and approving a review never updated them (they stayed 0).
The product page counted its reviews itself, so it looked right.

What changes
- Server (reviews routes): a product's rating and count are recalculated from its
  APPROVED reviews whenever a review is written/edited (back to pending),
  approved, rejected or deleted.
- Migration NNN_product_review_totals.sql (the next number): fills them in once.
- App: the card shows "4.6 (12)"; "No reviews yet" only when there are none.
  The card fills its grid cell, so rows are 10 px apart, the same as columns.
- Website: the card shows the stars, the average and "(12 reviews)", or
  "No reviews yet". The website grid already uses 20 px both ways.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_review_count.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-review-count.js
    node scripts\patch-review-count.js --write
    cd services\api
    npm run migrate
    cd ..\..\apps\mobile
    flutter test test\card_spacing_wiring_test.dart
    cd ..\web-storefront
    npx vitest run lib/card-reviews.test.ts
    cd ..\..
    .\scripts\start-all.cmd -Stop
    .\scripts\start-all.cmd

Undo: each changed file is saved as <file>.before-review-count.
