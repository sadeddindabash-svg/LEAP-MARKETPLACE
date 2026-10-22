# Fix: the storefront does not start ("Can't resolve '@vercel/turbopack-next/internal/font/google/font'")

## What was wrong
The storefront used Next.js's "download the font while the site is built" feature (`next/font/google`) for the home page fonts an admin can choose (Inter, Poppins, Montserrat, Cairo, Tajawal) and for the website's own fonts (Outfit, IBM Plex Sans Arabic,
JetBrains Mono). With Next 16's new build engine (Turbopack), that step fails when Google answers with its newer font addresses (several `&` parameters), and the **whole site refuses to start** with the error above. It had kept working only because
the fonts were saved in the `.next` folder: deleting `.next` (which I told you to do after a patch) made the site download them again, and it failed.

## What changed
No font is downloaded while the site is built any more:
* **The website's own fonts** (Outfit, IBM Plex Sans Arabic, JetBrains Mono): every page links to Google Fonts for them (one address, `display=swap`, so the text shows at once and changes when the font arrives), and the page carries the
  font variables the stylesheet already used. Nothing looks different once the fonts have loaded.
* **The home page fonts** an admin chooses: a page links to Google Fonts **only for the fonts it really uses** (nothing at all when the admin leaves the website's own font), and the headline and sub-headline get the style as before.
* The site no longer needs internet to **start**. (The visitor's browser needs it to load the fonts, as before.)

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run:
```
node scripts\patch-font-fix.js
node scripts\patch-font-fix.js --write
```
It changes three existing files (`lib\homeFonts.ts`, `app\page.tsx` and `app\layout.tsx` of the storefront), saves each as `<file>.before-font-fix`, says "already" if run twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team).
**No migration and nothing to install.**
3. Start the storefront again (the backend does not need a restart):
```
cd D:\LEAP-MARKETPLACE\apps\web-storefront
Remove-Item -Recurse -Force .next
npm run dev -- -p 3001
```
(In the old Command Prompt: `rmdir /s /q .next`.) The first page takes up to a minute while the site is built.

## If you ever see that error again
Start the storefront with the older build engine, which does not have this problem: `npm run dev -- --webpack -p 3001`. And send me the error.

## Notes
* The tests include a guard: **no file of the storefront may use `next/font` at all**, so this cannot come back by accident.
* Tests: `npx vitest run lib/homeFontLinks.test.ts lib/siteFonts.test.ts components/HomeFontLink.test.tsx app/homeFontLink.test.tsx app/layoutFonts.test.tsx`.
  `scripts/break-check-order-vehicles.py ffstorefront` breaks the code on purpose (13 ways) and expects the tests to fail.
