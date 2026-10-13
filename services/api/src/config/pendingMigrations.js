const fs = require('fs');
const path = require('path');

/**
 * Which database migrations are in the code but NOT yet applied to this database.
 *
 * WHY: the usual way this system breaks after an update is that new code is running against a database that has not had the new migration
 * run, and the failure shows up later as a confusing error somewhere else. This lets the backend say so, plainly, the moment it starts
 * (and in /health), instead.
 *
 * `db` and `dir` can be passed in (tests do); by default they are the real database and the real migrations folder.
 */
async function getPendingMigrations({ db = require('../../db/pool'), dir = path.join(__dirname, '../../db/migrations') } = {}) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  let applied;
  try {
    const { rows } = await db.query('SELECT filename FROM schema_migrations');
    applied = new Set(rows.map((r) => r.filename));
  } catch (err) {
    // Only a MISSING migrations table means "nothing has been applied yet". Any other failure (above all: the database cannot be reached) used to be
    // treated the same way, so a stopped database was reported as "101 migrations pending" and the advice was to run migrate.js. Let it surface instead.
    if (err && (err.code === '42P01' || /schema_migrations.*does not exist/i.test(err.message || ''))) return files;
    throw err;
  }
  return files.filter((f) => !applied.has(f));
}

function pendingMigrationsBanner(pending) {
  const line = '='.repeat(78);
  return [
    '', line,
    `  DATABASE NOT UP TO DATE: ${pending.length} migration${pending.length === 1 ? '' : 's'} not applied yet`,
    ...pending.map((f) => `    - ${f}`),
    '',
    '  The backend will run, but anything that needs the new tables / columns will FAIL.',
    '  Fix:  stop this backend, run   node db/migrate.js   in services\\api, then start it again.',
    line, '',
  ].join('\n');
}

/** A plain-words reason for a failure to talk to the database (null error -> null). */
function describeDatabaseError(err) {
  if (!err) return null;
  const code = err.code || (err.errors && err.errors[0] && err.errors[0].code);
  if (code === 'ECONNREFUSED') return 'the database is not running, or is not accepting connections on that address and port';
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'the database address in DATABASE_URL cannot be found';
  if (code === 'ETIMEDOUT' || /timeout/i.test(err.message || '')) return 'the database did not answer in time';
  if (code === '28P01' || code === '28000') return 'the database refused the user name or password in DATABASE_URL';
  if (code === '3D000') return 'the database named in DATABASE_URL does not exist';
  if (code === '57P03' || code === '57P01') return 'the database is starting up or shutting down';
  return err.message || String(err);
}

function databaseUnreachableBanner(err) {
  const line = '='.repeat(78);
  return ['', line, '  THE DATABASE CANNOT BE REACHED', `    Reason: ${describeDatabaseError(err)}`, '',
    '  The backend is running, but every page that needs data will fail, so portals and apps will sign in nowhere or load nothing.',
    '  Fix: start PostgreSQL (the Windows service "postgresql-x64-..."), check DATABASE_URL in services\\api\\.env, then restart this backend.', line, ''].join('\n');
}

module.exports = { getPendingMigrations, pendingMigrationsBanner, describeDatabaseError, databaseUnreachableBanner };
