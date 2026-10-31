/**
 * The page a courier opens after scanning the QR on the label. One small self-contained page (no login, no app), in English AND Arabic together,
 * because the courier may read either and the label is printed at a hub whose staff may not. It talks to the same server's /proof/:token API.
 */
const { TOKEN_PATTERN } = require('./helpers');

function renderProofPage(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null; // never put anything but a well-formed token into the page
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Delivery confirmation · تأكيد التسليم</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; background: #f5f6f8; color: #14171c; }
  main { max-width: 480px; margin: 0 auto; padding: 20px 16px 40px; }
  h1 { font-size: 20px; margin: 8px 0 2px; } h1 span { display: block; font-size: 18px; color: #555; direction: rtl; }
  .card { background: #fff; border: 1px solid #e4e6ea; border-radius: 12px; padding: 16px; margin-top: 14px; }
  .en { margin: 0 0 4px; } .ar { margin: 0 0 12px; direction: rtl; color: #444; }
  label { display: block; font-weight: 700; font-size: 13px; margin: 14px 0 4px; } label span { display: block; direction: rtl; font-weight: 600; color: #555; }
  input[type=text], textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; }
  button { width: 100%; margin-top: 18px; padding: 14px; font-size: 16px; font-weight: 700; border: 0; border-radius: 10px; background: #14171c; color: #fff; }
  button:disabled { opacity: .5; }
  .msg { padding: 12px; border-radius: 10px; margin-top: 14px; font-weight: 600; } .ok { background: #e6f4ea; color: #1e6b34; } .bad { background: #fde8e8; color: #a12222; } .info { background: #eef1f6; }
  .count { color: #666; font-size: 13px; margin-top: 6px; }
</style>
</head>
<body>
<main>
  <h1>Delivery confirmation<span>تأكيد التسليم</span></h1>
  <div id="status" class="msg info">Loading… / جارٍ التحميل…</div>
  <form id="form" class="card" hidden>
    <p class="en">Take a photo of the parcel at the delivery address (or with the recipient) and send it. This confirms the parcel was delivered.</p>
    <p class="ar">التقط صورة للطرد عند عنوان التسليم (أو مع المستلم) وأرسلها. بهذا يتم تأكيد تسليم الطرد.</p>
    <label for="photos">Photos (up to 8)<span>الصور (حتى 8)</span></label>
    <input id="photos" type="file" accept="image/*" capture="environment" multiple>
    <div id="count" class="count"></div>
    <label for="name">Your name (optional)<span>اسمك (اختياري)</span></label>
    <input id="name" type="text" maxlength="80" autocomplete="name">
    <label for="note">Note (optional)<span>ملاحظة (اختياري)</span></label>
    <textarea id="note" rows="2" maxlength="300"></textarea>
    <button id="send" type="submit">Send photos and confirm delivery · إرسال الصور وتأكيد التسليم</button>
  </form>
</main>
<script>
const TOKEN = ${JSON.stringify(token)};
const T = {
  not_shipped_yet: ['This parcel has not been shipped yet.', 'لم يتم شحن هذا الطرد بعد.', 'bad'],
  expired: ['This link has expired.', 'انتهت صلاحية هذا الرابط.', 'bad'],
  unknown: ['Link not found.', 'الرابط غير موجود.', 'bad'],
  delivered: ['This parcel is already marked as delivered. You can add more photos below.', 'تم تسجيل تسليم هذا الطرد بالفعل. يمكنك إضافة المزيد من الصور أدناه.', 'info'],
  ready: ['Order {order}. Ready for your photos.', 'الطلب {order}. جاهز لاستلام صورك.', 'info'],
};
const statusBox = document.getElementById('status');
const form = document.getElementById('form');
function show(key, order, kind) {
  const [en, ar, k] = T[key];
  statusBox.className = 'msg ' + (kind || k);
  statusBox.textContent = en.replace('{order}', order || '') + '  ·  ' + ar.replace('{order}', order || '');
}
async function load() {
  try {
    const res = await fetch('/proof/' + TOKEN);
    const data = await res.json();
    show(data.state, data.orderId);
    form.hidden = !(data.state === 'ready' || data.state === 'delivered');
  } catch (e) {
    statusBox.className = 'msg bad';
    statusBox.textContent = 'Could not load. Please try again. · تعذر التحميل. يرجى المحاولة مرة أخرى.';
  }
}
document.getElementById('photos').addEventListener('change', (e) => {
  document.getElementById('count').textContent = e.target.files.length ? e.target.files.length + ' photo(s) selected · ' + e.target.files.length + ' صورة محددة' : '';
});
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const files = document.getElementById('photos').files;
  if (!files.length) { statusBox.className = 'msg bad'; statusBox.textContent = 'Please add at least one photo. · يرجى إضافة صورة واحدة على الأقل.'; return; }
  const body = new FormData();
  for (const f of files) body.append('photos', f);
  body.append('courierName', document.getElementById('name').value);
  body.append('note', document.getElementById('note').value);
  const send = document.getElementById('send');
  send.disabled = true;
  try {
    const res = await fetch('/proof/' + TOKEN, { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      statusBox.className = 'msg ok';
      statusBox.textContent = (data.delivered ? 'Thank you. Delivery confirmed. ' : 'Thank you. Photos added. ') + '·' + (data.delivered ? ' شكرًا لك. تم تأكيد التسليم.' : ' شكرًا لك. تمت إضافة الصور.');
      form.hidden = true;
    } else {
      statusBox.className = 'msg bad';
      statusBox.textContent = (data.error || 'Something went wrong.') + ' · ' + 'حدث خطأ. يرجى المحاولة مرة أخرى.';
      send.disabled = false;
    }
  } catch (err) {
    statusBox.className = 'msg bad';
    statusBox.textContent = 'Could not send. Check your connection and try again. · تعذر الإرسال. تحقق من الاتصال وحاول مرة أخرى.';
    send.disabled = false;
  }
});
load();
</script>
</body>
</html>`;
}
module.exports = { renderProofPage };
