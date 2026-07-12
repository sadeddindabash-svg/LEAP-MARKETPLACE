#!/usr/bin/env node
/**
 * Minimal migration runner — no framework dependency, just tracks which
 * .sql files in db/migrations/ have been applied, in filename order, in a
 * schema_migrations table. Deliberately simple for the project's current
 * stage; swap for a proper tool (node-pg-migrate, Knex, Prisma Migrate)
 * once the schema is evolving fast enough to need rollback support.
 *
 * Usage: node db/migrate.js
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename    TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  const { rows: applied } = await pool.query('SELECT filename FROM schema_migrations');
  const appliedSet = new Set(applied.map((r) => r.filename));

  let ranAny = false;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`skip  ${file} (already applied)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`apply ${file} ...`);
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`  ✓ applied`);
      ranAny = true;
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`  ✗ failed: ${err.message}`);
      await pool.end();
      process.exit(1);
    }
  }

  if (!ranAny) console.log('Nothing to apply — schema is up to date.');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
