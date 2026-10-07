#!/usr/bin/env node
/**
 * Finds accounts whose email addresses differ ONLY by capital letters, and helps fix them. Needed once: migration 100 (emails ignore capitals) stops with
 * "Two accounts have the same email apart from capital letters" if you have such a pair, because it will not guess which account to keep.
 *
 *   node scripts/duplicate-emails.js                  lists every such group, and which account to keep (read-only: changes nothing)
 *   node scripts/duplicate-emails.js --rename <id>    renames THAT account's address to name+old@domain (nothing is deleted; all its data stays)
 *
 * Run it from the services/api folder. It uses the same database settings as the backend (services/api/.env), so no password is needed.
 */
require('dotenv').config();
const db = require('../db/pool');

async function findGroups() {
  const { rows } = await db.query(
    `SELECT u.id, u.email, u.role, u.name, u.created_at, (u.password_hash IS NOT NULL) AS has_password,
            (SELECT count(*) FROM orders o WHERE o.buyer_id = u.id)::int AS orders
     FROM users u
     WHERE lower(u.email) IN (SELECT lower(email) FROM users GROUP BY lower(email) HAVING count(*) > 1)
     ORDER BY lower(u.email), u.created_at`
  );
  const groups = new Map();
  for (const row of rows) {
    const key = row.email.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

// The account to keep: the one with the most orders; if equal, the newest.
function suggestedKeep(accounts) {
  return [...accounts].sort((a, b) => b.orders - a.orders || new Date(b.created_at) - new Date(a.created_at))[0];
}

async function list() {
  const groups = await findGroups();
  if (groups.size === 0) {
    console.log('No accounts differ only by capital letters. Migration 100 can run.');
    return;
  }
  console.log(`${groups.size} email address${groups.size === 1 ? '' : 'es'} used by more than one account (they differ only by capital letters):\n`);
  for (const [address, accounts] of groups) {
    const keep = suggestedKeep(accounts);
    console.log(`  ${address}`);
    for (const a of accounts) {
      console.log(`    ${a.id === keep.id ? 'KEEP (suggested)' : 'give up         '}  id: ${a.id}   typed as: ${a.email}   role: ${a.role}   orders: ${a.orders}   password set: ${a.has_password ? 'yes' : 'no'}   created: ${new Date(a.created_at).toISOString().slice(0, 16).replace('T', ' ')}`);
    }
    for (const a of accounts.filter((x) => x.id !== keep.id)) {
      console.log(`    to give up that one, run:  node scripts/duplicate-emails.js --rename ${a.id}`);
    }
    console.log('');
  }
  console.log('Nothing was changed. After renaming the accounts you give up, run the start script again.');
}

async function rename(id) {
  const groups = await findGroups();
  const account = [...groups.values()].flat().find((a) => a.id === id);
  if (!account) {
    console.error(`Refused: ${id} is not one of the accounts in a duplicate group (run the script without options to see them).`);
    process.exitCode = 1;
    return;
  }
  const [local, domain] = account.email.toLowerCase().split('@');
  let candidate = `${local}+old@${domain}`;
  for (let n = 2; (await db.query('SELECT 1 FROM users WHERE lower(email) = $1', [candidate])).rows.length > 0; n += 1) candidate = `${local}+old${n}@${domain}`;
  await db.query('UPDATE users SET email = $1 WHERE id = $2', [candidate, id]);
  console.log(`Renamed ${account.email}  ->  ${candidate}   (account ${id}; nothing was deleted, all its data stays; you can rename it back later)`);
  const remaining = await findGroups();
  console.log(remaining.size === 0 ? 'No duplicates left. Migration 100 can run now.' : `${remaining.size} duplicate group(s) still left: run the script without options to see them.`);
}

(async () => {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--rename') {
      if (!args[1]) { console.error('Usage: node scripts/duplicate-emails.js --rename <account id>'); process.exitCode = 2; } else await rename(args[1]);
    } else {
      await list();
    }
  } catch (err) {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    await db.getPool().end();
  }
})();
