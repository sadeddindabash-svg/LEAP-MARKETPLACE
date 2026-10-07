const express = require('express');
const { renderResetPage, NOT_VALID_PAGE } = require('./resetPage');

// GET /reset-password?token=...  (public; the button in the password reset email opens this)
const router = express.Router();
router.get('/', (req, res) => {
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); // the address holds a secret: never cache it or pass it on
  const html = renderResetPage(req.query.token);
  if (!html) return res.status(404).type('html').send(NOT_VALID_PAGE);
  res.type('html').send(html);
});

module.exports = router;
