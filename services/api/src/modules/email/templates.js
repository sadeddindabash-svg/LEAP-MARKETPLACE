/**
 * Real branded HTML email templates. Colors match the real brand
 * palette already established in apps/mobile/lib/core/theme.dart
 * (LeapColors) — kept visually consistent with the actual app rather
 * than inventing a separate look for email.
 */

const BRAND = {
  ink: '#14171C',
  chalk: '#F5F6F8',
  line: '#E4E6EA',
  signal: '#E8622C', // primary action
  muted: '#6B7280',
};

/**
 * The shared branded shell. A buyer email is built from one or more SECTIONS (one per language): English only, Arabic only (right to left), or
 * BOTH one after the other when we do not know the person's language (a guest checkout).
 */
function shell(innerHtml, { lang = 'en' } = {}) {
  const htmlAttrs = lang === 'ar' ? 'lang="ar" dir="rtl"' : 'lang="en"';
  return `
<!DOCTYPE html>
<html ${htmlAttrs}>
<body style="margin:0; padding:0; background-color:${BRAND.chalk}; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.chalk}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid ${BRAND.line};">
          <tr>
            <td style="padding: 32px 32px 8px 32px;">
              <div style="font-size: 20px; font-weight: 800; color: ${BRAND.ink};">Leap Auto Parts</div>
            </td>
          </tr>
          ${innerHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function section({ heading, bodyHtml, ctaUrl, ctaLabel, footerHtml, dir = 'ltr' }) {
  const align = dir === 'rtl' ? 'right' : 'left';
  return `
          <tr>
            <td dir="${dir}" style="padding: 8px 32px 0 32px; text-align: ${align};">
              <div style="font-size: 16px; font-weight: 700; color: ${BRAND.ink}; margin-bottom: 12px;">${heading}</div>
              <div style="font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">${bodyHtml}</div>
            </td>
          </tr>
          ${ctaUrl ? `
          <tr>
            <td dir="${dir}" style="padding: 24px 32px; text-align: ${align};">
              <a href="${ctaUrl}" style="display: inline-block; background-color: ${BRAND.signal}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px;">
                ${ctaLabel}
              </a>
            </td>
          </tr>` : '<tr><td style="padding: 16px;"></td></tr>'}
          ${footerHtml ? `
          <tr>
            <td dir="${dir}" style="padding: 0 32px 24px 32px; text-align: ${align};">${footerHtml}</td>
          </tr>` : ''}`;
}

// English only, the way every email used to be (the supplier-facing emails below still use this).
function wrapEmailBody({ heading, bodyHtml, ctaUrl, ctaLabel }) {
  return shell(section({ heading, bodyHtml, ctaUrl, ctaLabel }));
}

const DIVIDER = `
          <tr><td style="padding: 8px 32px;"><div style="border-top: 1px solid ${BRAND.line};"></div></td></tr>`;

// `build('en' | 'ar')` returns { heading, bodyHtml, text, ctaUrl?, ctaLabel?, footerHtml? } for ONE language; this puts one or both together.
function composeEmail(lang, build) {
  const languages = lang === 'ar' ? ['ar'] : lang === 'both' ? ['en', 'ar'] : ['en'];
  const parts = languages.map((l) => ({ l, ...build(l) }));
  const html = shell(parts.map((p, i) => (i > 0 ? DIVIDER : '') + section({ ...p, dir: p.l === 'ar' ? 'rtl' : 'ltr' })).join(''), { lang: languages.length === 1 ? languages[0] : 'en' });
  const text = parts.map((p) => p.text).join('\n\n----------\n\n');
  return { html, text };
}

const greeting = (l, name) => (l === 'ar' ? (name ? `مرحبًا ${name}،` : 'مرحبًا،') : (name ? `Hi ${name},` : 'Hi,'));
const money = (amount, currencyCode) => `${amount.toFixed(2)} ${currencyCode}`;

// The reset email: the BUTTON opens a reset page that works in any browser, and the CODE (the same secret) can be typed into the app instead.
function passwordResetEmail({ recipientName, resetUrl, expiryMinutes, code, lang = 'en' }) {
  return composeEmail(lang, (l) => {
    const hi = greeting(l, recipientName);
    const ar = l === 'ar';
    const body = ar
      ? 'تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في Leap. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.'
      : 'We received a request to reset your Leap password. Click the button below to choose a new one.';
    const expiry = ar
      ? `تنتهي صلاحية هذا الرابط خلال ${expiryMinutes} دقيقة. إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة بأمان — لن يتم تغيير كلمة مرورك.`
      : `This link expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.`;
    const codeLabel = ar ? 'أو أدخل هذا الرمز في تطبيق Leap:' : 'Or enter this code in the Leap app:';
    const pasteLabel = ar ? 'أو الصق هذا الرابط في المتصفح:' : 'Or paste this link into your browser:';
    const codeBlock = code ? `
      <div style="font-size: 12.5px; color: ${BRAND.muted}; margin-top: 4px;">${codeLabel}</div>
      <div dir="ltr" style="font-family: Consolas, 'Courier New', monospace; font-size: 13px; text-align: left; background-color: ${BRAND.chalk}; border: 1px dashed ${BRAND.line}; border-radius: 8px; padding: 10px 12px; margin-top: 6px; word-break: break-all;">${code}</div>` : '';
    return {
      heading: ar ? 'إعادة تعيين كلمة المرور' : 'Reset your password',
      bodyHtml: `${hi}<br/><br/>${body}`,
      ctaUrl: resetUrl,
      ctaLabel: ar ? 'إعادة تعيين كلمة المرور' : 'Reset Password',
      footerHtml: `${codeBlock}
      <div style="font-size: 12.5px; color: ${BRAND.muted}; line-height: 1.6; margin-top: 14px;">${expiry}</div>
      <div dir="ltr" style="font-size: 12px; color: ${BRAND.muted}; margin-top: 12px; word-break: break-all; text-align: ${ar ? 'right' : 'left'};">${pasteLabel} ${resetUrl}</div>`,
      text: `${hi}\n\n${ar ? 'تلقينا طلبًا لإعادة تعيين كلمة مرور حسابك في Leap. افتح هذا الرابط لاختيار كلمة مرور جديدة:' : 'We received a request to reset your Leap password. Open this link to choose a new one:'}\n\n${resetUrl}\n\n${code ? `${codeLabel}\n${code}\n\n` : ''}${expiry}`,
    };
  });
}

function orderConfirmationEmail({ recipientName, orderId, items, total, currencyCode, lang = 'en' }) {
  return composeEmail(lang, (l) => {
    const hi = greeting(l, recipientName);
    const ar = l === 'ar';
    const itemsHtml = items.map((i) => `<div style="padding: 6px 0; border-bottom: 1px solid ${BRAND.line};">${i.quantity} × ${i.name} — ${money(i.price, currencyCode)}</div>`).join('');
    const thanks = ar ? 'شكرًا لطلبك — لقد استلمناه ونقوم بتجهيزه.' : "Thanks for your order — we've received it and it's being prepared.";
    const orderLabel = ar ? `الطلب ${orderId}` : `Order ${orderId}`;
    const totalLabel = ar ? `الإجمالي: ${money(total, currencyCode)}` : `Total: ${money(total, currencyCode)}`;
    const later = ar ? 'سنراسلك مرة أخرى عند شحنه.' : "We'll email you again once it ships.";
    return {
      heading: ar ? 'تم تأكيد طلبك' : 'Order confirmed',
      bodyHtml: `
    ${hi}<br/><br/>
    ${thanks}
    <div style="margin: 16px 0; padding: 12px; background-color: ${BRAND.chalk}; border-radius: 8px;">
      <div style="font-weight: 700; margin-bottom: 8px;">${orderLabel}</div>
      ${itemsHtml}
      <div style="padding-top: 8px; font-weight: 700;">${totalLabel}</div>
    </div>
    ${later}`,
      text: ar
        ? `${hi}\n\nشكرًا لطلبك ${orderId} — لقد استلمناه ونقوم بتجهيزه. الإجمالي: ${money(total, currencyCode)}. سنراسلك مرة أخرى عند شحنه.`
        : `${hi}\n\nThanks for your order ${orderId} — we've received it and it's being prepared. Total: ${money(total, currencyCode)}. We'll email you again once it ships.`,
    };
  });
}

function shippingNotificationEmail({ recipientName, orderId, trackingNumber, lang = 'en' }) {
  return composeEmail(lang, (l) => {
    const hi = greeting(l, recipientName);
    const ar = l === 'ar';
    const trackingLine = trackingNumber ? `<br/><br/>${ar ? 'رقم التتبع' : 'Tracking number'}: <strong dir="ltr">${trackingNumber}</strong>` : '';
    return {
      heading: ar ? 'تم شحن طلبك' : 'Your order has shipped',
      bodyHtml: ar
        ? `${hi}<br/><br/>أخبار سارة — تم شحن الطلب <strong>${orderId}</strong>.${trackingLine}`
        : `${hi}<br/><br/>Good news — order <strong>${orderId}</strong> has shipped.${trackingLine}`,
      text: ar
        ? `${hi}\n\nأخبار سارة — تم شحن الطلب ${orderId}.${trackingNumber ? ` رقم التتبع: ${trackingNumber}` : ''}`
        : `${hi}\n\nGood news — order ${orderId} has shipped.${trackingNumber ? ` Tracking number: ${trackingNumber}` : ''}`,
    };
  });
}

function deliveryNotificationEmail({ recipientName, orderId, lang = 'en' }) {
  return composeEmail(lang, (l) => {
    const hi = greeting(l, recipientName);
    const ar = l === 'ar';
    const line = ar
      ? `تم تسليم الطلب <strong>${orderId}</strong>. نأمل أن يكون كل شيء قد وصل بحالة ممتازة — أخبرنا إذا كان هناك أي مشكلة.`
      : `Order <strong>${orderId}</strong> has been delivered. We hope everything arrived in great shape — let us know if anything's wrong.`;
    return {
      heading: ar ? 'تم تسليم طلبك' : 'Your order has been delivered',
      bodyHtml: `${hi}<br/><br/>${line}`,
      text: `${hi}\n\n${line.replace(/<\/?strong>/g, '')}`,
    };
  });
}

// Welcome email: confirms a new buyer account was created.
function welcomeEmail({ recipientName, lang = 'en' }) {
  return composeEmail(lang, (l) => {
    const hi = greeting(l, recipientName);
    const ar = l === 'ar';
    const line = ar
      ? 'مرحبًا بك في Leap! حسابك جاهز — ابدأ تصفح قطع غيار مؤكدة التوافق لمركبتك بالضبط.'
      : 'Welcome to Leap! Your account is ready — start browsing real, fitment-confirmed parts for your exact vehicle.';
    return {
      heading: ar ? 'مرحبًا بك في Leap' : 'Welcome to Leap',
      bodyHtml: `${hi}<br/><br/>${line}`,
      ctaUrl: process.env.STOREFRONT_URL || 'http://localhost:3001',
      ctaLabel: ar ? 'ابدأ التسوق' : 'Start shopping',
      text: `${hi}\n\n${line}`,
    };
  });
}

function payoutConfirmationEmail({ recipientName, amount, currencyCode, subOrderCount }) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const bodyHtml = `${greeting}<br/><br/>A payout of <strong>${amount.toFixed(2)} ${currencyCode}</strong> covering ${subOrderCount} order${subOrderCount === 1 ? '' : 's'} has been recorded to your account.`;
  const html = wrapEmailBody({ heading: 'Payout recorded', bodyHtml });
  const text = `${greeting}\n\nA payout of ${amount.toFixed(2)} ${currencyCode} covering ${subOrderCount} order${subOrderCount === 1 ? '' : 's'} has been recorded to your account.`;
  return { html, text };
}

// Real supplier verification outcome emails (new) -- closes a real,
// significant gap: nothing at all notified a supplier whether their
// application was verified or rejected -- no email, no in-app
// notification, the whole flow relied on them manually re-checking
// the supplier portal indefinitely.
function supplierVerifiedEmail({ supplierName }) {
  const bodyHtml = `Good news — <strong>${supplierName}</strong>'s application to sell on Leap has been verified. You can now list real products and start selling.`;
  const html = wrapEmailBody({ heading: "You're verified!", bodyHtml, ctaUrl: process.env.SUPPLIER_PORTAL_URL || 'http://localhost:5174', ctaLabel: 'Go to your supplier portal' });
  const text = `Good news -- ${supplierName}'s application to sell on Leap has been verified. You can now list real products and start selling.`;
  return { html, text };
}

function supplierRejectedEmail({ supplierName }) {
  const bodyHtml = `We reviewed <strong>${supplierName}</strong>'s application to sell on Leap and are unable to approve it at this time. If you believe this is a mistake or would like more detail, please reply to this email.`;
  const html = wrapEmailBody({ heading: 'Update on your application', bodyHtml });
  const text = `We reviewed ${supplierName}'s application to sell on Leap and are unable to approve it at this time. If you believe this is a mistake or would like more detail, please reply to this email.`;
  return { html, text };
}

module.exports = { passwordResetEmail, orderConfirmationEmail, shippingNotificationEmail, deliveryNotificationEmail, payoutConfirmationEmail, welcomeEmail, supplierVerifiedEmail, supplierRejectedEmail, wrapEmailBody };
