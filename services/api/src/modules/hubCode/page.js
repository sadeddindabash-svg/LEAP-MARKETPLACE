const express = require('express');

/**
 * GET /h/:code -- what a phone opens when someone scans the QR on the SUPPLIER's label (the striped "hub use only" label on a parcel coming
 * into the inspection hub). The hub's own scanner reads the code and opens the parcel; anyone else (a delivery driver who scanned the wrong
 * label) gets this page: "this is not the delivery label, scan the other one", in Arabic, English and Chinese. It shows nothing about the order
 * or the buyer, and does not even look the code up.
 */
const router = express.Router();

const PAGE = `<!doctype html><html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Not the delivery label · ليس ملصق التوصيل</title>
<style>
body{margin:0;background:#F5F6F8;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans Arabic","Noto Sans SC",sans-serif;color:#14171C}
main{max-width:440px;margin:0 auto;padding:28px 20px;text-align:center}
.mark{font-size:46px;line-height:1}
section{background:#fff;border:1px solid #E4E6EA;border-radius:14px;padding:16px;margin-top:14px}
h1,h2{margin:0 0 6px;font-size:19px}p{margin:0;font-size:14.5px;line-height:1.55;color:#374151}
</style></head><body><main>
<div class="mark">⚠</div>
<section dir="rtl" lang="ar"><h1>هذا ليس ملصق التوصيل</h1><p>هذا رمز استلام خاص بمركز الفحص. امسح الملصق الآخر على الطرد (الذي يحمل اسم المشتري وعنوانه).</p></section>
<section lang="en"><h2>This is not the delivery label</h2><p>It is the inspection hub's receiving code. Scan the other label on the parcel (the one with the buyer's name and address).</p></section>
<section lang="zh"><h2>这不是派送标签</h2><p>这是质检中心的收货码。请扫描包裹上的派送标签（印有买家姓名和地址的那一张）。</p></section>
</main></body></html>`;

router.get('/:code', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.type('html').send(PAGE);
});

module.exports = router;
