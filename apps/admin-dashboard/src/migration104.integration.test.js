// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';

// Migration 104 moves the weight and package size from CATEGORIES (migration 103) to PARTS. This runs it for real on a SCRATCH database that is built the way the
// migration runner builds one (every file in order, each in a transaction), stopped right after 103, filled with the situation of someone who already set values on
// categories, and then given 104. Nothing is lost: every part under a category that had values receives them, and only then do the categories lose the columns.
// If the database user is not allowed to create databases, the test skips itself.
const BASE_URL = process.env.DATABASE_URL || 'postgresql://leap_dev:leap_dev_password@localhost:5432/leap_marketplace_dev';
const migrationsDir = path.resolve(import.meta.dirname, '../../../services/api/db/migrations');
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const scratchName = `leap_mig104_${Date.now()}`;
const urlFor = (database) => { const u = new URL(BASE_URL); u.pathname = `/${database}`; return u.toString(); };

let adminPool = null;
let scratchCreated = false;
try {
  adminPool = new Pool({ connectionString: BASE_URL });
  await adminPool.query(`CREATE DATABASE ${scratchName}`);
  scratchCreated = true;
} catch {
  scratchCreated = false;
}
let scratch = null;
afterAll(async () => {
  if (scratch) await scratch.end();
  if (adminPool && scratchCreated) await adminPool.query(`DROP DATABASE IF EXISTS ${scratchName}`).catch(() => {});
  if (adminPool) await adminPool.end();
});

async function applyFile(pool, file) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  await pool.query('BEGIN');
  try { await pool.query(sql); await pool.query('COMMIT'); } catch (err) { await pool.query('ROLLBACK'); throw new Error(`${file}: ${err.message}`); }
}

describe.runIf(scratchCreated)('migration 104 on a database that already has category values (scratch database)', () => {
  it('CRITICAL: parts under a category that had values receive them; categories without values give none; then the categories lose the columns; nothing else changes', async () => {
    scratch = new Pool({ connectionString: urlFor(scratchName), max: 1 });
    const before = files.filter((f) => f < '104');
    expect(before[before.length - 1]).toMatch(/^103_/);
    for (const file of before) await applyFile(scratch, file);                       // the database exactly as it is after migration 103

    await scratch.query(`INSERT INTO product_categories (id, name_en, sort_order, weight_kg, length_cm, width_cm, height_cm) VALUES ('with_values', 'With values', 1, 5, 30, 30, 5)`);
    await scratch.query(`INSERT INTO product_categories (id, name_en, sort_order) VALUES ('no_values', 'No values', 2)`);
    await scratch.query(`INSERT INTO product_categories (id, name_en, sort_order, weight_kg, length_cm, width_cm, height_cm) VALUES ('empty_cat', 'Has values, no parts', 3, 9, 9, 9, 9)`);
    for (const [id, category, name] of [['p_a1', 'with_values', 'Part A1'], ['p_a2', 'with_values', 'Part A2'], ['p_b1', 'no_values', 'Part B1']]) {
      await scratch.query(`INSERT INTO category_parts (id, category_id, name_en, sort_order) VALUES ($1, $2, $3, 1)`, [id, category, name]);
    }
    expect((await scratch.query(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'category_parts' AND column_name = 'weight_kg'`)).rows[0].n).toBe(0);   // parts have none before 104

    await applyFile(scratch, files.find((f) => f.startsWith('104_')));

    const parts = (await scratch.query(`SELECT id, weight_kg, length_cm, width_cm, height_cm FROM category_parts ORDER BY id`)).rows.map((r) => ({ id: r.id, w: r.weight_kg === null ? null : Number(r.weight_kg), l: r.length_cm === null ? null : Number(r.length_cm) }));
    expect(parts).toEqual([{ id: 'p_a1', w: 5, l: 30 }, { id: 'p_a2', w: 5, l: 30 }, { id: 'p_b1', w: null, l: null }]);
    const { rows: leftover } = await scratch.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'product_categories' AND column_name IN ('weight_kg', 'length_cm', 'width_cm', 'height_cm')`);
    expect(leftover).toEqual([]);                                                    // the categories no longer carry them
    expect((await scratch.query(`SELECT count(*)::int AS n FROM product_categories`)).rows[0].n).toBe(3);   // no category was lost
    expect((await scratch.query(`SELECT count(*)::int AS n FROM category_parts`)).rows[0].n).toBe(3);
  }, 180000);

  it('the safety net on parts works on that same database: a partial or non-positive set is refused, all four or none is fine', async () => {
    await expect(scratch.query(`UPDATE category_parts SET weight_kg = 5 WHERE id = 'p_b1'`)).rejects.toThrow(/category_parts_shipping_all_or_none/);
    await expect(scratch.query(`UPDATE category_parts SET weight_kg = 0, length_cm = 1, width_cm = 1, height_cm = 1 WHERE id = 'p_b1'`)).rejects.toThrow(/category_parts_shipping_all_or_none/);
    await scratch.query(`UPDATE category_parts SET weight_kg = 2, length_cm = 3, width_cm = 4, height_cm = 5 WHERE id = 'p_b1'`);
    await scratch.query(`UPDATE category_parts SET weight_kg = NULL, length_cm = NULL, width_cm = NULL, height_cm = NULL WHERE id = 'p_b1'`);
  });
});
