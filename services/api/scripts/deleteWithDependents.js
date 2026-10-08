/**
 * Deletes some rows AND everything that depends on them, using the database's own foreign keys to find "everything that depends on them".
 * Used by remove-test-data.js to remove test orders together with their shipments, events, fault cases, return cases, tickets, payments, addresses...
 *
 * How: (1) mark the starting rows, (2) repeatedly mark every row that points at a marked row (through any foreign key), until nothing new turns up,
 * (3) delete the marked rows table by table in an order the database accepts (a table whose rows are still pointed at is retried later).
 * Links the database would simply blank (ON DELETE SET NULL) are left to the database. Everything happens inside the caller's transaction, so a
 * dry run can do the real deletion and then roll it back, and any surprise (a foreign key violation nothing can resolve) aborts it all.
 */
async function loadForeignKeys(client) {
  const { rows } = await client.query(`
    SELECT c.conrelid::regclass::text AS child, a.attname AS child_col, c.confrelid::regclass::text AS parent, pa.attname AS parent_col, c.confdeltype AS rule
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
    JOIN pg_attribute pa ON pa.attrelid = c.confrelid AND pa.attnum = c.confkey[1]
    WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1`);
  return rows;
}

async function startMarking(client) {
  await client.query('CREATE TEMP TABLE IF NOT EXISTS _marked (tbl text NOT NULL, id text NOT NULL, PRIMARY KEY (tbl, id)) ON COMMIT DROP');
  await client.query('TRUNCATE _marked');
}

async function markRows(client, table, whereSql, params = []) {
  const r = await client.query(`INSERT INTO _marked (tbl, id) SELECT $${params.length + 1}, t.ctid::text FROM ${table} t WHERE ${whereSql} ON CONFLICT DO NOTHING`, [...params, table]);
  return r.rowCount;
}

// Marks every row that (directly or not) points at a marked row. Returns how many rows were newly marked.
async function markDependents(client, foreignKeys) {
  const quote = (name) => `"${String(name).replace(/"/g, '""')}"`;
  const changed = new Set(); // parent tables that gained marked rows since a foreign key last looked at them
  const { rows: present } = await client.query('SELECT DISTINCT tbl FROM _marked');
  present.forEach((r) => changed.add(r.tbl));
  const lastSeen = new Map();
  let total = 0;
  for (let round = 0; round < 50; round += 1) {
    let added = 0;
    const gained = new Set();
    for (const fk of foreignKeys) {
      if (fk.rule === 'n') continue;                     // SET NULL: the database blanks the link on its own
      if (!changed.has(fk.parent)) continue;             // nothing new in the parent since the last look
      const r = await client.query(
        `INSERT INTO _marked (tbl, id)
         SELECT $1, c.ctid::text FROM ${fk.child} c
         WHERE c.${quote(fk.child_col)} IN (SELECT p.${quote(fk.parent_col)} FROM ${fk.parent} p WHERE p.ctid::text IN (SELECT id FROM _marked WHERE tbl = $2))
         ON CONFLICT DO NOTHING`, [fk.child, fk.parent]);
      if (r.rowCount > 0) { added += r.rowCount; gained.add(fk.child); }
      lastSeen.set(fk, true);
    }
    total += added;
    if (added === 0) return total;
    changed.clear(); gained.forEach((t) => changed.add(t));
  }
  throw new Error('The dependency search did not settle (a loop of foreign keys?).');
}

async function markedCounts(client) {
  const { rows } = await client.query('SELECT tbl, count(*)::int AS n FROM _marked GROUP BY tbl ORDER BY n DESC');
  return Object.fromEntries(rows.map((r) => [r.tbl, r.n]));
}

async function deleteMarked(client) {
  const pending = new Set(Object.keys(await markedCounts(client)));
  const deleted = {};
  for (let pass = 0; pass < 40 && pending.size > 0; pass += 1) {
    let progress = false;
    for (const table of [...pending]) {
      await client.query('SAVEPOINT remove_marked');
      try {
        const r = await client.query(`DELETE FROM ${table} WHERE ctid::text IN (SELECT id FROM _marked WHERE tbl = $1)`, [table]);
        await client.query('RELEASE SAVEPOINT remove_marked');
        deleted[table] = r.rowCount; pending.delete(table); progress = true;
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT remove_marked');
        if (err.code !== '23503') throw err;            // only "still pointed at" is expected; try this table again after the others
      }
    }
    if (!progress) throw new Error(`Could not delete in a consistent order; still stuck: ${[...pending].join(', ')}`);
  }
  return deleted;
}

module.exports = { loadForeignKeys, startMarking, markRows, markDependents, markedCounts, deleteMarked };
