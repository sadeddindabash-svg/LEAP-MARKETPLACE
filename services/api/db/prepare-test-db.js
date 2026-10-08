#!/usr/bin/env node
/**
 * Gets the TEST database ready for a test run: creates it if it does not exist yet (when this database user is allowed to), wipes it, applies every
 * migration and loads the seed data. Used by scripts/run-tests.ps1; safe to run by hand.
 *
 *   node db/prepare-test-db.js            prepare it
 *   node db/prepare-test-db.js --url      print the test database's connection address (used by the runner)
 *
 * It can only ever wipe a database whose name ends in "_test" (see db/testDatabase.js).
 */
require('dotenv').config();
const path = require('path');
const { spawnSync } = require('child_process');
const { Client } = require('pg');
const { deriveTestDatabase, assertSafeToWipe } = require('./testDatabase');

function oneTimeInstructions(testName, urlText) {
  const u = new URL(urlText);
  return [
    '',
    `The test database "${testName}" does not exist yet, and this database user is not allowed to create databases.`,
    'ONE-TIME STEP: open PowerShell and run the line below (it asks for the PostgreSQL administrator password you chose when you installed PostgreSQL):',
    '',
    `  & "C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe" -h ${u.hostname} -p ${u.port || 5432} -U postgres -c "CREATE DATABASE ${testName} OWNER ${decodeURIComponent(u.username)}"`,
    '',
    'Then run the test runner again.',
    '',
  ].join('\n');
}

async function ensureExists(test) {
  const probe = new Client({ connectionString: test.url });
  try {
    await probe.connect();
    await probe.end();
    return;
  } catch (err) {
    await probe.end().catch(() => {});
    if (err.code !== '3D000') throw err; // anything but "database does not exist" is a real problem
  }
  const maintenanceUrl = new URL(test.url);
  maintenanceUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: maintenanceUrl.toString() });
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${test.name}" OWNER "${decodeURIComponent(new URL(test.url).username)}"`);
    console.log(`Created the test database "${test.name}".`);
  } catch (err) {
    if (err.code === '42501' || /permission denied/i.test(err.message)) {
      console.error(oneTimeInstructions(test.name, test.url));
      process.exit(3);
    }
    throw err;
  } finally {
    await admin.end().catch(() => {});
  }
}

async function wipe(test) {
  assertSafeToWipe(test.name);
  const client = new Client({ connectionString: test.url });
  await client.connect();
  try {
    await client.query('DROP OWNED BY CURRENT_USER CASCADE'); // every table, index, view... this user owns IN THIS database
  } finally {
    await client.end();
  }
}

function runNode(script, test) {
  const result = spawnSync(process.execPath, [script], { cwd: path.join(__dirname, '..'), env: { ...process.env, DATABASE_URL: test.url }, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stdout, result.stderr);
    throw new Error(`${script} failed`);
  }
  return result.stdout;
}

(async () => {
  const test = deriveTestDatabase(process.env.DATABASE_URL);
  if (process.argv.includes('--url')) { console.log(test.url); return; }
  await ensureExists(test);
  await wipe(test);
  const migrated = runNode('db/migrate.js', test);
  runNode('db/seed.js', test);
  const applied = (migrated.match(/✓ applied/g) || []).length;
  console.log(`TEST DATABASE READY: "${test.name}" (wiped, ${applied} migrations applied, seed data loaded). Your real database "${test.developmentName}" was not touched.`);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
