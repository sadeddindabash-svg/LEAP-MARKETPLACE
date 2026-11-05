#!/usr/bin/env node
/**
 * Read-only check: is the basket-order fix (patch-cart-order) really in use?
 *   node scripts/check-cart-order.js        (run from D:\LEAP-MARKETPLACE; changes nothing)
 * It checks 1) the server file has the fix, 2) the database has the new column (migration 140), 3) whether the API on port 4000 was started
 * before the fix was saved (then it is still running the old code).
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const api = path.join(root, 'services', 'api');
const routes = path.join(api, 'src', 'modules', 'cart', 'routes.js');
let ok = true;
const say = (good, text) => { console.log(`${good ? 'OK     ' : 'PROBLEM'}  ${text}`); if (!good) ok = false; };

if (!fs.existsSync(routes)) { console.log('Run this from D:\\LEAP-MARKETPLACE (services\\api was not found).'); process.exit(1); }
const src = fs.readFileSync(routes, 'utf8');
say(src.includes('ORDER BY ci.added_at ASC, ci.product_id ASC'), src.includes('ORDER BY ci.added_at') ? '1. the server file has the fix' : '1. the server file does NOT have the fix: run  node scripts\\patch-cart-order.js --write');
say(fs.existsSync(path.join(api, 'db', 'migrations', '140_cart_items_added_at.sql')), '2a. the migration file 140_cart_items_added_at.sql is there');
const savedAt = fs.statSync(routes).mtime;

(async () => {
  try {
    process.chdir(api);
    require(path.join(api, 'node_modules', 'dotenv')).config({ path: path.join(api, '.env') });
    const { query } = require(path.join(api, 'db', 'pool.js'));
    const col = await query("SELECT 1 FROM information_schema.columns WHERE table_name = 'cart_items' AND column_name = 'added_at'");
    say(col.rows.length === 1, col.rows.length === 1 ? '2b. the database has the new column (migration 140 ran)' : '2b. the database does NOT have it: cd services\\api ; npm run migrate');
  } catch (e) {
    say(false, `2b. could not read the database: ${e.message}`);
  }
  console.log(`\n3. The fix was saved at ${savedAt.toLocaleString()}.`);
  console.log('   The API must have been started AFTER that. To see when the API on port 4000 was started, run in PowerShell:');
  console.log('   Get-Process -Id (Get-NetTCPConnection -LocalPort 4000 -State Listen).OwningProcess | Select-Object Id, StartTime');
  console.log('   If its StartTime is earlier, stop it and start it again:');
  console.log('   Stop-Process -Id (Get-NetTCPConnection -LocalPort 4000 -State Listen).OwningProcess -Force ; cd services\\api ; npm run dev');
  console.log(ok ? '\nFiles and database are right; only a restart of the API can be missing (step 3).' : '\nFix the PROBLEM line(s) above first.');
  process.exit(0);
})();
