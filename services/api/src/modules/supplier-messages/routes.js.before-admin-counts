const express = require('express');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { translateText } = require('./translate');
const { createNotification } = require('../notifications/helpers');

/**
 * Real supplier <-> platform messaging, with real bidirectional
 * Chinese/English auto-translation (Baidu Translate — see translate.js
 * for the full honest state of that integration). Deliberately separate
 * from support_tickets — see migration 016's header comment for why.
 */
const router = express.Router();

function toMessageDto(row) {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    senderRole: row.sender_role,
    originalText: row.original_text,
    originalLanguage: row.original_language,
    translatedText: row.translated_text,
    translatedLanguage: row.translated_language,
    translationStatus: row.translation_status,
    createdAt: row.created_at,
  };
}

// Real send logic, shared by both the supplier's own endpoint and the
// admin endpoint below — the only difference is which language is the
// "original" (supplier always writes zh, admin always writes en, per
// the confirmed requirement), not the underlying mechanics.
async function sendMessage({ supplierId, senderRole, senderId, text }) {
  const originalLanguage = senderRole === 'supplier' ? 'zh' : 'en';
  const translatedLanguage = senderRole === 'supplier' ? 'en' : 'zh';
  const { translatedText, status } = await translateText(text, originalLanguage, translatedLanguage);

  const { rows } = await db.query(
    `INSERT INTO supplier_messages
       (supplier_id, sender_role, sender_id, original_text, original_language, translated_text, translated_language, translation_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [supplierId, senderRole, senderId || null, text, originalLanguage, translatedText, translatedLanguage, status]
  );
  return toMessageDto(rows[0]);
}

// ---------------- Supplier's own side ----------------

router.get('/me', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM supplier_messages WHERE supplier_id = $1 ORDER BY created_at ASC',
      [req.user.supplierId]
    );
    res.json(rows.map(toMessageDto));
  } catch (err) {
    next(err);
  }
});

router.post('/me', requireAuth, requireRole('supplier'), async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const message = await sendMessage({ supplierId: req.user.supplierId, senderRole: 'supplier', senderId: req.user.id, text: text.trim() });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// ---------------- Admin side ----------------

// GET /supplier-messages/admin — a real inbox: every supplier that has
// at least one real message, with their most recent one, ordered by
// recency — same "most recently active first" idea as any real inbox.
router.get('/admin', requireAuth, requireRole('admin'), requirePageAccess('supplierMessages'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (sm.supplier_id)
         sm.supplier_id, s.name AS supplier_name, sm.original_text, sm.translated_text,
         sm.sender_role, sm.translation_status, sm.created_at
       FROM supplier_messages sm
       JOIN suppliers s ON s.id = sm.supplier_id
       ORDER BY sm.supplier_id, sm.created_at DESC`
    );
    // Real "most recent overall" ordering across suppliers, not just
    // grouped arbitrarily — DISTINCT ON above picks one row per
    // supplier (their latest), this sorts THOSE by recency.
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(rows.map((r) => ({
      supplierId: r.supplier_id,
      supplierName: r.supplier_name,
      lastMessagePreview: r.sender_role === 'admin' ? r.original_text : (r.translated_text || r.original_text),
      lastMessageAt: r.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/admin/:supplierId', requireAuth, requireRole('admin'), requirePageAccess('supplierMessages'), async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM supplier_messages WHERE supplier_id = $1 ORDER BY created_at ASC',
      [req.params.supplierId]
    );
    res.json(rows.map(toMessageDto));
  } catch (err) {
    next(err);
  }
});

router.post('/admin/:supplierId', requireAuth, requireRole('admin'), requirePageAccess('supplierMessages'), async (req, res, next) => {
  try {
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
    const supplierCheck = await db.query('SELECT id FROM suppliers WHERE id = $1', [req.params.supplierId]);
    if (supplierCheck.rows.length === 0) return res.status(404).json({ error: 'Supplier not found' });
    const message = await sendMessage({ supplierId: req.params.supplierId, senderRole: 'admin', senderId: req.user.id, text: text.trim() });

    // Real trigger #4 (of the 4 confirmed for notifications — see
    // migration 019's header comment): an admin's real reply to a
    // supplier message notifies the real supplier's linked user
    // account. A supplier account without a linked user (shouldn't
    // exist per the real supplier_role_has_supplier_id constraint, but
    // defensively handled) just silently skips, same as a guest ticket.
    const { rows: supplierUserRows } = await db.query(
      "SELECT id FROM users WHERE supplier_id = $1 AND role = 'supplier' LIMIT 1",
      [req.params.supplierId]
    );
    await createNotification({
      userId: supplierUserRows[0]?.id,
      type: 'supplier_message',
      title: 'New message from Leap',
      body: text.trim(),
      linkType: 'supplier_message',
      linkId: req.params.supplierId,
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
