// Mounted by catalog/routes.js at  /catalog/admin
//   GET  /import/template                 the blank template
//   POST /import/preview                  multipart: the .xlsx in the field "file", and "mode": "skip" (default) or "update". Writes nothing.
//   POST /import/commit                   the same, for real: sends the file again (every check is made again, never trusted from the preview) and does everything in ONE transaction.
//   GET  /import/batches                  the imports so far;   POST /import/batches/:id/undo   removes what that import created and nothing uses
//   GET  /health                          how complete the catalog is and what still rests on estimated sizes
//   PATCH /categories/:id   PATCH /parts/:id   edit every field (details.js);   POST /parts/review   mark estimated sizes as reviewed
// Admin only, and only for admins who may open Categories.
const express = require('express');
const multer = require('multer');
const db = require('../../../db/pool');
const { requireAuth, requireRole, requirePageAccess } = require('../auth/middleware');
const { logAdminAction } = require('../audit/helpers');
const { MAX_UPLOAD_BYTES } = require('./columns');
const { parseWorkbook, ImportError } = require('./parser');
const { validateRows } = require('./rules');
const { runImport, newBatchId } = require('./plan');
const { buildTemplate } = require('./template');
const { ensurePlaceholders } = require('./placeholders');
const details = require('./details');
const { runCleanup } = require('./cleanup');
const { planRemoval, applyRemoval, REPLACE_PHRASE } = require('./replace');
const { removeIfUnused } = require('../uploads/unusedPictures');

const router = express.Router();
const guard = [requireAuth, requireRole('admin'), requirePageAccess('categories')];

// Categories > Photos: coverage, the shot list, the bulk photo import with Undo, and the optional fallback switch (see ../catalogPhotos).
router.use('/photos', require('../catalogPhotos/routes'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

router.get('/import/template', ...guard, async (req, res, next) => {
  try {
    const buffer = await buildTemplate();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="Leap_Parts_Catalog_Import_Template.xlsx"', 'Content-Length': String(buffer.length) });
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
/** The form fields of "make the catalog exactly the sheet" (1 or true): removeOthers = remove everything the sheet does not mention; alsoProducts = also delete the products that use it (never one that was ordered). */
const flag = (req, name) => ['1', 'true'].includes(String((req.body || {})[name]));

function describe(file, mode, parsed, run, removal = null) {
  const rows = run.rows;
  const errors = rows.filter((r) => r.status === 'error').length;
  const withWarning = rows.filter((r) => r.messages.some((m) => m.level === 'warning')).length;
  const toImport = run.counts.newParts + run.counts.updatedParts + run.counts.newCategories + run.counts.updatedCategories;
  const removing = removal ? removal.counts.categories + removal.counts.parts + removal.counts.products : 0;      // what "make the catalog exactly the sheet" would remove
  const blocking = errors > 0;
  return {
    fileName: file.originalname, mode, sheet: parsed.sheetName,
    summary: { rows: rows.length, rowsWithErrors: errors, rowsWithWarnings: withWarning, ...run.counts },
    rows, notes: run.notes, nearDuplicates: run.nearDuplicates, issues: parsed.issues,
    removal, blocking, ready: !blocking && (toImport > 0 || removing > 0), nothingToImport: !blocking && toImport === 0 && removing === 0,
  };
}

async function loadAndCheck(req, res) {
  const file = await takeFile(req, res);
  const mode = modeOf(req);                         // the form fields (including "mode") are available only once the upload has been unpacked
  const parsed = await parseWorkbook(file.buffer);
  return { file, mode, removeOthers: flag(req, 'removeOthers'), alsoProducts: flag(req, 'alsoProducts'), parsed, items: validateRows(parsed.rows) };
}

router.post('/import/preview', ...guard, async (req, res, next) => {
  try {
    const { file, mode, removeOthers, alsoProducts, parsed, items } = await loadAndCheck(req, res);
    const run = await runImport(db, items, mode, { apply: false });
    const removal = removeOthers && run.keep.categoryIds.size > 0 ? await planRemoval(db, run.keep, { alsoProducts }) : null;      // only READS: the check removes nothing
    res.json(describe(file, mode, parsed, run, removal));
  } catch (err) {
    if (err instanceof ImportError) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/import/commit', ...guard, async (req, res, next) => {
  let client;
  try {
    const { file, mode, removeOthers, alsoProducts, parsed, items } = await loadAndCheck(req, res);
    if (removeOthers && String((req.body || {}).confirm || '').trim() !== REPLACE_PHRASE) return res.status(400).json({ error: `To remove everything that is not in the sheet, type ${REPLACE_PHRASE} to confirm. Nothing was changed.` });
    const placeholders = ensurePlaceholders();
    const batchId = newBatchId();
    client = await db.getPool().connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['catalog_import']);          // two imports never run at the same moment
    const run = await runImport(client, items, mode, { apply: true, batchId, placeholders });
    let removal = null; let applied = { imageUrls: [] };
    if (removeOthers) {
      if (run.keep.categoryIds.size === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'The sheet has no category to keep, so nothing was imported or removed.' }); }
      removal = await planRemoval(client, run.keep, { alsoProducts });      // the same function as the check, run inside this transaction
      applied = await applyRemoval(client, removal);
    }
    const answer = describe(file, mode, parsed, run, removal);
    if (answer.blocking || answer.nothingToImport) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: answer.blocking ? 'The file has problems, so nothing was imported. Fix them and check the file again.' : 'There is nothing to import: every row already exists.', ...answer });
    }
    const by = req.user ? String(req.user.email || req.user.id || '') : '';
    await client.query('INSERT INTO catalog_import_batches (id, created_by, file_name, mode, categories_added, parts_added, parts_updated) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [batchId, by, file.originalname, mode, run.counts.newCategories, run.counts.newParts, run.counts.updatedParts]);
    await client.query('COMMIT');
    await logAdminAction(req, 'catalog_import', 'catalog_import', batchId, { fileName: file.originalname, mode, ...run.counts, ...(removal ? { replaced: true, removedCategories: removal.counts.categories, removedParts: removal.counts.parts, removedProducts: removal.counts.products } : {}) });
    // the pictures of what was removed: deleted too, when nothing else uses them (a problem here never undoes the import)
    let picturesRemoved = 0;
    if (removal) { try { picturesRemoved = await removeIfUnused(db, [...removal.photoUrls, ...applied.imageUrls]); } catch (err) { console.error('Removing the pictures of the removed catalog failed:', err.message); } }
    res.status(201).json({ imported: true, batchId, picturesRemoved, ...answer });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (err instanceof ImportError) return res.status(err.status).json({ error: err.message });
    next(err);
  } finally {
    if (client) client.release();
  }
});

router.get('/import/batches', ...guard, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM catalog_import_batches ORDER BY created_at DESC LIMIT 50');
    res.json(rows.map((r) => ({ id: r.id, createdAt: r.created_at, createdBy: r.created_by, fileName: r.file_name, mode: r.mode, categoriesAdded: r.categories_added, partsAdded: r.parts_added, partsUpdated: r.parts_updated, undoneAt: r.undone_at })));
  } catch (err) { next(err); }
});

// Undo: removes the parts and categories that import CREATED, but only those nothing uses (no product points at them). Whatever a product uses stays, and the answer says so.
router.post('/import/batches/:id/undo', ...guard, async (req, res, next) => {
  let client;
  try {
    client = await db.getPool().connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['catalog_import']);
    const { rows: [batch] } = await client.query('SELECT * FROM catalog_import_batches WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!batch) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Import not found' }); }
    if (batch.undone_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'This import was already undone' }); }
    const delParts = await client.query(`DELETE FROM category_parts p WHERE p.import_batch_id = $1 AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.category = p.category_id AND lower(btrim(pr.part)) = lower(btrim(p.name_en))) RETURNING id`, [batch.id]);
    const delCats = await client.query(`DELETE FROM product_categories c WHERE c.import_batch_id = $1 AND NOT EXISTS (SELECT 1 FROM category_parts WHERE category_id = c.id) AND NOT EXISTS (SELECT 1 FROM products WHERE category = c.id) RETURNING id`, [batch.id]);
    const left = await client.query('SELECT (SELECT count(*) FROM category_parts WHERE import_batch_id = $1)::int AS parts, (SELECT count(*) FROM product_categories WHERE import_batch_id = $1)::int AS cats', [batch.id]);
    await client.query('UPDATE catalog_import_batches SET undone_at = now() WHERE id = $1', [batch.id]);
    await client.query('COMMIT');
    await logAdminAction(req, 'catalog_import_undone', 'catalog_import', batch.id, { partsRemoved: delParts.rowCount, categoriesRemoved: delCats.rowCount, partsKept: left.rows[0].parts, categoriesKept: left.rows[0].cats });
    res.json({ undone: true, partsRemoved: delParts.rowCount, categoriesRemoved: delCats.rowCount, partsKeptBecauseInUse: left.rows[0].parts, categoriesKeptBecauseInUse: left.rows[0].cats,
      olderPartsFilledAndKept: batch.parts_updated, note: 'Blanks that the import filled on rows that already existed (a code, a Chinese name) are kept: only the rows the import created are removed.' });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally {
    if (client) client.release();
  }
});

// the lists the editing screen works from: every field of every category and part (the older lists carry only the names and the photo)
router.get('/categories', ...guard, async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT c.*, (SELECT count(*) FROM category_parts p WHERE p.category_id = c.id)::int AS part_count FROM product_categories c ORDER BY c.sort_order, c.name_en`);
    res.json(rows.map((r) => ({ ...details.categoryDto(r), partCount: r.part_count })));
  } catch (err) { next(err); }
});
router.get('/categories/:id/parts', ...guard, async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM category_parts WHERE category_id = $1 ORDER BY sort_order, name_en', [req.params.id]);
    res.json(rows.map(details.partDto));
  } catch (err) { next(err); }
});

// Start clean: remove the old catalog (see cleanup.js). The preview runs the removal and ROLLS IT BACK; the commit needs the exact confirmation text and runs under the same lock as an import.
router.get('/cleanup/preview', ...guard, async (req, res, next) => {
  let client;
  try {
    client = await db.getPool().connect();
    await client.query('BEGIN');
    const out = await runCleanup(client, { alsoProducts: req.query.alsoProducts === '1' || req.query.alsoProducts === 'true' });
    await client.query('ROLLBACK');
    res.json(out);
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    next(err);
  } finally { if (client) client.release(); }
});
const CLEANUP_CONFIRMATION = 'REMOVE OLD';
router.post('/cleanup/commit', ...guard, async (req, res, next) => {
  let client;
  try {
    const body = req.body || {};
    if (String(body.confirm || '').trim() !== CLEANUP_CONFIRMATION) return res.status(400).json({ error: `Type ${CLEANUP_CONFIRMATION} to confirm. Nothing was removed.` });
    client = await db.getPool().connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['catalog_import']);
    const out = await runCleanup(client, { alsoProducts: body.alsoProducts === true });
    await client.query('COMMIT');
    await logAdminAction(req, 'catalog_cleanup', 'catalog_cleanup', null, { ...out.counts, alsoProducts: body.alsoProducts === true, removedCategories: out.removed.categories.map((c) => c.name) });
    res.json({ removedNow: true, ...out });
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (err && err.code === '23503') return res.status(409).json({ error: 'Something else still uses part of the old catalog, so nothing was removed.' });
    next(err);
  } finally { if (client) client.release(); }
});

router.get('/health', ...guard, async (req, res, next) => { try { res.json(await details.health(db)); } catch (err) { next(err); } });

async function inTransaction(fn) {
  const client = await db.getPool().connect();
  try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; }
  catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; }
  finally { client.release(); }
}
const editError = (res, err, next) => (err instanceof details.EditError ? res.status(err.status).json({ error: err.message }) : next(err));

router.patch('/categories/:id', ...guard, async (req, res, next) => {
  try {
    const out = await inTransaction((c) => details.updateCategory(c, req.params.id, req.body || {}));
    await logAdminAction(req, 'category_updated', 'category', req.params.id, out.changes);
    res.json(out.dto);
  } catch (err) { editError(res, err, next); }
});
router.patch('/parts/:id', ...guard, async (req, res, next) => {
  try {
    const out = await inTransaction((c) => details.updatePart(c, req.params.id, req.body || {}));
    await logAdminAction(req, 'part_updated', 'part', req.params.id, { ...out.changes, productsRenamed: out.productsRenamed });
    res.json({ ...out.dto, productsRenamed: out.productsRenamed, productsAffectedBySize: out.productsAffectedBySize });
  } catch (err) { editError(res, err, next); }
});
router.post('/parts/review', ...guard, async (req, res, next) => {
  try {
    const out = await inTransaction((c) => details.markReviewed(c, (req.body || {}).ids));
    await logAdminAction(req, 'part_sizes_reviewed', 'part', null, out);
    res.json(out);
  } catch (err) { editError(res, err, next); }
});

module.exports = router;
