-- Migration 093: notifications in the buyer's own language.
--
-- THE GAP: every notification was stored as ONE English string, so a buyer using the app in Arabic still got English
-- notifications (and the app never told the server which language it was in).
--
-- A notification now carries an English text (title, body -- unchanged) AND an optional Arabic text (title_ar, body_ar).
-- Whoever reads it asks for a language and gets that text, falling back to English field by field when there is no
-- Arabic one (see src/modules/notifications/i18n.js). Notifications for SUPPLIERS stay English-only for now.
--
-- users.language is the language the buyer's app last said it was using (it tells us when it loads notifications). Push
-- notifications are sent in the moment an event happens, with no app request to ask, so they use this remembered value.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS title_ar TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS body_ar TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar'));

-- ===== BACKFILL (safe to run again: every statement only touches rows that still have no Arabic text) =====
-- Notifications that already exist are English only. Where an old notification followed a fixed pattern, its Arabic text can be
-- worked out from it, so the buyer's history is not left half in English. The wording matches src/modules/notifications/messages.js.
-- Anything that does not match a known pattern (a search label, a person's own words) is left alone: it simply stays English.

-- Fault-case messages were stored as "English<newline>Arabic" in one string: split them into their own fields.
UPDATE notifications
SET title_ar = split_part(title, E'\n', 2),
    body_ar  = CASE WHEN position(E'\n' in body) > 0 THEN substr(body, position(E'\n' in body) + 1) ELSE NULL END,
    body     = split_part(body, E'\n', 1),
    title    = split_part(title, E'\n', 1)
WHERE title_ar IS NULL AND type = 'return_status' AND position(E'\n' in title) > 0;

-- Orders
UPDATE notifications SET title_ar = 'تم شحن طلبك',
  body_ar = regexp_replace(body, '^Order (.+) is on its way to you\. Tracking number: (.+)$', 'طلبك \1 في طريقه إليك. رقم التتبع: \2')
WHERE title_ar IS NULL AND type = 'order_status' AND title = 'Your order has shipped' AND body ~ '^Order (.+) is on its way to you\. Tracking number: (.+)$';

-- the older wording, from before the hub's own tracking number was included
UPDATE notifications SET title_ar = 'تم شحن طلبك',
  body_ar = regexp_replace(body, '^Order (.+) is now shipped\.$', 'تم شحن الطلب \1.')
WHERE title_ar IS NULL AND type = 'order_status' AND title = 'Your order has shipped' AND body ~ '^Order (.+) is now shipped\.$';

UPDATE notifications SET title_ar = 'تم تسليم طلبك',
  body_ar = regexp_replace(body, '^Order (.+) is now delivered\.$', 'تم تسليم الطلب \1.')
WHERE title_ar IS NULL AND type = 'order_status' AND title = 'Your order has been delivered' AND body ~ '^Order (.+) is now delivered\.$';

UPDATE notifications SET title_ar = 'طلبك في طريقه إلى مركز الفحص لدينا',
  body_ar = regexp_replace(body, '^Order (.+) has been sent by the supplier to our inspection hub\. We will tell you when it ships to you\.$', 'قام المورّد بإرسال الطلب \1 إلى مركز الفحص لدينا. سنخبرك عند شحنه إليك.')
WHERE title_ar IS NULL AND type = 'order_status' AND title = 'Your order is on its way to our inspection hub'
  AND body ~ '^Order (.+) has been sent by the supplier to our inspection hub\. We will tell you when it ships to you\.$';

UPDATE notifications SET title_ar = 'طلبك يستغرق وقتًا أطول من المتوقع',
  body_ar = regexp_replace(body, '^Order (.+) hasn''t had an update in a while\. We''re keeping an eye on it\.$', 'لم يطرأ أي تحديث على الطلب \1 منذ فترة. نحن نتابعه عن كثب.')
WHERE title_ar IS NULL AND type = 'order_status' AND title = 'Your order is taking longer than expected'
  AND body ~ '^Order (.+) hasn''t had an update in a while\. We''re keeping an eye on it\.$';

-- Returns
UPDATE notifications SET title_ar = 'تم تحديث طلب الإرجاع الخاص بك',
  body_ar = 'أصبحت حالة الإرجاع ' || (regexp_match(body, '^Return (.+) is now (.+)\.$'))[1] || ': ' ||
    CASE (regexp_match(body, '^Return (.+) is now (.+)\.$'))[2]
      WHEN 'awaiting' THEN 'قيد المراجعة' WHEN 'in_progress' THEN 'قيد التنفيذ' WHEN 'approved' THEN 'موافق عليه'
      WHEN 'rejected' THEN 'مرفوض' WHEN 'completed' THEN 'مكتمل'
      ELSE (regexp_match(body, '^Return (.+) is now (.+)\.$'))[2] END || '.'
WHERE title_ar IS NULL AND type = 'return_status' AND title = 'Your return request was updated' AND body ~ '^Return (.+) is now (.+)\.$';

UPDATE notifications SET title_ar = 'تم تحديث طلب الإرجاع الخاص بك',
  body_ar = regexp_replace(body, '^There is an update on return (.+)\.$', 'هناك تحديث بشأن الإرجاع \1.')
WHERE title_ar IS NULL AND type = 'return_status' AND title = 'Your return request was updated' AND body ~ '^There is an update on return (.+)\.$';

-- Account anniversary: the Arabic form of "N years" depends on N
UPDATE notifications n SET
  title_ar = CASE s.y WHEN 1 THEN 'مرّ عام على انضمامك إلى ليب!' WHEN 2 THEN 'مرّ عامان على انضمامك إلى ليب!'
                      ELSE CASE WHEN s.y <= 10 THEN 'مرّت ' || s.y || ' أعوام على انضمامك إلى ليب!' ELSE 'مرّ ' || s.y || ' عامًا على انضمامك إلى ليب!' END END,
  body_ar = 'شكرًا لبقائك معنا لمدة ' ||
            CASE s.y WHEN 1 THEN 'عام' WHEN 2 THEN 'عامين' ELSE CASE WHEN s.y <= 10 THEN s.y || ' أعوام' ELSE s.y || ' عامًا' END END ||
            '. نقدّر ثقتك بنا.'
FROM (SELECT id, ((regexp_match(title, '^Happy (\d+) years? with LEAP!$'))[1])::int AS y
      FROM notifications WHERE title_ar IS NULL AND type = 'account_anniversary' AND title ~ '^Happy (\d+) years? with LEAP!$') s
WHERE n.id = s.id;

-- Referral reward
UPDATE notifications SET title_ar = 'حصلت على مكافأة إحالة!',
  body_ar = regexp_replace(body, '^Someone you referred placed their first order\. Use code (.+) for (\d+)% off your next order\.$',
                           'قام شخص دعوته بتقديم أول طلب له. استخدم الرمز \1 للحصول على خصم \2% على طلبك القادم.')
WHERE title_ar IS NULL AND type = 'referral_reward' AND title = 'You earned a referral reward!'
  AND body ~ '^Someone you referred placed their first order\. Use code (.+) for (\d+)% off your next order\.$';

-- Support reply: only the title is translated; the reply itself is the admin's own words
UPDATE notifications SET title_ar = 'رد جديد على تذكرة الدعم الخاصة بك', body_ar = body
WHERE title_ar IS NULL AND type = 'ticket_reply' AND title = 'New reply on your support ticket';

-- Wishlist: use the product's Arabic name when it has one
UPDATE notifications n SET title_ar = 'عاد للتوفر',
  body_ar = COALESCE(NULLIF(p.name_ar, ''), p.name) || ' متوفر الآن مرة أخرى.'
FROM products p
WHERE n.title_ar IS NULL AND n.type = 'back_in_stock' AND n.title = 'Back in stock' AND n.link_type = 'product' AND n.link_id = p.id;

UPDATE notifications n SET title_ar = 'انخفاض سعر منتج في المفضلة',
  body_ar = 'انخفض سعر ' || COALESCE(NULLIF(p.name_ar, ''), (regexp_match(n.body, '^(.+) dropped to \$([0-9.]+) \(was \$([0-9.]+)\)\.$'))[1]) ||
            ' إلى $' || (regexp_match(n.body, '^(.+) dropped to \$([0-9.]+) \(was \$([0-9.]+)\)\.$'))[2] ||
            ' (كان $' || (regexp_match(n.body, '^(.+) dropped to \$([0-9.]+) \(was \$([0-9.]+)\)\.$'))[3] || ').'
FROM products p
WHERE n.title_ar IS NULL AND n.type = 'price_drop' AND n.title = 'Price drop on a wishlist item' AND n.link_type = 'product' AND n.link_id = p.id
  AND n.body ~ '^(.+) dropped to \$([0-9.]+) \(was \$([0-9.]+)\)\.$';
