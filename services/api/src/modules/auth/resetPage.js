/**
 * The page the BUTTON in the password reset email opens: one small self-contained page in English and Arabic together, no app and no login needed.
 * It takes the secret code from the address (?token=...) and sends it with the new password to POST /auth/reset-password, the same endpoint the
 * buyer app's "I have a reset code" screen uses.
 */
const TOKEN_PATTERN = /^[a-f0-9]{64}$/; // what POST /auth/forgot-password creates: 32 random bytes as hex

function renderResetPage(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return null; // never put anything but a well-formed code into the page
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>Choose a new password · اختر كلمة مرور جديدة</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; background: #f5f6f8; color: #14171c; }
  main { max-width: 440px; margin: 0 auto; padding: 24px 16px 40px; }
  h1 { font-size: 20px; margin: 8px 0 2px; } h1 span { display: block; font-size: 18px; color: #555; direction: rtl; }
  .card { background: #fff; border: 1px solid #e4e6ea; border-radius: 12px; padding: 18px; margin-top: 14px; }
  label { display: block; font-weight: 700; font-size: 13px; margin: 14px 0 4px; } label span { display: block; direction: rtl; font-weight: 600; color: #555; }
  input { width: 100%; box-sizing: border-box; padding: 11px; border: 1px solid #ccc; border-radius: 8px; font-size: 16px; }
  button { width: 100%; margin-top: 18px; padding: 14px; font-size: 16px; font-weight: 700; border: 0; border-radius: 10px; background: #e8622c; color: #fff; }
  button:disabled { opacity: .5; }
  .msg { padding: 12px; border-radius: 10px; margin-top: 14px; font-weight: 600; } .ok { background: #e6f4ea; color: #1e6b34; } .bad { background: #fde8e8; color: #a12222; }
  .hint { color: #666; font-size: 12.5px; margin-top: 4px; }
</style>
</head>
<body>
<main>
  <h1>Choose a new password<span>اختر كلمة مرور جديدة</span></h1>
  <form id="form" class="card">
    <label for="pw">New password (at least 8 characters)<span>كلمة المرور الجديدة (8 أحرف على الأقل)</span></label>
    <input id="pw" type="password" autocomplete="new-password" required>
    <label for="pw2">Repeat the new password<span>أعد كتابة كلمة المرور الجديدة</span></label>
    <input id="pw2" type="password" autocomplete="new-password" required>
    <button id="send" type="submit">Save new password · حفظ كلمة المرور</button>
  </form>
  <div id="msg"></div>
</main>
<script>
const TOKEN = ${JSON.stringify(token)};
const form = document.getElementById('form');
const msg = document.getElementById('msg');
function show(kind, en, ar) { msg.className = 'msg ' + kind; msg.textContent = en + '  ·  ' + ar; }
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pw = document.getElementById('pw').value, pw2 = document.getElementById('pw2').value;
  if (pw.length < 8) return show('bad', 'The password must be at least 8 characters.', 'يجب ألا تقل كلمة المرور عن 8 أحرف.');
  if (pw !== pw2) return show('bad', 'The two passwords do not match.', 'كلمتا المرور غير متطابقتين.');
  const send = document.getElementById('send'); send.disabled = true;
  try {
    const res = await fetch('/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: TOKEN, newPassword: pw }) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      form.hidden = true;
      show('ok', 'Your password has been changed. You can now sign in with it in the Leap app.', 'تم تغيير كلمة المرور. يمكنك الآن تسجيل الدخول بها في تطبيق Leap.');
    } else {
      show('bad', (data.error || 'This link is no longer valid.') + ' Please request a new reset email.', 'قد تكون صلاحية الرابط قد انتهت. يرجى طلب رسالة إعادة تعيين جديدة.');
      send.disabled = false;
    }
  } catch (err) {
    show('bad', 'Could not reach the server. Check your connection and try again.', 'تعذر الاتصال بالخادم. تحقق من اتصالك وحاول مرة أخرى.');
    send.disabled = false;
  }
});
</script>
</body>
</html>`;
}

const NOT_VALID_PAGE = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:system-ui;padding:24px"><h2>This link is not valid · الرابط غير صالح</h2><p>Please request a new password reset email.<br>يرجى طلب رسالة إعادة تعيين جديدة.</p></body>';

module.exports = { renderResetPage, NOT_VALID_PAGE };
