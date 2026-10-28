# Round 4: header name, Compare layout, 2 parts on a phone (website and app)

## What changed
**Website**
1. **Header name:** "Leap Auto Parts" is all one white (the second word was drawn at 85% opacity); the weights stay as they were (Leap bold, Auto Parts medium). In **Arabic** it reads **ليب لقطع السيارات** (before, the header said it in English), without the tight letter spacing that squeezes Arabic letters. The Arabic sentences that wrote the name in English now say "ليب": the support title ("دعم ليب"), the support and return notices ("فريق ليب") and the referral share text.
2. **Compare:** every part column is the **same width** (the table has a fixed layout), and the photo and the name are **centered** in their column; the other rows keep their start alignment. A tablet now fits all 4 columns (149 px each at 820 px wide) without scrolling sideways.
3. **A phone compares 2 parts, a tablet or a computer up to 4.** A phone is a screen **under 768 px wide**, held either way (768 px and wider counts as a tablet).
   * **Wishlist, compare mode:** on a phone only 2 parts can be ticked (the others are disabled) and the hint reads "Pick 2 parts to compare. On a phone, 2 at a time."; on a tablet or a computer it stays "Pick 2 to 4 parts". Turning or resizing the screen is followed (from a tablet with 4 ticked to a phone keeps the first 2).
   * **Compare page:** on a phone only the first 2 parts of a link are shown (the others are hidden by the stylesheet, so a shared link with 4 parts still works on a tablet), with a note: "Showing 2 of 4 parts. Open this page on a tablet or a computer to compare them all." (in Arabic too).

**Mobile app**
4. **Wishlist, compare mode:** at most **2** items can be ticked (it was 4). A third tap is refused with the message **"You can compare 2 items at a time"** (Arabic: يمكنك مقارنة عنصرين في المرة الواحدة). The compare table has 140 px columns beside a 110 px label column, so two items (390 px) fit a phone screen exactly.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
Unzip the package over the project (replacing files), then:
```
node scripts\patch-ui-round4.js
node scripts\patch-ui-round4.js --write
node scripts\patch-compare-app.js
node scripts\patch-compare-app.js --write
```
* `patch-ui-round4.js` changes 5 website files (`lib\compare.ts`, `app\compare\page.tsx`, `app\wishlist\page.tsx`, `components\SiteHeader.tsx`, `lib\i18n.ts`). Run it **after** `patch-ui-round3.js`. Reload the website with Ctrl+F5.
* `patch-compare-app.js` changes 2 app files (`features\account\wishlist_screen.dart`, `core\app_strings.dart`). Then, in `apps\mobile`: `flutter analyze`, `flutter test test\compare_limit_test.dart test\compare_limit_wiring_test.dart`, and run the app.
* Each patch saves what it changes as `<file>.before-ui-round4` / `.before-compare-app`, says "already" if run twice, and changes NOTHING if a line it needs is missing. No server change, no migration.
* The zip also replaces two existing website test files (`app\compareSquare.test.tsx`, `app\stage3b-pages.test.tsx`) whose old expectations described the previous layout and the Arabic support title.

## What to look at
1. The header on an English and an Arabic page.
2. Compare 4 parts on a computer and a tablet: equal columns, photos and names centered. Then shrink the window under 768 px (or use a phone): only 2 parts and the note.
3. Wishlist > Compare on a phone: 2 ticks only.
4. The app: Wishlist > Compare, tick 2, tap a third: the message.

## Notes
* The app part has not been run on a device (I cannot run Flutter here): the rule and the wiring are tested as plain Dart and source checks only.
* The Arabic texts (the phone hint and note, the app message) should be read by a native speaker.
* Other places that name the brand in English (emails, receipts) are not changed.

## Tests
Website: `npx vitest run lib/compareHelpers.test.ts lib/compare.test.ts app/wishlistCompareMax.test.tsx lib/brandName.test.ts app/compareSquare.test.tsx components/useCompareMax.test.tsx lib/i18n.test.ts`. App: the two `compare_limit` tests.
`scripts/break-check-order-vehicles.py u4web | u4app` break the code on purpose (26 and 6 ways) and expect the tests to fail.
