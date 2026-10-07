#!/usr/bin/env node
/**
 * Sends ONE real test email through exactly the same code the backend uses, so a new email provider (or Mailpit) can be checked in one step.
 *
 *   node scripts/send-test-email.js you@example.com          (English)
 *   node scripts/send-test-email.js you@example.com ar       (Arabic)
 *   node scripts/send-test-email.js you@example.com both     (English then Arabic, what a guest sees)
 *
 * Run it from the services/api folder. It reads services/api/.env like the backend does.
 */
require('dotenv').config();
const { isEmailConfigured, sendTransactionalEmail } = require('../src/modules/email/client');
const { deliveryNotificationEmail } = require('../src/modules/email/templates');
const { emailSubject } = require('../src/modules/email/language');

async function main() {
  const to = process.argv[2];
  const lang = process.argv[3] || 'en';
  if (!to || !to.includes('@') || !['en', 'ar', 'both'].includes(lang)) {
    console.error('Usage: node scripts/send-test-email.js <address> [en|ar|both]');
    process.exit(2);
  }
  if (!isEmailConfigured()) {
    console.error('Email is NOT configured: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD and SMTP_FROM_EMAIL in services/api/.env (see .env.example), then run this again.');
    process.exit(1);
  }
  const { html, text } = deliveryNotificationEmail({ recipientName: 'Test Buyer', orderId: 'LP-TEST-0001', lang });
  console.log(`Sending a test email to ${to} (language: ${lang}) through ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} ...`);
  await sendTransactionalEmail({ to, subject: `[TEST] ${emailSubject('orderDelivered', lang, { orderId: 'LP-TEST-0001' })}`, html, text, fallbackLogLabel: 'test-email' });
  console.log('Sent. Check the inbox (for Mailpit: http://localhost:8025).');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
