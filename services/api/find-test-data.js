// READ ONLY: lists the rows that look like data left by the integration tests. It changes nothing.
//   cd D:\LEAP-MARKETPLACE\services\api
//   node find-test-data.js
require('dotenv').config();
const db = require('./db/pool');
const PATTERNS = ['%test_cat_shipping_%', 'Part 179%', 'BI-_-%', '%test_%_17%'];
(async () => {
  const { rows: cols } = await db.query(`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')
      AND column_name IN ('name','name_en','name_zh','name_ar','oem_number','part','category','email','title','sku')
    ORDER BY table_name, column_name`);
  let found = 0;
  for (const { table_name: t, column_name: c } of cols) {
    const where = PATTERNS.map((_, i) => `"${c}" LIKE $${i + 1}`).join(' OR ');
    const { rows } = await db.query(`SELECT COUNT(*)::int AS n, MIN("${c}") AS example FROM "${t}" WHERE ${where}`, PATTERNS);
    if (rows[0].n > 0) { found++; console.log(`${t}.${c}: ${rows[0].n} rows   e.g. ${rows[0].example}`); }
  }
  console.log(found ? '\ndone (nothing was changed)' : 'No test data found (nothing was changed).');
  process.exit(0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
