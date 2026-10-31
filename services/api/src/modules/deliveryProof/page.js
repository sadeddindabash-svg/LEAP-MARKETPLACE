/**
 * The page a DRIVER opens after scanning the QR on the label. One small self-contained page (no app to install), in English AND Arabic
 * together, because the driver may read either. It talks to the same server's /proof/:token and /proof-driver APIs.
 *
 * Since migration 120: the driver signs in once (phone + password from Leap; the sign-in is kept on the phone), checks the buyer's name and
 * address, then either
 *   Delivered       a photo taken now, who received it, the buyer's 4-digit code (required), and the phone's location when it allows; or
 *   Couldn't deliver  the reason (not home, wrong address, refused, other), a note and an optional photo.
 * Someone who is not signed in (a buyer, a neighbour) sees no name or address and can confirm nothing.
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
  body { font-family: system-ui, -apple-system, "Segoe UI", Tahoma, Roboto, sans-serif; margin: 0; background: #f5f6f8; color: #14171c; }
  main { max-width: 480px; margin: 0 auto; padding: 16px 14px 40px; }
  h1 { font-size: 19px; margin: 6px 0 2px; } h1 span { display: block; font-size: 17px; color: #555; direction: rtl; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .who { font-size: 12px; color: #555; text-align: right; } .who a { color: #1d4e89; }
  .card { background: #fff; border: 1px solid #e4e6ea; border-radius: 12px; padding: 14px; margin-top: 12px; }
  .ar { direction: rtl; color: #444; }
  label, .lbl { display: block; font-weight: 700; font-size: 13px; margin: 14px 0 6px; } label span, .lbl span { display: block; direction: rtl; font-weight: 600; color: #555; }
  input[type=text], input[type=tel], input[type=password], textarea { width: 100%; box-sizing: border-box; padding: 11px; border: 1px solid #ccc; border-radius: 9px; font-size: 16px; }
  .code { font-size: 26px !important; letter-spacing: 12px; text-align: center; font-weight: 800; }
  button { width: 100%; margin-top: 14px; padding: 14px; font-size: 16px; font-weight: 700; border: 0; border-radius: 10px; background: #1d4e89; color: #fff; }
  button.green { background: #1e7a34; } button.red { background: #b42318; } button.ghost { background: #fff; color: #b42318; border: 2px solid #b42318; }
  button.link { background: none; color: #1d4e89; padding: 8px; margin-top: 6px; font-weight: 600; }
  button:disabled { opacity: .5; }
  button.chip, button.opt { width: auto; margin-top: 0; color: #14171c; background: #fff; font-size: 14px; }
  button.opt { width: 100%; margin-top: 8px; text-align: left; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { flex: 1 1 45%; border: 2px solid #e4e6ea; border-radius: 10px; padding: 10px; font-size: 13.5px; font-weight: 600; background: #fff; text-align: center; }
  .chip span { display: block; direction: rtl; color: #555; font-weight: 500; font-size: 12.5px; } button.chip.on { border-color: #1d4e89; background: #eaf1fa; }
  .opt { display: block; border: 2px solid #e4e6ea; border-radius: 10px; padding: 10px; margin-top: 8px; font-weight: 600; } .opt span { display: block; direction: rtl; color: #555; font-weight: 500; } button.opt.on { border-color: #1d4e89; background: #eaf1fa; }
  .msg { padding: 12px; border-radius: 10px; margin-top: 12px; font-weight: 600; } .ok { background: #e6f4ea; color: #1e6b34; } .bad { background: #fde8e8; color: #a12222; } .info { background: #eef1f6; }
  .parcel b { font-size: 16px; } .parcel div { margin-top: 3px; } .muted { color: #666; font-size: 13px; }
  .thumbs { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; } .thumbs img { width: 64px; height: 64px; object-fit: cover; border-radius: 8px; }
  .big { text-align: center; padding: 26px 10px; } .big .tick { width: 64px; height: 64px; border-radius: 50%; background: #1e7a34; color: #fff; font-size: 34px; line-height: 64px; margin: 0 auto 10px; }
  [hidden] { display: none !important; }
</style>
</head>
<body>
<main>
  <div class="top"><h1>Delivery confirmation<span>تأكيد التسليم</span></h1><div id="who" class="who" hidden></div></div>
  <div id="status" class="msg info">Loading… / جارٍ التحميل…</div>

  <form id="signin" class="card" hidden>
    <div>Sign in once on this phone with the account Leap gave you.</div><div class="ar">سجّل الدخول مرة واحدة على هذا الهاتف بالحساب الذي أعطتك إياه ليب.</div>
    <label for="phone">Phone number<span>رقم الهاتف</span></label><input id="phone" type="tel" autocomplete="username" inputmode="tel">
    <label for="password">Password<span>كلمة المرور</span></label><input id="password" type="password" autocomplete="current-password">
    <button type="submit">Sign in · تسجيل الدخول</button>
  </form>

  <div id="parcel" class="card parcel" hidden>
    <div id="parcelInfo"></div>
    <div class="muted" style="margin-top:10px">Check the name and address, then: · تحقق من الاسم والعنوان، ثم:</div>
    <button id="goDeliver" type="button" class="green">✓ Delivered · تم التسليم</button>
    <button id="goFail" type="button" class="ghost">✕ Couldn't deliver · تعذّر التسليم</button>
  </div>

  <form id="deliver" class="card" hidden>
    <label for="photos">Photo of the parcel at the door or with the receiver<span>صورة الطرد عند الباب أو مع المستلم</span></label>
    <input id="photos" type="file" accept="image/*" capture="environment" multiple>
    <div id="thumbs" class="thumbs"></div><div id="count" class="muted"></div>
    <div id="receivedBox">
      <div class="lbl">Received by<span>استلمه</span></div>
      <div class="chips" id="receivedBy">
        <button type="button" class="chip" data-v="buyer">Buyer<span>المشتري</span></button>
        <button type="button" class="chip" data-v="family">Family<span>أحد أفراد العائلة</span></button>
        <button type="button" class="chip" data-v="reception">Guard / reception<span>الحارس / الاستقبال</span></button>
        <button type="button" class="chip" data-v="door">Left at door<span>تُرك عند الباب</span></button>
      </div>
      <label for="code">Buyer's 4-digit code (required)<span>رمز المشتري المكوّن من 4 أرقام (إلزامي)</span></label>
      <input id="code" class="code" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="one-time-code">
      <div class="muted">The buyer sees it in their order on the Leap app or website. · يجده المشتري في طلبه على تطبيق أو موقع ليب.</div>
    </div>
    <label for="note">Note (optional)<span>ملاحظة (اختياري)</span></label><textarea id="note" rows="2" maxlength="300"></textarea>
    <div id="loc" class="muted" style="margin-top:8px"></div>
    <button id="send" type="submit" class="green">Confirm delivery · تأكيد التسليم</button>
    <button type="button" class="link back">← Back · رجوع</button>
  </form>

  <form id="fail" class="card" hidden>
    <div class="lbl">Why couldn't you deliver?<span>لماذا تعذّر التسليم؟</span></div>
    <div id="reasons">
      <button type="button" class="opt" data-v="not_home">Buyer not home / no answer<span>المشتري غير موجود / لا يرد</span></button>
      <button type="button" class="opt" data-v="wrong_address">Wrong or incomplete address<span>العنوان خاطئ أو غير مكتمل</span></button>
      <button type="button" class="opt" data-v="refused">Buyer refused the parcel<span>رفض المشتري استلام الطرد</span></button>
      <button type="button" class="opt" data-v="other">Other (write a note)<span>سبب آخر (اكتب ملاحظة)</span></button>
    </div>
    <label for="failNote">Note<span>ملاحظة</span></label><textarea id="failNote" rows="2" maxlength="300"></textarea>
    <label for="failPhoto">Photo (optional)<span>صورة (اختياري)</span></label><input id="failPhoto" type="file" accept="image/*" capture="environment">
    <button id="sendFail" type="submit" class="red">Send · إرسال</button>
    <button type="button" class="link back">← Back · رجوع</button>
  </form>

  <div id="done" class="card big" hidden><div class="tick">✓</div><div id="doneText"></div></div>
</main>
<script>
const TOKEN = ${JSON.stringify(token)};
const KEY = 'leap_driver_token';
let memoryToken = null;
const getToken = () => { try { return localStorage.getItem(KEY) || memoryToken; } catch (e) { return memoryToken; } };
const setToken = (t) => { memoryToken = t; try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch (e) {} };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const T = {
  not_shipped_yet: ['This parcel has not been shipped yet.', 'لم يتم شحن هذا الطرد بعد.', 'bad'],
  expired: ['This link has expired.', 'انتهت صلاحية هذا الرابط.', 'bad'],
  unknown: ['Link not found.', 'الرابط غير موجود.', 'bad'],
  delivered: ['This parcel is already delivered. You can add more photos.', 'تم تسليم هذا الطرد بالفعل. يمكنك إضافة المزيد من الصور.', 'ok'],
  ready: ['Order {order}', 'الطلب {order}', 'info'],
  signin: ['Delivery drivers: please sign in.', 'السائقون: يرجى تسجيل الدخول.', 'info'],
  disabled: ['This driver account is turned off. Contact Leap.', 'حساب السائق هذا موقوف. تواصل مع ليب.', 'bad'],
};
let info = null, receivedBy = null, reason = null, where = null;
const sections = ['signin', 'parcel', 'deliver', 'fail', 'done'];
function only(id) { sections.forEach((s) => { $(s).hidden = s !== id; }); }
function say(en, ar, kind) { const box = $('status'); box.hidden = false; box.className = 'msg ' + kind; box.textContent = en + ' / ' + ar; }
function sayKey(key) { const [en, ar, k] = T[key]; say(en.replace('{order}', info && info.orderId || ''), ar.replace('{order}', info && info.orderId || ''), k); }
function authHeaders() { const t = getToken(); return t ? { Authorization: 'Bearer ' + t } : {}; }

async function load() {
  try {
    const res = await fetch('/proof/' + encodeURIComponent(TOKEN), { headers: authHeaders(), cache: 'no-store' });
    info = await res.json();
  } catch (e) { say('Could not load. Check the connection and try again.', 'تعذّر التحميل. تحقق من الاتصال وحاول مرة أخرى.', 'bad'); return; }
  if (info.driverError) setToken(null);
  if (['unknown', 'expired', 'not_shipped_yet'].includes(info.state)) { sayKey(info.state); only(null); return; }
  if (!info.signedIn) { sayKey(info.driverError === 'disabled' ? 'disabled' : 'signin'); $('who').hidden = true; only('signin'); return; }
  showWho();
  if (info.state === 'delivered') { sayKey('delivered'); $('receivedBox').hidden = true; only('deliver'); return; }
  sayKey('ready');
  const p = info.parcel || {};
  $('parcelInfo').innerHTML = '<b>' + esc(p.recipientName || '—') + '</b>'
    + '<div>' + esc(p.phone || '') + '</div>'
    + '<div class="muted">' + esc([p.street, p.city].filter(Boolean).join(', ')) + '</div>'
    + '<div class="muted">Order ' + esc(p.orderId) + (p.total > 1 ? ' · parcel ' + p.index + ' of ' + p.total + ' · الطرد ' + p.index + ' من ' + p.total : '') + '</div>';
  only('parcel');
}
let driverName = '';
function showWho() {
  const who = $('who'); who.hidden = false;
  who.innerHTML = esc(driverName || 'Signed in · مسجّل') + '<br><a href="#" id="signout">Sign out · خروج</a>';
  $('signout').onclick = (e) => { e.preventDefault(); setToken(null); driverName = ''; load(); };
}
async function whoAmI() {
  if (!getToken()) return;
  try { const r = await fetch('/proof-driver/me', { headers: authHeaders() }); if (r.ok) { const d = await r.json(); driverName = d.driver.name + ' · ' + d.driver.company; } } catch (e) {}
}

$('signin').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await fetch('/proof-driver/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: $('phone').value, password: $('password').value }) });
    const data = await res.json();
    if (!res.ok) { say(data.error || 'Sign-in failed.', 'تعذّر تسجيل الدخول.', 'bad'); return; }
    setToken(data.token); driverName = data.driver.name + ' · ' + data.driver.company; $('password').value = '';
    load();
  } catch (err) { say('Could not sign in. Check the connection.', 'تعذّر تسجيل الدخول. تحقق من الاتصال.', 'bad'); }
});

function locate() {
  where = null;
  const box = $('loc');
  if (!navigator.geolocation) { box.textContent = 'Location not available on this phone. · الموقع غير متاح على هذا الهاتف.'; return; }
  box.textContent = 'Getting location… · جارٍ تحديد الموقع…';
  navigator.geolocation.getCurrentPosition(
    (pos) => { where = pos.coords; box.textContent = '📍 Location captured · تم تحديد الموقع'; },
    () => { box.textContent = 'Location not shared (the delivery can still be confirmed). · لم تتم مشاركة الموقع (يمكن تأكيد التسليم).'; },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}
function addLocation(form) { if (where) { form.append('latitude', where.latitude); form.append('longitude', where.longitude); form.append('accuracy', where.accuracy); } }
$('goDeliver').onclick = () => { $('receivedBox').hidden = false; only('deliver'); locate(); };
$('goFail').onclick = () => { only('fail'); locate(); };
document.querySelectorAll('.back').forEach((b) => { b.onclick = () => load(); });
document.querySelectorAll('#receivedBy .chip').forEach((b) => { b.onclick = () => { receivedBy = b.dataset.v; document.querySelectorAll('#receivedBy .chip').forEach((x) => x.classList.toggle('on', x === b)); }; });
document.querySelectorAll('#reasons .opt').forEach((b) => { b.onclick = () => { reason = b.dataset.v; document.querySelectorAll('#reasons .opt').forEach((x) => x.classList.toggle('on', x === b)); }; });
$('photos').addEventListener('change', () => {
  const files = [...$('photos').files];
  $('thumbs').innerHTML = '';
  files.forEach((f) => { const img = document.createElement('img'); img.src = URL.createObjectURL(f); $('thumbs').appendChild(img); });
  $('count').textContent = files.length ? files.length + ' photo(s) · صور' : '';
});

$('deliver').addEventListener('submit', async (e) => {
  e.preventDefault();
  const files = [...$('photos').files];
  const delivering = info.state === 'ready';
  if (files.length === 0) { say('Take at least one photo.', 'التقط صورة واحدة على الأقل.', 'bad'); return; }
  if (delivering && !receivedBy) { say('Choose who received the parcel.', 'اختر من استلم الطرد.', 'bad'); return; }
  if (delivering && !/^\\d{4}$/.test($('code').value.trim())) { say("Enter the buyer's 4-digit code.", 'أدخل رمز المشتري المكوّن من 4 أرقام.', 'bad'); return; }
  const form = new FormData();
  files.forEach((f) => form.append('photos', f));
  if (delivering) { form.append('receivedBy', receivedBy); form.append('code', $('code').value.trim()); }
  form.append('note', $('note').value);
  addLocation(form);
  $('send').disabled = true;
  try {
    const res = await fetch('/proof/' + encodeURIComponent(TOKEN), { method: 'POST', headers: authHeaders(), body: form });
    const data = await res.json();
    if (res.status === 401) { setToken(null); load(); return; }
    if (!res.ok) {
      const extra = data.triesLeft !== undefined ? ' (' + data.triesLeft + ' tries left · محاولات متبقية)' : '';
      say((data.error || 'Could not send.') + extra, data.code === 'wrong_code' ? 'الرمز غير صحيح. اطلب من المشتري الرمز الظاهر في طلبه.' : data.code === 'code_locked' ? 'محاولات خاطئة كثيرة. حاول لاحقاً.' : 'تعذّر الإرسال.', 'bad');
      return;
    }
    $('status').hidden = true;
    $('doneText').innerHTML = data.delivered
      ? '<b style="font-size:18px">Delivered · تم التسليم</b><div class="muted" style="margin-top:6px">Order ' + esc(info.orderId) + '. Scanning this label again shows "already delivered". · مسح هذا الملصق مرة أخرى يُظهر أنه سُلّم.</div>'
      : '<b style="font-size:18px">Photos added · تمت إضافة الصور</b>';
    only('done');
  } catch (err) { say('Could not send. Check the connection and try again.', 'تعذّر الإرسال. تحقق من الاتصال وحاول مرة أخرى.', 'bad'); }
  finally { $('send').disabled = false; }
});

$('fail').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!reason) { say('Choose a reason.', 'اختر سبباً.', 'bad'); return; }
  if (reason === 'other' && !$('failNote').value.trim()) { say('Write a short note.', 'اكتب ملاحظة قصيرة.', 'bad'); return; }
  const form = new FormData();
  form.append('reason', reason); form.append('note', $('failNote').value);
  if ($('failPhoto').files[0]) form.append('photo', $('failPhoto').files[0]);
  addLocation(form);
  $('sendFail').disabled = true;
  try {
    const res = await fetch('/proof/' + encodeURIComponent(TOKEN) + '/attempt', { method: 'POST', headers: authHeaders(), body: form });
    const data = await res.json();
    if (res.status === 401) { setToken(null); load(); return; }
    if (!res.ok) { say(data.error || 'Could not send.', 'تعذّر الإرسال.', 'bad'); return; }
    $('status').hidden = true;
    $('doneText').innerHTML = '<b style="font-size:18px">Sent · تم الإرسال</b><div class="muted" style="margin-top:6px">Leap has been told. Keep the parcel and follow your company\\'s return steps. · تم إبلاغ ليب. احتفظ بالطرد واتبع إجراءات شركتك.</div>';
    document.querySelector('#done .tick').textContent = '!'; document.querySelector('#done .tick').style.background = '#b54708';
    only('done');
  } catch (err) { say('Could not send. Check the connection and try again.', 'تعذّر الإرسال. تحقق من الاتصال وحاول مرة أخرى.', 'bad'); }
  finally { $('sendFail').disabled = false; }
});

whoAmI().then(load);
</script>
</body>
</html>`;
}

module.exports = { renderProofPage };
