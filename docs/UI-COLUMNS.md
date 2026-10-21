# Four columns, equal heights, and "Back to top"

## What changed (storefront)
* **Sections menu:** four columns on a wide screen (three on a tablet, two on a phone). The panel is placed against the whole navigation bar, so it always fits the screen.
* **Find the right part:** after choosing the car, the sections AND then the parts are in four columns on a wide screen (three on a tablet, two on a small tablet, one on a phone), each with its photo beside the name.
* **Products page:** the "Fits my car" switch and the "My vehicle" card now have the same height (same top and bottom edge).
* **Back to top:** a round arrow in the bottom corner of EVERY storefront page. It appears after you scroll down about one screen, sits on the right (the left in Arabic), scrolls smoothly (at once if the
  device asks for less motion), and has the label "Back to top" / "العودة للأعلى".

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-ui-fixes.js`:
```
node scripts\patch-ui-columns.js
node scripts\patch-ui-columns.js --write
```
It changes seven existing files, saves each as `<file>.before-ui-columns`, says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team). No migration.
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, then the storefront in its own window (`cd D:\LEAP-MARKETPLACE\apps\web-storefront`, then `npm run dev -- -p 3001`).

## Check it
* Open "Sections" in the menu: four columns. Find a part, "Use my car": sections in four columns; pick one: parts in four columns.
* Products page with a car in My Garage: the switch and the vehicle card are the same height.
* Scroll down any page: the arrow appears; press it. On the Arabic site it is on the left.

## Notes
* The back-to-top button is in the storefront only (not the supplier or admin portals).
* Tests: `npx vitest run components/BackToTop.test.tsx components/NavDropdownRoot.test.tsx components/FitsMyCarHeight.test.tsx components/FindToolsColumns.test.tsx components/SiteHeaderMenu.test.tsx app/layoutBackToTop.test.tsx app/searchLayout.test.tsx`.
  `scripts/break-check-order-vehicles.py ui2storefront` breaks the code on purpose (16 ways) and expects the tests to fail.
