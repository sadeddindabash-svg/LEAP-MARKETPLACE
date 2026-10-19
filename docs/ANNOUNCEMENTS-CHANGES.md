# Home page announcements: the exact edits

Included as whole files in `leap_announcements.zip`. **If you have changed `services/api/src/modules/platform-settings/routes.js`, `apps/admin-dashboard/src/App.jsx` or `apps/admin-dashboard/src/auth.js` since the project was last shared, do not overwrite them: apply the edits below by hand.** Everything else in the zip is new or website-only. **Run `node db/migrate.js` and restart the backend afterwards.**

## Server
- NEW `services/api/db/migrations/105_storefront_announcements.sql`: puts the website's two old fixed lines into `platform_settings` under the key `storefront_announcements` (`ON CONFLICT DO NOTHING`).
- NEW `services/api/src/modules/platform-settings/announcements.js`: `validateAnnouncements` (at most 5, English required, 150 characters, tidied) and `parseStored`.
- `services/api/src/modules/platform-settings/routes.js`: add `const { MAX_ANNOUNCEMENTS, validateAnnouncements, parseStored } = require('./announcements');` with the other requires, and, just before `module.exports = router;`, `router.get('/announcements', ...)` (public: reads the key, answers `{ announcements, max }`) and `router.patch('/announcements', requireAuth, requireRole('admin'), ...)` (validates, upserts `storefront_announcements` as JSON, then `logAdminAction(req, 'announcements_changed', 'platform_setting', 'storefront_announcements', { count, announcements })`).

## Admin portal (`apps/admin-dashboard/src`)
- `auth.js`: add `fetchAnnouncements()` (public GET) and `updateAnnouncements(token, announcements)` (PATCH with the token; 401 becomes `SessionExpiredError`) after `updateReceiptFooter`.
- `App.jsx`: (1) add `fetchAnnouncements, updateAnnouncements,` to the import from `./auth`; (2) add the `AnnouncementsSection` component (and its two constants) just before the comment "Real, exact set of every action type this codebase actually logs"; (3) in `SettingsPage`, in the row that holds `<ReceiptFooterSection />`, add `<AnnouncementsSection onSessionExpired={onSessionExpired} />` after it; (4) add `'announcements_changed',` to the audit action list (after `'category_commission_changed',`).
- NEW tests: `AnnouncementsFlow.test.jsx`, `announcements.test.js`, `announcements.integration.test.js`.
- NOT in the zip: `theme.js`. It was missing where this was tested, so a stand-in was used for the tests; **do not copy a stand-in over yours**. The card uses only colours the receipt footer card already uses (`C.muted`, `C.red`, `C.redBg`, `C.line`, `C.signal`, `C.onSignal`, `C.gauge`).

## Website (`apps/web-storefront`)
New: `lib/announcements.ts`, `components/AnnouncementBar.tsx` and the tests `lib/announcements.test.ts`, `lib/announcementsApi.test.ts`, `lib/announcements-home-only.test.ts`, `lib/ticker-css.test.ts`, `components/AnnouncementBar.test.tsx`. Changed: `lib/api.ts` (adds `fetchAnnouncements`, cached 10 s), `lib/i18n.ts` (the two old `announce_*` texts removed, `announcements_region` added), `app/globals.css` (the `.leap-ticker` rules), `app/page.tsx` (fetches and draws the bar first), `components/SiteHeader.tsx` (the yellow strip removed), `app/pages-i18n.test.tsx`, README.md.
