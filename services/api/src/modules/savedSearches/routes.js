const express = require('express');
const db = require('../../../db/pool');
const { requireAuth } = require('../auth/middleware');

/**
 * Real saved searches (migration 039). CONFIRMED SCOPE: available in
 * both the mobile app and the web storefront.
 */
const router = express.Router();

function toSavedSearchDto(row) {
  return {
    id: row.id,
    label: row.label,
    searchTerm: row.search_term,
    category: row.category,
    createdAt: row.created_at,
    lastCheckedAt: row.last_checked_at,
  };
}

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM saved_searches WHERE buyer_id = $1 ORDER BY created_at DESC',
      [req.user.sub]
    );
    res.json(rows.map(toSavedSearchDto));
  } catch (err) {
    next(err);
  }
});

router.post('/me', requireAuth, async (req, res, next) => {
  try {
    const { searchTerm, category, label } = req.body || {};
    if (!searchTerm && !category) {
      return res.status(400).json({ error: 'Provide at least one of searchTerm or category to save a real search.' });
    }
    if (!label || !label.trim()) {
      return res.status(400).json({ error: 'A real label is required (e.g. what this search means to you).' });
    }
    const { rows } = await db.query(
      `INSERT INTO saved_searches (buyer_id, search_term, category, label) VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.sub, searchTerm || null, category || null, label.trim()]
    );
    res.status(201).json(toSavedSearchDto(rows[0]));
  } catch (err) {
    next(err);
  }
});

// Ownership enforced by the WHERE clause itself, not a lookup-then-
// check -- matching the same real "don't confirm it exists" pattern
// already used elsewhere in this project.
router.delete('/me/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM saved_searches WHERE id = $1 AND buyer_id = $2',
      [req.params.id, req.user.sub]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Saved search not found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
