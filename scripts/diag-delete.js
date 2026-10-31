/**
 * Finds why Admin > Products > Delete answers "Internal server error". Runs the same check the Delete window runs, on up to 24 hidden
 * products, against YOUR database, and prints the full error. Changes nothing.
 *
 *   node scripts\diag-delete.js
 */
const path = require('path');
const api = path.resolve(__dirname, '..', 'services', 'api');
process.chdir(api);      // the API reads its settings (.env) from its own folder
(async () => {
  let db;
  try {
    db = require(path.join(api, 'db', 'pool'));
    const { rows } = await db.query("SELECT id FROM products WHERE status = 'inactive' AND deleted_at IS NULL ORDER BY id LIMIT 24");
    console.log(`hidden products found: ${rows.length}`);
    const ids = rows.map((r) => r.id);
    const del = require(path.join(api, 'src', 'modules', 'catalog', 'productDelete'));
    const steps = [
      ['waiting orders', () => del.waitingOrders(db, ids)],
      ['full check (planDelete)', () => del.planDelete(db, ids)],
    ];
    for (const [name, run] of steps) {
      try {
        const out = await run();
        console.log(`OK    ${name}` + (out && out.deletable ? `: ${out.deletable.length} deletable, ${out.held.length} held` : ''));
      } catch (err) {
        console.log(`FAIL  ${name}`);
        console.log(`  message: ${err.message}`);
        if (err.detail) console.log(`  detail:  ${err.detail}`);
        if (err.hint) console.log(`  hint:    ${err.hint}`);
        if (err.where) console.log(`  where:   ${err.where}`);
        console.log((err.stack || '').split('\n').slice(0, 6).join('\n'));
      }
    }
  } catch (err) {
    console.log('Could not start the check:', err.message);
  } finally {
    try { if (db && db.getPool) await db.getPool().end(); else if (db && db.end) await db.end(); } catch (_) { /* closing only */ }
    process.exit(0);
  }
})();
