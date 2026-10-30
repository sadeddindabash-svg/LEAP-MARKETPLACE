// Removes the data the integration tests left in this database: categories "CS test_cat_shipping_...", parts "Part 179...",
// the products in them, the bulk-import test drafts (OEM "BI-A-..."), and the test users (email "...-test-17...@example.com"),
// with every row that depends on them (their orders, cart lines, photos, ...), deepest first.
//
//   node clean-test-data.js            DRY RUN: shows exactly what would be deleted, changes nothing
//   node clean-test-data.js --write    deletes it, all in ONE transaction (if anything fails, nothing is deleted)
require('dotenv').config();
const db = require('./db/pool');
const WRITE = process.argv.includes('--write');

const ROOTS = [
  { table: 'product_categories', where: `name_en LIKE 'CS test\\_cat\\_shipping\\_%'`, show: 'name_en' },
  { table: 'category_parts', where: `name_en LIKE 'Part 179%'`, show: 'name_en' },
  { table: 'products', where: `category LIKE 'test\\_cat\\_shipping\\_%' OR part LIKE 'Part 179%' OR oem_number LIKE 'BI-_-%'`, show: 'id' },
  { table: 'users', where: `email LIKE '%test%17%@example.com'`, show: 'email' },
];

const q = (client, sql, p) => client.query(sql, p);
async function primaryKey(client, table) {
  const { rows } = await q(client, `SELECT a.attname AS col FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
    WHERE i.indrelid = $1::regclass AND i.indisprimary`, [table]);
  return rows.length === 1 ? rows[0].col : null;
}
async function referencing(client, table) {      // single-column foreign keys that point at `table`
  const { rows } = await q(client, `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, af.attname AS refcol, array_length(c.conkey, 1) AS n
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND c.confrelid = $1::regclass`, [table]);
  return rows;
}

(async () => {
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const plan = new Map();          // table -> { key, ids:Set }  (rows to delete)
    const order = [];                // tables, the order they were reached (parents first)
    const add = (table, key, ids) => {
      if (!plan.has(table)) { plan.set(table, { key, ids: new Set() }); order.push(table); }
      const e = plan.get(table); const fresh = ids.filter((x) => !e.ids.has(String(x)));
      fresh.forEach((x) => e.ids.add(String(x))); return fresh;
    };
    const problems = [];
    const edges = new Set();         // "child>parent": rows of child point at rows of parent, so child goes first
    async function walk(table, key, ids, depth) {
      if (depth > 12 || ids.length === 0) return;
      for (const fk of await referencing(client, table)) {
        if (fk.n !== 1) { problems.push(`${fk.tbl} points at ${table} with a key of several columns: not handled`); continue; }
        const refIds = fk.refcol === key ? ids : (await q(client, `SELECT "${fk.refcol}"::text AS v FROM ${table} WHERE "${key}"::text = ANY($1)`, [ids])).rows.map((r) => r.v);
        if (refIds.length === 0) continue;
        const pk = await primaryKey(client, fk.tbl);
        const childKey = pk || 'ctid';
        const { rows } = await q(client, `SELECT ${pk ? `"${pk}"::text` : 'ctid::text'} AS id FROM ${fk.tbl} WHERE "${fk.col}"::text = ANY($1)`, [refIds]);
        if (fk.tbl !== table) edges.add(`${fk.tbl}>${table}`);
        const fresh = add(fk.tbl, childKey, rows.map((r) => r.id));
        if (pk) await walk(fk.tbl, pk, fresh, depth + 1);
      }
    }
    console.log(WRITE ? 'DELETING the test data:\n' : 'DRY RUN (nothing is changed). This would be deleted:\n');
    for (const r of ROOTS) {
      const exists = (await q(client, `SELECT to_regclass($1) AS t`, [r.table])).rows[0].t;
      if (!exists) { console.log(`  (no table ${r.table}, skipped)`); continue; }
      const pk = await primaryKey(client, r.table);
      if (!pk) { problems.push(`${r.table} has no single-column primary key`); continue; }
      const { rows } = await q(client, `SELECT "${pk}"::text AS id, "${r.show}"::text AS label FROM ${r.table} WHERE ${r.where}`);
      console.log(`  ${r.table}: ${rows.length} test rows` + (rows.length ? `, e.g. ${rows.slice(0, 3).map((x) => x.label).join(' | ')}` : ''));
      const fresh = add(r.table, pk, rows.map((x) => x.id));
      await walk(r.table, pk, fresh, 0);
    }
    console.log('\nIn total, by table (rows that depend on the test rows included):');
    for (const t of order) console.log(`  ${t}: ${plan.get(t).ids.size}`);
    if (problems.length) { console.log('\nSTOPPED, nothing deleted:'); problems.forEach((p) => console.log('  ' + p)); await client.query('ROLLBACK'); process.exit(1); }
    if (!WRITE) { await client.query('ROLLBACK'); console.log('\nDry run only. Check the list, then run: node clean-test-data.js --write'); process.exit(0); }
    // children before parents: a table is deleted once no table still waiting points at it
    const waiting = new Set(order); const sorted = [];
    while (waiting.size) {
      const ready = [...waiting].filter((t) => ![...edges].some((e) => { const [c, par] = e.split('>'); return par === t && waiting.has(c); }));
      if (ready.length === 0) throw new Error('these tables point at each other, so there is no safe order: ' + [...waiting].join(', '));
      ready.forEach((t) => { waiting.delete(t); sorted.push(t); });
    }
    for (const t of sorted) {
      const { key, ids } = plan.get(t);
      if (ids.size === 0) continue;
      const res = await q(client, `DELETE FROM ${t} WHERE ${key === 'ctid' ? 'ctid::text' : `"${key}"::text`} = ANY($1)`, [[...ids]]);
      console.log(`  deleted ${res.rowCount} from ${t}`);
    }
    await client.query('COMMIT');
    console.log('\nDone. The test data is gone. Reload the portals with Ctrl+F5.');
    process.exit(0);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\nERROR, nothing was deleted:', e.message);
    process.exit(1);
  } finally { client.release(); }
})();
