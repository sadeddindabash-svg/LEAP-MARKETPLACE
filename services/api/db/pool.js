const { Pool } = require('pg');
const { env } = require('../src/config/env');

/**
 * Single shared connection pool for the whole API. Import this rather than
 * creating new pg.Pool instances elsewhere — connection pools are meant to
 * be shared, not per-request.
 */
let pool = null;

function getPool() {
  if (pool) return pool;
  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in — see db/README.md for local setup.');
  }
  pool = new Pool({ connectionString: env.databaseUrl });
  return pool;
}

async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

module.exports = { getPool, query };
