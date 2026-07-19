const nodemailer = require('nodemailer');

/**
 * Real, generic email delivery via SMTP (confirmed choice: build
 * generically rather than commit to one provider yet, same reasoning
 * as the S3-compatible cloud storage client). SMTP is a real, universal
 * protocol that virtually every transactional email provider supports
 * ALONGSIDE their own proprietary REST API — Resend, SendGrid, Mailgun,
 * and AWS SES all issue real SMTP credentials. This is ONE real
 * implementation (using the well-established `nodemailer` package) that
 * works with whichever gets chosen later, purely by setting different
 * environment variables. No code change needed when that decision is
 * made.
 *
 * Real environment variables (all required together to activate real
 * email delivery):
 *   SMTP_HOST       - e.g. smtp.resend.com, smtp.sendgrid.net,
 *                      smtp.mailgun.org, email-smtp.<region>.amazonaws.com
 *   SMTP_PORT       - typically 587 (STARTTLS) or 465 (implicit TLS)
 *   SMTP_USER       - the real SMTP username the provider issues
 *   SMTP_PASSWORD   - the real SMTP password/API key the provider issues
 *   SMTP_FROM_EMAIL - the real "from" address (must be a real verified
 *                      sender/domain with most providers)
 *   SMTP_FROM_NAME  - the real display name, e.g. "Leap Auto Parts"
 *
 * HONEST FALLBACK, same category as the payment gateways, translation,
 * and cloud storage: no real credentials are configured in this
 * environment. Rather than fake success without actually being able to
 * deliver an email, the caller (auth/routes.js) falls back to the
 * ORIGINAL console-logging behavior — a real, working way to test the
 * token-based reset flow, just not real delivery, exactly as documented
 * before this pass.
 */

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD && process.env.SMTP_FROM_EMAIL
  );
}

let cachedTransporter = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465, // implicit TLS on 465; STARTTLS (secure: false) on 587/others
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return cachedTransporter;
}

/**
 * Sends a real email via whichever real SMTP provider is configured.
 * Throws on failure — the caller decides how to honestly handle that
 * (see auth/routes.js's fallback to console-logging), never silently
 * swallowed here.
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: `"${process.env.SMTP_FROM_NAME || 'Leap'}" <${process.env.SMTP_FROM_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
}

/**
 * Real, best-effort transactional email send (new) -- the same real
 * pattern already established for password reset, extracted into one
 * shared helper rather than duplicated at each of the real new trigger
 * points (order confirmation, shipping/delivery notifications, payout
 * confirmation). Never throws -- a real SMTP failure (bad credentials,
 * provider rejected it, network issue) falls back to an honest console
 * log rather than losing the notification entirely, and never blocks
 * the real underlying action (placing an order, marking something
 * shipped, recording a payout) that triggered it.
 */
async function sendTransactionalEmail({ to, subject, html, text, fallbackLogLabel }) {
  if (!isEmailConfigured()) {
    console.log(`[${fallbackLogLabel}] Email not configured -- would have sent to ${to}: ${subject}`);
    return;
  }
  try {
    await sendEmail({ to, subject, html, text });
  } catch (err) {
    console.error(`[${fallbackLogLabel}] Email delivery failed, continuing without it:`, err.message);
  }
}

module.exports = { isEmailConfigured, sendEmail, sendTransactionalEmail };
