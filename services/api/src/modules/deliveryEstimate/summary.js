const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');
const { withEffectiveShippingRows } = require('../shared/partShipping');
const { isoCodeForName } = require('../shared/countries');
const { getDeliverySettings } = require('./settings');

/**
 * Delivery Rules > "How it works" > step 6 "What you are told" (confirmed with the person via mockup): what can leave a buyer without a right date.
 *   - live products with no weight or size (their own, nor their part's): hidden from buyers, because shipping cannot be priced
 *   - live products for which some destination country group has no rule that fits (they get the "no rule fits" days, or no date)
 *   - countries buyers have addresses in that are in no country group
 * 'daily' = a summary at the chosen hour; 'failures' = at that hour, only when something is missing; 'each' = within the hour whenever the
 * number of problems goes up. Checked every 15 minutes; safe to run often.
 */
function ruleFits(r, p, groupId) {
  const vol = p.weight_kg != null && p.length_cm != null && p.width_cm != null && p.height_cm != null ? Number(p.length_cm) * Number(p.width_cm) * Number(p.height_cm) : null;
  const w = p.weight_kg == null ? null : Number(p.weight_kg);
  const inRange = (v, min, max) => (min == null || (v != null && v >= Number(min))) && (max == null || (v != null && v <= Number(max)));
  return inRange(w, r.min_weight_kg, r.max_weight_kg) && inRange(vol, r.min_volume_cm3, r.max_volume_cm3)
    && (r.warehouse_country == null || r.warehouse_country === p.warehouse_country)
    && (r.destination_group_id == null || r.destination_group_id === groupId);
}

async function findProblems() {
  const { rows: raw } = await db.query(
    `SELECT p.id, p.name, p.category, p.part, p.weight_kg, p.length_cm, p.width_cm, p.height_cm, s.country AS warehouse_country
     FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.status = 'active'`
  );
  const products = await withEffectiveShippingRows(raw);
  const { rows: rules } = await db.query('SELECT * FROM delivery_rules ORDER BY sort_order ASC');
  const { rows: groups } = await db.query('SELECT id, name FROM country_groups ORDER BY sort_order ASC');
  const noSize = products.filter((p) => !p.shipping_source);
  const sized = products.filter((p) => p.shipping_source);
  const noRule = groups.length === 0 ? [] : sized.filter((p) => groups.some((g) => !rules.some((r) => ruleFits(r, p, g.id))));
  const { rows: members } = await db.query('SELECT DISTINCT iso_code FROM country_group_members');
  const grouped = new Set(members.map((m) => m.iso_code));
  const { rows: addr } = await db.query('SELECT DISTINCT country FROM buyer_addresses WHERE country IS NOT NULL').catch(() => ({ rows: [] }));
  const loose = addr.map((a) => ({ name: a.country, iso: isoCodeForName(a.country) })).filter((a) => a.iso && !grouped.has(a.iso));
  return { noSize, noRule, looseCountries: loose, total: noSize.length + noRule.length + loose.length };
}

function message(p) {
  const list = (arr, f) => arr.slice(0, 5).map(f).join(', ') + (arr.length > 5 ? ` and ${arr.length - 5} more` : '');
  const lines = [];
  if (p.noSize.length) lines.push(`${p.noSize.length} product(s) have no weight or size, so buyers cannot see them: ${list(p.noSize, (x) => x.name)}.`);
  if (p.noRule.length) lines.push(`${p.noRule.length} product(s) have no rule for some country groups: ${list(p.noRule, (x) => x.name)}.`);
  if (p.looseCountries.length) lines.push(`Buyers in ${list(p.looseCountries, (x) => x.name)} are in no country group.`);
  const body = lines.length ? lines.join(' ') + ' Open Delivery Rules to fix them.' : 'Every live product has a delivery date. Nothing to fix.';
  const bodyAr = lines.length ? `${p.noSize.length} منتج بلا وزن أو حجم، ${p.noRule.length} منتج بلا قاعدة لبعض المجموعات، ${p.looseCountries.length} دولة خارج المجموعات. افتح قواعد التوصيل لإصلاحها.` : 'كل المنتجات المعروضة لها موعد توصيل. لا شيء لإصلاحه.';
  return { title: p.total ? `Delivery dates: ${p.total} thing(s) to fix` : 'Delivery dates: all fine', body, titleAr: p.total ? `مواعيد التوصيل: ${p.total} أمر يحتاج إلى إصلاح` : 'مواعيد التوصيل: كل شيء سليم', bodyAr };
}

async function notifyAdmins(msg) {
  const { rows } = await db.query("SELECT id FROM users WHERE role = 'admin'");
  for (const u of rows) await createNotification({ userId: u.id, type: 'supplier_message', ...msg, linkType: null, linkId: null });
}

async function checkDeliveryProblems(now = new Date()) {
  const s = await getDeliverySettings({ fresh: true });
  const localHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: s.summaryTz || 'Asia/Riyadh', hour: '2-digit', hour12: false }).format(now)) % 24;
  const last = s.lastSummaryAt ? new Date(s.lastSummaryAt) : null;
  const atHour = localHour === s.summaryHour && (!last || now - last >= 20 * 3600 * 1000);
  if (s.notifyMode !== 'each' && !atHour) return { sent: false };
  if (s.notifyMode === 'each' && last && now - last < 3600 * 1000) return { sent: false };      // at most once an hour
  const p = await findProblems();
  let send = false;
  if (s.notifyMode === 'daily') send = atHour;
  else if (s.notifyMode === 'failures') send = atHour && p.total > 0;
  else send = p.total > s.lastProblemCount;
  if (atHour || s.notifyMode === 'each') await db.query('UPDATE delivery_settings SET last_summary_at = $1, last_problem_count = $2 WHERE id = 1', [send || atHour ? now : s.lastSummaryAt, p.total]);
  if (send) await notifyAdmins(message(p));
  return { sent: send, problems: p.total };
}

function startDeliverySummaryCheck() {
  const tick = async () => { try { await checkDeliveryProblems(); } catch (err) { console.error('[delivery] summary check failed (non-fatal):', err.message); } };
  setTimeout(tick, 30 * 1000);
  setInterval(tick, 15 * 60 * 1000);
}

module.exports = { findProblems, checkDeliveryProblems, startDeliverySummaryCheck, ruleFits, message };
