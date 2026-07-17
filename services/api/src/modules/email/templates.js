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

function passwordResetEmail({ recipientName, resetUrl, expiryMinutes }) {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const html = `
<!DOCTYPE html>
<html>
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
          <tr>
            <td style="padding: 8px 32px 0 32px;">
              <div style="font-size: 16px; font-weight: 700; color: ${BRAND.ink}; margin-bottom: 12px;">Reset your password</div>
              <div style="font-size: 14px; color: ${BRAND.ink}; line-height: 1.6;">${greeting}</div>
              <div style="font-size: 14px; color: ${BRAND.ink}; line-height: 1.6; margin-top: 8px;">
                We received a request to reset your Leap password. Click the button below to choose a new one.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px;">
              <a href="${resetUrl}" style="display: inline-block; background-color: ${BRAND.signal}; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 24px; border-radius: 8px;">
                Reset Password
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <div style="font-size: 12.5px; color: ${BRAND.muted}; line-height: 1.6;">
                This link expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.
              </div>
              <div style="font-size: 12px; color: ${BRAND.muted}; margin-top: 16px; word-break: break-all;">
                Or paste this link into your browser: ${resetUrl}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = `${greeting}

We received a request to reset your Leap password. Open this link to choose a new one:

${resetUrl}

This link expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email — your password will not be changed.`;

  return { html, text };
}

module.exports = { passwordResetEmail };
