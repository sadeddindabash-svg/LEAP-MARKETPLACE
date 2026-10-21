# The footer, the social media icons, and the six pages

## What changed
**Footer (every storefront page)**
* The **tagline**, the **copyright line** and the four **column titles** (Shop, My account, Help, Useful links) are editable, in English and Arabic. Write `{year}` in the copyright line and the year fills in by itself.
* The six **Useful links** (About us, Terms & Conditions, Delivery & Shipping, Refund, Privacy Policy, Cancellation) have editable wording and can each be hidden.
* **Social media icons** sit under the tagline: up to 8, each with a name, a link and a square picture. An icon shows only when it has a link, opens in a new tab, and shows the **Leap logo** until you choose its
  picture.

**The six pages now live inside the storefront**
* `/about-us`, `/terms-conditions`, `/delivery-shipping-policy`, `/refund-policy`, `/privacy-policy`, `/cancellation-replacement-policy` (the same addresses as on the old website; the old misspelled
  `/privecy-policy` goes to `/privacy-policy`). The Arabic site has them under `/ar/...`.
* Each page has a title and a text in English and Arabic, **written in the admin portal**. Until a page has text, its footer link keeps opening the same page on the OLD website (so no link is ever empty while you fill
  them in); the moment you save text, that link opens the new page. A page with no text says "This page is being prepared" and is kept out of search engines.
* I could not read your existing pages, so **the text is not filled in**: copy it from your current pages and paste it into the editor (a few minutes per page).

**Admin portal, Settings: three new cards**
* **Footer text**: the wording above. **Footer social media**: add, name, link, reorder, and choose a picture (you crop it to a square; it is saved at 256 x 256 as a PNG, so a logo keeps its transparent corners; at least 128 x 128 to
  start with). **Pages**: a tab for each page, title and text in both languages, buttons for **bold**, heading, bullet list and link, and a live preview.

## How the text of a page is written
`## Heading` · `### Smaller heading` · `- item` (bullets) · `1. item` (numbers) · `**bold**` · `[words](https://address)` · a blank line starts a new paragraph. A link may go to https, http, mailto, tel, or a page of the
website (`/refund-policy`). Nothing else is possible, so a text can never become HTML or a script.

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
1. Unzip, replacing files.
2. Run it AFTER `scripts\patch-product-page.js` (and after `scripts\patch-home-spacing.js` if you applied it):
```
node scripts\patch-footer.js
node scripts\patch-footer.js --write
```
It changes six existing files (the footer, the platform settings routes, the storefront's api.ts and i18n.ts, one site-wide test, and the admin portal's App.jsx), saves each as `<file>.before-footer`, says "already" if run
twice, and if ANY file is not what it expects it changes NOTHING (send that file to the Leap team). **No migration.**
3. Restart: `taskkill /F /IM node.exe`, then `.\scripts\start-leap.cmd`, then the storefront in its own window:
```
cd D:\LEAP-MARKETPLACE\apps\web-storefront
rmdir /s /q .next
npm run dev -- -p 3001
```

## Check it
* Admin portal -> Settings -> **Footer text**: change the tagline, Save. -> **Footer social media**: add Facebook with its link, Save, then "Choose picture". -> **Pages**: About us, write a title and a text, Save.
* After about a minute the website's footer shows all of it, and "About us" opens `/about-us` inside the website; the other links still go to the old website until you write those pages.

## Notes
* The website keeps the footer and each page for up to a minute, so a change shows within a minute (the footer link and the page it opens can differ for a few seconds, never longer).
* The six pages are not in the sitemap file (they are linked from every page's footer).
* Tests: server `node --test test/footer.test.js` (in `services\api`, against a database whose name ends in `_test`); admin `npx vitest run src/FooterTextSection.test.jsx src/SocialLinksSection.test.jsx src/LegalPagesSection.test.jsx src/pageEditorFormat.test.js src/miniMarkdown.test.js`;
  storefront `npx vitest run components/SiteFooter.test.tsx components/LegalPage.test.tsx components/RichText.test.tsx lib/miniMarkdown.test.ts lib/footerContent.test.ts lib/miniMarkdownContract.test.ts app/legalPages.test.tsx`.
  `scripts/break-check-order-vehicles.py ftserver|ftadmin|ftstorefront` breaks the code on purpose (63 ways) and expects the tests to fail.
