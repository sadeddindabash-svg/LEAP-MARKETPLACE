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
  } catch {
    return files; // no migrations table at all: nothing has been applied
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

module.exports = { getPendingMigrations, pendingMigrationsBanner };
