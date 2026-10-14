#!/usr/bin/env node
/**
 * Is this installation ready for real customers? Reads the settings (environment variables, including services/api/.env) and the database, and
 * prints what BLOCKS going live, what to deal with soon, and what is fine, each with the exact fix. It CHANGES NOTHING.
 *
 *   node scripts/check-launch-readiness.js          run it from services/api, on the SERVER you are about to launch (so it sees the production settings)
 *   node scripts/check-launch-readiness.js --json   the same, machine readable
 *
 * Exit code: 1 if anything blocks going live, otherwise 0.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db/pool');
const { getPendingMigrations } = require('../src/config/pendingMigrations');
const rules = require('./testDataRules');
const { evaluate, summarize, KNOWN_DEFAULT_PASSWORDS } = require('./launchChecks');

async function gatherFacts() {
  const one = async (sql, params) => (await db.query(sql, params)).rows;

  const pending = await getPendingMigrations({ db });
  const databaseName = (await one('SELECT current_database() AS name'))[0].name;

  // Accounts that matter (admin / supplier / hub staff) and are not the tests' own: does the password still equal one from the source code?
  const accounts = await one(`SELECT email, role, password_hash FROM users
                              WHERE role IN ('admin', 'supplier', 'hub_staff') AND email !~* '@example\\.(com|org|net)$' AND email !~* '^perm-test-'
                              ORDER BY email LIMIT 200`);
  const defaultPasswordAccounts = [];
  for (const account of accounts) {
    if (!account.password_hash) continue;
    for (const candidate of KNOWN_DEFAULT_PASSWORDS) {
      if (await bcrypt.compare(candidate, account.password_hash)) { defaultPasswordAccounts.push({ email: account.email, role: account.role }); break; }
    }
  }

  const people = await one(`SELECT email, role, is_owner FROM users`);
  const testAdminAccounts = people.filter((u) => u.role === 'admin' && rules.isTestAdmin({ email: u.email, is_owner: u.is_owner })).length;
  const testAccounts = people.filter((u) => u.role !== 'admin' && rules.isTestAddress(u.email)).length;

  const orders = await one(`SELECT COALESCE(u.email, o.guest_email) AS owner FROM orders o LEFT JOIN users u ON u.id = o.buyer_id`);
  const products = await one(`SELECT id, name, name_zh, name_ar FROM products`);
  const categories = await one(`SELECT id, name_en FROM product_categories`);
  const hubs = await one(`SELECT id, name FROM hubs`);
  const testData = {
    orders: orders.filter((o) => rules.isTestAddress(o.owner)).length,
    products: products.filter(rules.isTestProduct).length,
    categories: categories.filter(rules.isTestCategory).length,
    hubs: hubs.filter(rules.isTestHub).length,
  };

  const fakeReviewProducts = (await one(`SELECT p.id, p.review_count AS shown,
        (SELECT count(*)::int FROM product_reviews r WHERE r.product_id = p.id AND r.status = 'approved') AS real
      FROM products p WHERE p.review_count > 0`)).filter((p) => p.shown > p.real);

  // Active products whose shipping fee cannot be worked out: no weight and size of their own, and their part has none either. The catalog hides them from every
  // buyer-facing list (and says "not found" on their page) rather than failing for everyone. Old products priced directly in USD never need a weight: they are not listed.
  const unpriceableProducts = await one(`SELECT p.id, p.category, p.part FROM products p
      LEFT JOIN category_parts cp ON cp.category_id = p.category AND lower(btrim(cp.name_en)) = lower(btrim(p.part))
      WHERE p.status = 'active' AND p.currency_code = 'CNY'
        AND NOT (p.weight_kg IS NOT NULL AND p.length_cm IS NOT NULL AND p.width_cm IS NOT NULL AND p.height_cm IS NOT NULL)
        AND cp.weight_kg IS NULL
      ORDER BY p.id`);

  const ownersWithoutTwoFactor = (await one(`SELECT email FROM users WHERE is_owner = true AND COALESCE(two_factor_enabled, false) = false ORDER BY email`)).map((r) => r.email);
  const realHubs = hubs.filter((h) => !rules.isTestHub(h)).length;

  return { pendingMigrations: pending, databaseName, defaultPasswordAccounts, testAdminAccounts, testAccounts, testData, fakeReviewProducts, unpriceableProducts, ownersWithoutTwoFactor, realHubs };
}

(async () => {
  try {
    const facts = await gatherFacts();
    const results = evaluate(facts, process.env);
    const summary = summarize(results);
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify({ summary, results }, null, 2));
    } else {
      const mark = { fail: '[FAIL]', warn: '[WARN]', pass: '[PASS]' };
      console.log('\nLeap launch-readiness check (reads settings and the database, changes nothing)\n');
      for (const level of ['fail', 'warn', 'pass']) {
        for (const r of results.filter((x) => x.level === level)) {
          console.log(`${mark[level]} ${r.title}`);
          if (level !== 'pass' && r.why) console.log(`       Why: ${r.why}`);
          if (level !== 'pass' && r.fix) console.log(`       Fix: ${r.fix}`);
        }
      }
      console.log(`\n${summary.fail} blocker(s), ${summary.warn} warning(s), ${summary.pass} passed.`);
      console.log(summary.fail > 0 ? 'NOT ready: fix every [FAIL] before real customers. Then run this again on the production server.' : (summary.warn > 0 ? 'No blockers. Deal with the warnings soon.' : 'Ready.'));
      console.log('This cannot check everything: see docs/LAUNCH-CHECKLIST.md for what only a person can do (HTTPS, backups, domain, legal pages...).\n');
    }
    process.exitCode = summary.fail > 0 ? 1 : 0;
  } catch (err) {
    console.error('The check could not run:', err.message);
    process.exitCode = 2;
  } finally {
    await db.getPool().end();
  }
})();
