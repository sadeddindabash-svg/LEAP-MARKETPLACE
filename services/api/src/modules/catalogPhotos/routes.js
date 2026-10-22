// Admin: Categories > Photos. Mounted inside the catalog admin routes (/catalog/admin/photos), with the same guard as the rest of the catalog tool.
const express = require('express');
const multer = require('multer');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const db = require('../../../db/pool');
const { MAX_FILE_SIZE_BYTES } = require('../uploads/imageRules');
const { loadCoverage } = require('./coverage');
const { buildWorkbook } = require('./shotList');
const { importFiles, listBatches, undoBatch, MAX_PER_REQUEST } = require('./importer');
const fallback = require('./fallback');

const router = express.Router();
const guard = [requireAuth, requireRole('admin'), requirePageAccess('categories')];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_PER_REQUEST } });

router.get('/coverage', ...guard, async (req, res, next) => { try { res.json({ ...(await loadCoverage(db)), fallback: await fallback.isOn() }); } catch (err) { next(err); } });

router.get('/shot-list.xlsx', ...guard, async (req, res, next) => {
  try {
    const wb = await buildWorkbook(db, { missingOnly: req.query.missingOnly === '1' });
    const buffer = await wb.xlsx.writeBuffer();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="Leap_Catalog_Shot_List${req.query.missingOnly === '1' ? '_missing' : ''}.xlsx"` });
    res.send(Buffer.from(buffer));
  } catch (err) { next(err); }
});

// POST /photos/import  (multipart: images[] named by code, batchId, replace)  ->  { results: [...] }
router.post('/import', ...guard, (req, res, next) => {
  upload.array('images', MAX_PER_REQUEST)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT' ? `At most ${MAX_PER_REQUEST} pictures at a time` : err.code === 'LIMIT_FILE_SIZE' ? 'A picture is larger than 10 MB' : err.message });
    try {
      const batchId = String(req.body.batchId || '');
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(batchId)) return res.status(400).json({ error: 'batchId is required (8 to 64 letters, numbers, - or _)' });
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No pictures provided (expected field name "images")' });
      const results = await importFiles(req.files, { batchId, replace: req.body.replace === '1' || req.body.replace === 'true', by: req.user?.email || req.user?.id || null });
      const saved = results.filter((r) => r.status === 'saved').length;
      if (saved > 0) await logAdminAction(req, 'catalog_photos_imported', 'catalog', batchId, { saved });
      res.json({ results });
    } catch (e) { next(e); }
  });
});

router.get('/batches', ...guard, async (req, res, next) => { try { res.json({ batches: await listBatches() }); } catch (err) { next(err); } });
router.post('/batches/:id/undo', ...guard, async (req, res, next) => {
  try {
    const out = await undoBatch(req.params.id);
    if (out.status === 'unknown') return res.status(404).json({ error: 'That import is not in the list (only the last 5 can be undone)' });
    if (out.status === 'already_undone') return res.status(409).json({ error: 'That import was already undone' });
    await logAdminAction(req, 'catalog_photos_undone', 'catalog', req.params.id, { restored: out.restored });
    res.json(out);
  } catch (err) { next(err); }
});

router.get('/settings', ...guard, async (req, res, next) => { try { res.json({ fallback: await fallback.isOn() }); } catch (err) { next(err); } });
router.put('/settings', ...guard, async (req, res, next) => {
  try {
    if (!req.body || typeof req.body.fallback !== 'boolean') return res.status(400).json({ error: 'Expected { fallback: true | false }' });
    const on = await fallback.setOn(req.body.fallback);
    await logAdminAction(req, 'catalog_photo_fallback_changed', 'catalog', 'catalog_photo_fallback', { on });
    res.json({ fallback: on });
  } catch (err) { next(err); }
});
module.exports = router;
