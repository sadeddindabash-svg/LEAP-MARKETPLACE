// Catalog moderation: rejecting a product with the reasons the admin ticked (and an optional note), and telling its supplier.
const db = require('../../../db/pool');
const { createNotification } = require('../notifications/helpers');

// The reasons the admin chooses from. The key is stored; the supplier sees the Chinese or English text.
const REJECTION_REASONS = {
  wrong_category: { en: 'Wrong category', zh: '分类错误' },
  wrong_photos: { en: 'Wrong photos', zh: '照片不符' },
  wrong_part: { en: 'Wrong part classification', zh: '部件类型错误' },
  wrong_fitment: { en: 'Wrong vehicle (fitment)', zh: '适配车型错误' },
  wrong_oe: { en: 'Wrong OE number', zh: 'OE 编号错误' },
  wrong_price: { en: 'Price looks wrong', zh: '价格异常' },
  unclear_text: { en: 'Name or description not clear', zh: '名称或描述不清楚' },
  duplicate: { en: 'Duplicate product', zh: '重复商品' },
  other: { en: 'Other', zh: '其他' },
};
const MAX_NOTE = 500;

/** Checks what the admin sent with a reject. Returns { error } or { reasons, note }. */
function validateRejection(reasons, note) {
  if (!Array.isArray(reasons) || reasons.length === 0) return { error: 'Choose at least one rejection reason' };
  const unique = [...new Set(reasons.map((r) => String(r)))];
  const unknown = unique.filter((r) => !REJECTION_REASONS[r]);
  if (unknown.length > 0) return { error: `Unknown rejection reason(s): ${unknown.join(', ')}` };
  const text = typeof note === 'string' ? note.trim() : '';
  if (unique.includes('other') && !text) return { error: 'Write a note when the reason is Other' };
  if (text.length > MAX_NOTE) return { error: `The note must be at most ${MAX_NOTE} characters` };
  return { reasons: unique, note: text || null };
}

async function saveRejection(q, productId, reasons, note) {
  await q.query('UPDATE products SET rejection_reasons = $2, rejection_note = $3, rejected_at = now() WHERE id = $1', [productId, reasons, note]);
}
async function clearRejection(q, productId) {
  await q.query('UPDATE products SET rejection_reasons = NULL, rejection_note = NULL, rejected_at = NULL WHERE id = $1', [productId]);
}

const reasonsText = (reasons, lang) => reasons.map((r) => (REJECTION_REASONS[r] || { [lang]: r })[lang]).join(lang === 'zh' ? '、' : ', ');

/** Tells every user of the product's supplier (bell, and whatever else createNotification sends). Never throws: a failed notice must not undo the rejection. */
async function notifySupplierOfRejection(productId, reasons, note) {
  try {
    const { rows } = await db.query('SELECT supplier_id, name_zh, name, oem_number FROM products WHERE id = $1', [productId]);
    if (rows.length === 0 || !rows[0].supplier_id) return;
    const p = rows[0];
    const productName = p.name_zh || p.name || productId;
    const { rows: users } = await db.query("SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier'", [p.supplier_id]);
    // Bilingual: the supplier reads Chinese or English, and a notification is stored as text.
    const title = `商品未通过审核 Product rejected: ${productName}`;
    const body = `拒绝原因：${reasonsText(reasons, 'zh')} | Reasons: ${reasonsText(reasons, 'en')}`
      + (note ? ` | 说明 Note: ${note}` : '')
      + ' | 请在“我的草稿（未发布）”中修改并重新提交 Fix it in My Drafts (Not published) and submit it again.';
    for (const u of users) {
      try {
        await createNotification({ userId: u.id, type: 'product_rejected', title, body });
      } catch (err) {
        console.error('[product rejected] notification failed (non-fatal):', err.message);
      }
    }
  } catch (err) {
    console.error('[product rejected] could not notify the supplier (non-fatal):', err.message);
  }
}

module.exports = { REJECTION_REASONS, validateRejection, saveRejection, clearRejection, notifySupplierOfRejection };
