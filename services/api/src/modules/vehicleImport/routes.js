// POST /fitment/import/preview  and  POST /fitment/import/commit  (multipart: the .xlsx in the field "file", and "mode": "skip" (default) or "update"),
// GET  /fitment/import/template.
// Admin only, and only for admins who may open Vehicle Data. The preview writes nothing. The commit sends the file again (so nothing is kept between the two calls and
// every check is made again, never trusted from the preview), then does everything in ONE transaction: all of it, or none of it.
const express = require('express');
const multer = require('multer');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { saveImage, removeLocalImage } = require('../uploads/imageRules');
const { MAX_UPLOAD_BYTES } = require('./columns');
const { parseWorkbook, ImportError } = require('./parser');
const { validateRows } = require('./rules');
const { runImport } = require('./plan');
const { buildTemplate } = require('./template');

const router = express.Router();
const guard = [requireAuth, requireRole('admin'), requirePageAccess('vehicleData')];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

router.get('/template', ...guard, async (req, res, next) => {
  try {
    const buffer = await buildTemplate();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Leap_Vehicle_Import_Template.xlsx"', 'Content-Length': String(buffer.length) });
    res.send(buffer);
  } catch (err) { next(err); }
});

const takeFile = (req, res) => new Promise((resolve, reject) => {
  upload.single('file')(req, res, (err) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') return reject(new ImportError(`The file is larger than ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB. Split it into smaller files.`, 413));
    if (err) return reject(new ImportError(err.message));
    if (!req.file) return reject(new ImportError('No file was sent (expected the Excel file in the field "file").'));
    resolve(req.file);
  });
});

const modeOf = (req) => ((req.body || {}).mode === 'update' ? 'update' : 'skip');

/** The answer sent for both calls: a summary, every row with its result and messages, and what blocks the import. */
function describe(file, mode, parsed, run) {
  const rows = run.rows;
  const errors = rows.filter((r) => r.status === 'error').length;
  const withWarning = rows.filter((r) => r.messages.some((m) => m.level === 'warning')).length;
  const fileErrors = parsed.issues.filter((i) => i.level === 'error');
  const toImport = run.counts.newVersions + run.counts.updatedVersions;
  const blocking = errors > 0 || fileErrors.length > 0;
  return {
    fileName: file.originalname, mode, sheet: parsed.sheetName,
    summary: {
      rows: rows.length, rowsWithErrors: errors, rowsWithWarnings: withWarning, picturesFound: rows.filter((r) => r.picture).length,
      missingBrands: run.missingBrands, ...run.counts,
    },
    rows, notes: run.notes, issues: parsed.issues,
    blocking, ready: !blocking && toImport > 0, nothingToImport: !blocking && toImport === 0,
  };
}

async function loadAndCheck(req, res) {
  const file = await takeFile(req, res);
  const mode = modeOf(req);                         // only now: the form fields (including "mode") are available once the upload has been unpacked
  const parsed = await parseWorkbook(file.buffer);
  return { file, mode, parsed, items: validateRows(parsed.rows) };
}

router.post('/preview', ...guard, async (req, res, next) => {
  try {
    const { file, mode, parsed, items } = await loadAndCheck(req, res);
    const run = await runImport(db, items, mode, { apply: false });
    res.json(describe(file, mode, parsed, run));
  } catch (err) {
    if (err instanceof ImportError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/commit', ...guard, async (req, res, next) => {
  const savedUrls = [];
  let client;
  try {
    const { file, mode, parsed, items } = await loadAndCheck(req, res);
    client = await db.getPool().connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['vehicle_import']);      // two imports never run at the same moment
    const run = await runImport(client, items, mode, { apply: true, saveImage, savedUrls });
    const answer = describe(file, mode, parsed, run);
    if (answer.blocking || answer.nothingToImport) {
      await client.query('ROLLBACK');
      savedUrls.forEach(removeLocalImage);
      return res.status(400).json({ error: answer.blocking ? 'The file has problems, so nothing was imported. Fix them and check the file again.' : 'There is nothing to import: every row already exists.', ...answer });
    }
    await client.query('COMMIT');
    await logAdminAction(req, 'vehicle_import', 'vehicle_import', file.originalname, { mode, rows: answer.summary.rows, ...run.counts });
    res.status(201).json({ imported: true, ...answer });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    savedUrls.forEach(removeLocalImage);
    if (err instanceof ImportError) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    if (client) client.release();
  }
});

module.exports = router;
