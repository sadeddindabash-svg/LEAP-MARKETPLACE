# Catalog moderation: reject with a reason

Admin dashboard, Catalog moderation
- Reject (one product) opens the list of reasons under the product; Reject selected opens it for all the selected products.
- Reasons: Wrong category, Wrong photos, Wrong part classification, Wrong vehicle (fitment), Wrong OE number,
  Price looks wrong, Name or description not clear, Duplicate product, Other. One or more can be ticked.
- Note to the supplier: optional, required for Other (500 characters at most).
- The button "Reject and tell the supplier" stays grey until a reason is ticked. The server refuses a reject without one.

Supplier
- A notification (bell) for every user of the supplier: 商品未通过审核 Product rejected, with the reasons and the note
  (Chinese and English in the same notification).
- My Drafts (Not published): filters 全部 All / 被拒绝 Rejected / 待完善 Needs completion. A rejected product shows 已拒绝,
  the date, the reasons and the note.
- 修改并重新提交 Fix and resubmit: the product opens with its name, OE number, price, category and part, photos and video;
  "重新提交审核" sends it back to Catalog moderation and clears the reasons.
- Products list: a rejected product shows 已拒绝 / Rejected (instead of 已下架).

Server
- Migration 118: products.rejection_reasons, rejection_note, rejected_at. A rejected product keeps status 'inactive'.
- New file services/api/src/modules/catalog/rejection.js (the reasons, their check, the notification).
- New route PATCH /supplier/me/products/:id/resubmit.

Apply after patch-admin-name-minimums.js:

    cd D:\LEAP-MARKETPLACE
    node scripts\patch-reject-reasons.js
    node scripts\patch-reject-reasons.js --write
    cd services\api
    npm run migrate
    cd ..\..
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    .\scripts\start-all.cmd

Then reload the admin dashboard and the supplier portal with Ctrl+F5.

Note: products rejected BEFORE this change have no reasons saved, so they do not appear under Rejected.
