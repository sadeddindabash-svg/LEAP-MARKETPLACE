// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const BACKEND_URL = 'http://localhost:4000';
const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';

async function isBackendUp() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
const backendUp = await isBackendUp();

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION = fs.readFileSync(path.resolve(here, '../../../services/api/db/migrations/093_notification_language.sql'), 'utf8');
// The re-runnable part of the migration: it only ever touches rows that still have no Arabic text.
const BACKFILL_SQL = MIGRATION.slice(MIGRATION.indexOf('-- ===== BACKFILL'));

const pool = new Pool({ connectionString: TEST_DB_URL });
afterAll(async () => { await pool.end(); });
const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// How notifications looked BEFORE Arabic existed: English only.
const OLD_ROWS = [
  ['order_status', 'Your order has shipped', 'Order LP-1 is on its way to you. Tracking number: HUB-77', 'order', 'LP-1'],
  ['order_status', 'Your order has shipped', 'Order LP-2 is now shipped.', 'order', 'LP-2'],
  ['order_status', 'Your order has been delivered', 'Order LP-3 is now delivered.', 'order', 'LP-3'],
  ['order_status', 'Your order is on its way to our inspection hub', 'Order LP-4 has been sent by the supplier to our inspection hub. We will tell you when it ships to you.', 'order', 'LP-4'],
  ['order_status', 'Your order is taking longer than expected', "Order LP-5 hasn't had an update in a while. We're keeping an eye on it.", 'order', 'LP-5'],
  ['return_status', 'Your return request was updated', 'Return RC-1 is now in_progress.', 'order', 'LP-6'],
  ['return_status', 'Your return request was updated', 'Return RC-2 is now approved.', 'order', 'LP-6'],
  ['return_status', 'Your return request was updated', 'There is an update on return RC-3.', 'order', 'LP-6'],
  ['return_status', 'Your return request was updated\nتم تحديث طلب الإرجاع الخاص بك', 'We are refunding $10.00. It is being processed.\nسيتم استرداد مبلغ 10.00$. جارٍ معالجته.', 'order', 'LP-7'],
  ['account_anniversary', 'Happy 1 year with LEAP!', 'Thanks for being with us for 1 year. We appreciate you.', null, null],
  ['account_anniversary', 'Happy 2 years with LEAP!', 'Thanks for being with us for 2 years. We appreciate you.', null, null],
  ['account_anniversary', 'Happy 5 years with LEAP!', 'Thanks for being with us for 5 years. We appreciate you.', null, null],
  ['account_anniversary', 'Happy 12 years with LEAP!', 'Thanks for being with us for 12 years. We appreciate you.', null, null],
  ['referral_reward', 'You earned a referral reward!', 'Someone you referred placed their first order. Use code REF-AB12 for 10% off your next order.', 'promo_code', 'REF-AB12'],
  ['ticket_reply', 'New reply on your support ticket', '"Late parcel": We are on it, sorry.', 'ticket', '7'],
  // these must be LEFT ALONE: no known pattern
  ['saved_search_match', 'New results for a saved search', '"brakes" has 5 new matches: A, B, C…', 'saved_search', '1'],
  ['low_stock', 'Low stock alert', 'Brake Disc is low on stock.', 'product', 'p1'],
  ['order_status', 'Your order has shipped', 'Something we have never written before', 'order', 'LP-9'],
];

async function plantOldRows() {
  const user = await fetch(`${BACKEND_URL}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `bf-${uniq()}@example.com`, password: 'test_password_123' }) }).then((r) => r.json());
  for (const [type, title, body, linkType, linkId] of OLD_ROWS) {
    await pool.query('INSERT INTO notifications (user_id, type, title, body, link_type, link_id) VALUES ($1, $2, $3, $4, $5, $6)', [user.user.id, type, title, body, linkType, linkId]);
  }
  return user.user.id;
}
const rowsOf = async (userId) => (await pool.query('SELECT type, title, title_ar, body, body_ar FROM notifications WHERE user_id = $1 ORDER BY id', [userId])).rows;
const byBody = (rows, text) => rows.find((r) => r.body === text || r.body.startsWith(text));

describe.runIf(backendUp)('migration 093\'s backfill gives older notifications an Arabic text (real database)', () => {
  it('CRITICAL: every old notification with a known pattern gains correct Arabic; the English is never altered', async () => {
    const userId = await plantOldRows();
    await pool.query(BACKFILL_SQL);
    const rows = await rowsOf(userId);

    const shipped = byBody(rows, 'Order LP-1 is on its way');
    expect(shipped).toMatchObject({ title_ar: 'تم شحن طلبك', body_ar: 'طلبك LP-1 في طريقه إليك. رقم التتبع: HUB-77' });
    expect(byBody(rows, 'Order LP-2 is now shipped.').body_ar).toBe('تم شحن الطلب LP-2.');
    expect(byBody(rows, 'Order LP-3 is now delivered.')).toMatchObject({ title_ar: 'تم تسليم طلبك', body_ar: 'تم تسليم الطلب LP-3.' });
    expect(byBody(rows, 'Order LP-4 has been sent').title_ar).toBe('طلبك في طريقه إلى مركز الفحص لدينا');
    expect(byBody(rows, 'Order LP-4 has been sent').body_ar).toBe('قام المورّد بإرسال الطلب LP-4 إلى مركز الفحص لدينا. سنخبرك عند شحنه إليك.');
    expect(byBody(rows, 'Order LP-5').body_ar).toBe('لم يطرأ أي تحديث على الطلب LP-5 منذ فترة. نحن نتابعه عن كثب.');

    // return statuses use the app's own Arabic words
    expect(byBody(rows, 'Return RC-1 is now in_progress.').body_ar).toBe('أصبحت حالة الإرجاع RC-1: قيد التنفيذ.');
    expect(byBody(rows, 'Return RC-2 is now approved.').body_ar).toBe('أصبحت حالة الإرجاع RC-2: موافق عليه.');
    expect(byBody(rows, 'There is an update on return RC-3.').body_ar).toBe('هناك تحديث بشأن الإرجاع RC-3.');

    // the old "English<newline>Arabic" fault-case messages are split into their own fields
    const split = byBody(rows, 'We are refunding $10.00. It is being processed.');
    expect(split).toMatchObject({ title: 'Your return request was updated', title_ar: 'تم تحديث طلب الإرجاع الخاص بك', body: 'We are refunding $10.00. It is being processed.', body_ar: 'سيتم استرداد مبلغ 10.00$. جارٍ معالجته.' });

    // the Arabic form of "N years" depends on N
    expect(byBody(rows, 'Thanks for being with us for 1 year.')).toMatchObject({ title_ar: 'مرّ عام على انضمامك إلى ليب!', body_ar: 'شكرًا لبقائك معنا لمدة عام. نقدّر ثقتك بنا.' });
    expect(byBody(rows, 'Thanks for being with us for 2 years.').title_ar).toBe('مرّ عامان على انضمامك إلى ليب!');
    expect(byBody(rows, 'Thanks for being with us for 5 years.').title_ar).toBe('مرّت 5 أعوام على انضمامك إلى ليب!');
    expect(byBody(rows, 'Thanks for being with us for 12 years.')).toMatchObject({ title_ar: 'مرّ 12 عامًا على انضمامك إلى ليب!', body_ar: 'شكرًا لبقائك معنا لمدة 12 عامًا. نقدّر ثقتك بنا.' });

    expect(byBody(rows, 'Someone you referred').body_ar).toBe('قام شخص دعوته بتقديم أول طلب له. استخدم الرمز REF-AB12 للحصول على خصم 10% على طلبك القادم.');
    expect(byBody(rows, '"Late parcel"')).toMatchObject({ title_ar: 'رد جديد على تذكرة الدعم الخاصة بك', body_ar: '"Late parcel": We are on it, sorry.' });

    // every English text is exactly as it was written (apart from the one split above)
    for (const [, title, body] of OLD_ROWS.filter((r) => !r[1].includes('\n'))) {
      expect(rows.some((r) => r.title === title && r.body === body), `${title} / ${body}`).toBe(true);
    }
  }, 30000);

  it('notifications that match no known pattern are left exactly as they were (they simply stay English)', async () => {
    const userId = await plantOldRows();
    await pool.query(BACKFILL_SQL);
    const rows = await rowsOf(userId);
    for (const text of ['"brakes" has 5 new matches: A, B, C…', 'Brake Disc is low on stock.', 'Something we have never written before']) {
      const row = rows.find((r) => r.body === text);
      expect(row, text).toBeTruthy();
      expect(row.title_ar).toBeNull();
      expect(row.body_ar).toBeNull();
    }
  }, 30000);

  it('CRITICAL: running it again changes nothing (it is safe to repeat, and never re-translates or re-splits)', async () => {
    const userId = await plantOldRows();
    await pool.query(BACKFILL_SQL);
    const first = await rowsOf(userId);
    await pool.query(BACKFILL_SQL);
    await pool.query(BACKFILL_SQL);
    expect(await rowsOf(userId)).toEqual(first);
  }, 30000);

  it('it never overwrites an Arabic text a notification already has', async () => {
    const userId = await plantOldRows();
    await pool.query(`INSERT INTO notifications (user_id, type, title, body, title_ar, body_ar) VALUES ($1, 'order_status', 'Your order has been delivered', 'Order LP-77 is now delivered.', 'عنوان مخصص', 'نص مخصص')`, [userId]);
    await pool.query(BACKFILL_SQL);
    const kept = (await rowsOf(userId)).find((r) => r.body === 'Order LP-77 is now delivered.');
    expect(kept).toMatchObject({ title_ar: 'عنوان مخصص', body_ar: 'نص مخصص' });
  }, 30000);
});
