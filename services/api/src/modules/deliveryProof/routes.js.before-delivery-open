const express = require('express');
const multer = require('multer');
const { describeLink, submitProof, recordAttempt, ProofError, MAX_PHOTOS, TOKEN_PATTERN } = require('./helpers');
const { optionalDriver } = require('./drivers');
const { renderProofPage } = require('./page');
const { createRateLimiter } = require('./rateLimit');

/**
 * Public routes for the courier link (migration 096). NO LOGIN: the long random token in the address is the only credential, which is why
 * the link only does anything once the parcel has been shipped, expires, caps the photos, and is rate-limited.
 *
 *   GET  /p/:token      the page the courier sees after scanning the QR
 *   GET  /proof/:token  { state, orderId?, photoCount?, maxPhotos?, signedIn, parcel? (signed-in driver only), driverError? }
 *   POST /proof/:token  multipart: photos (1-8 images), code, receivedBy, note?, latitude?, longitude?, accuracy?   (signed-in driver: migration 120)
 *   POST /proof/:token/attempt  multipart: reason, note?, photo?, latitude?, longitude?, accuracy?                (signed-in driver: "couldn't deliver")
 *
 * Since migration 120 a delivery can only be confirmed by a signed-in partner driver (Authorization: Bearer <driver token> from
 * /proof-driver/login) who types the buyer's 4-digit code.
 */
const apiRouter = express.Router();
const pageRouter = express.Router();

// Per link: at most 20 upload attempts / 10 minutes. Per address: at most 300 requests / 10 minutes that hit a link that does not exist (guessing).
const perLinkUploads = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 });
const perIpGuesses = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 300 });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: MAX_PHOTOS },
  fileFilter: (req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return cb(new ProofError(`Unsupported file type: ${file.mimetype}. Please send ordinary photos (JPEG, PNG or WebP).`));
    cb(null, true);
  },
});

function tooManyGuesses(req, res) {
  const verdict = perIpGuesses.hit(`ip:${req.ip}`);
  if (verdict.allowed) return false;
  res.set('Retry-After', String(verdict.retryAfterSeconds)).status(429).json({ error: 'Too many attempts. Please wait a few minutes.' });
  return true;
}

function proofErrorBody(err) {
  const out = { error: err.message };
  if (err.code) out.code = err.code;
  if (err.triesLeft !== undefined) out.triesLeft = err.triesLeft;
  return out;
}
const driverRefusal = (req, res) => res.status(401).json(req.driverError === 'disabled'
  ? { error: 'This driver account is turned off. Contact Leap.', code: 'account_disabled' }
  : { error: 'Please sign in as a delivery driver first.', code: 'driver_login_required' });

apiRouter.get('/:token', optionalDriver, async (req, res, next) => {
  try {
    const info = await describeLink(req.params.token, req.driver || null);
    if (info.state === 'unknown' && tooManyGuesses(req, res)) return;
    if (req.driverError) info.driverError = req.driverError;
    res.set('Cache-Control', 'no-store').json(info);
  } catch (err) { next(err); }
});

apiRouter.post('/:token', optionalDriver, async (req, res, next) => {
  try {
    if (!TOKEN_PATTERN.test(req.params.token)) { if (tooManyGuesses(req, res)) return; return res.status(404).json({ error: 'This link was not found.' }); }
    const verdict = perLinkUploads.hit(`token:${req.params.token}`); // counted before the sign-in check, so the link cannot be hammered either way
    if (!verdict.allowed) return res.set('Retry-After', String(verdict.retryAfterSeconds)).status(429).json({ error: 'Too many attempts for this parcel. Please wait a few minutes.' });
    if (!req.driver) return driverRefusal(req, res);

    upload.array('photos', MAX_PHOTOS)(req, res, async (err) => {
      try {
        if (err) {
          const status = err instanceof ProofError ? err.status : err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
          const message = err.code === 'LIMIT_FILE_SIZE' ? 'A photo is too large (10 MB at most).' : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT' ? `At most ${MAX_PHOTOS} photos can be sent at once.` : err.message;
          return res.status(status).json({ error: message });
        }
        const b = req.body || {};
        const result = await submitProof({
          token: req.params.token, files: req.files || [], driver: req.driver, code: b.code, receivedBy: b.receivedBy, note: b.note,
          latitude: b.latitude, longitude: b.longitude, accuracy: b.accuracy, ip: req.ip, userAgent: req.get('user-agent'),
        });
        res.json({ delivered: result.delivered, photoCount: result.photoCount });
      } catch (inner) {
        if (inner instanceof ProofError) {
          if (inner.status === 404 && tooManyGuesses(req, res)) return;
          return res.status(inner.status).json(proofErrorBody(inner));
        }
        next(inner);
      }
    });
  } catch (err) { next(err); }
});

// "Couldn't deliver": the reason, an optional note and photo, and the phone's location when it allows.
apiRouter.post('/:token/attempt', optionalDriver, async (req, res, next) => {
  try {
    if (!TOKEN_PATTERN.test(req.params.token)) { if (tooManyGuesses(req, res)) return; return res.status(404).json({ error: 'This link was not found.' }); }
    const verdict = perLinkUploads.hit(`token:${req.params.token}`); // counted before the sign-in check, so the link cannot be hammered either way
    if (!verdict.allowed) return res.set('Retry-After', String(verdict.retryAfterSeconds)).status(429).json({ error: 'Too many attempts for this parcel. Please wait a few minutes.' });
    if (!req.driver) return driverRefusal(req, res);
    upload.single('photo')(req, res, async (err) => {
      try {
        if (err) return res.status(err instanceof ProofError ? err.status : err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'A photo is too large (10 MB at most).' : err.message });
        const b = req.body || {};
        const result = await recordAttempt({ token: req.params.token, driver: req.driver, reason: b.reason, note: b.note, file: req.file || null, latitude: b.latitude, longitude: b.longitude, accuracy: b.accuracy });
        res.status(201).json(result);
      } catch (inner) {
        if (inner instanceof ProofError) return res.status(inner.status).json(proofErrorBody(inner));
        next(inner);
      }
    });
  } catch (err) { next(err); }
});

pageRouter.get('/:token', (req, res) => {
  const html = renderProofPage(req.params.token);
  if (!html) return res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><body style="font-family:system-ui;padding:24px"><h2>Link not found · الرابط غير موجود</h2></body>');
  res.set('Cache-Control', 'no-store').type('html').send(html);
});

module.exports = { apiRouter, pageRouter };
