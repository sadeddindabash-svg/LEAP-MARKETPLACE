# Product card: the discount tag and the brand logo must be on opposite sides in Arabic

In English the logo is at the left of the photo and the discount at the right; in Arabic they swap (the logo on the right, the discount on the left). If your cards show the discount ON the logo in Arabic, the card file still has the old markup (the tag told to read left-to-right on itself, `dir="ltr"`, which also pins it to the right), or a fixed `right-`/`left-` instead of `end-`/`start-`.

## Fix (from D:\LEAP-MARKETPLACE)
```
node scripts\fix-card-discount-tag.js
node scripts\fix-card-discount-tag.js --write
```
* The first command only says what it found. The second applies it (the old files are saved as `<file>.before-card-tag-fix`).
* It says **"already correct"** when your files are fine; then the cause is not in these two files (see below).
* Then reload the website with Ctrl+F5 (`.\scripts\start-all.cmd -NoPhone -CleanWebsite` if a page still looks old).
* Test it first if you like: `node scripts\test-fix-card-discount-tag.js` (9 tests).

## If it says "already correct" and you still see the overlap
Open an Arabic page with cards, press F12, choose Console, paste this and send me the answer:
```
(() => { const t = document.querySelector('[data-testid="discount-tag"]'); const b = document.querySelector('[data-testid="brand-badge"]'); const r = (e) => e && Math.round(e.getBoundingClientRect().left) + " to " + Math.round(e.getBoundingClientRect().right); return { pageDir: document.documentElement.dir, tagDirAttr: t && t.getAttribute("dir"), tagClass: t && t.className, tag: r(t), badge: r(b) }; })()
```
