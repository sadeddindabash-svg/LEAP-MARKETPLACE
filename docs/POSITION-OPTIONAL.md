# Position: not required any more

- Supplier portal, My Drafts: Position is never asked for or listed as missing.
- Server: a product can be submitted without a position (a drafts list never shows it as missing).
- Admin dashboard: the Position field is removed from All Products > Edit, and the moderation list no longer shows it.
- Products that already have a position keep it (no data deleted).

Apply after patch-remove-attributes.js:

    cd D:\LEAP-MARKETPLACE
    node scripts\patch-position-optional.js
    node scripts\patch-position-optional.js --write

Restart the API (start-all), then reload the supplier portal and the admin dashboard with Ctrl+F5.
