const db = require('../../db/pool');

/// Real, shared, atomic "move up/down" reorder helper -- extracted
/// from the real, already-proven pattern in
/// modules/pricing/routes.js's own fee-component move endpoint, since
/// this same real logic is needed 7 separate times across this
/// codebase (categories, parts, brands, models, generations, engines,
/// transmissions) and duplicating a real multi-statement transaction
/// 7 times invites real drift/bugs between copies.
///
/// `scopeColumn`/`scopeValue` are optional -- when provided, only
/// rows sharing the same real scope value (e.g. the same real
/// brand_id, for models) are considered neighbors; a model can only
/// swap with another model under its own real brand, never one under
/// a different brand. When omitted, reordering is real and global
/// across the whole real table (e.g. brands, which have no real
/// parent to scope by).
async function moveItem({ table, id, direction, orderColumn, scopeColumn, scopeValue, notFoundMessage }) {
  if (!['up', 'down'].includes(direction)) {
    const err = new Error('direction must be "up" or "down"');
    err.statusCode = 400;
    throw err;
  }
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows: currentRows } = await client.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (currentRows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error(notFoundMessage || 'Item not found');
      err.statusCode = 404;
      throw err;
    }
    const current = currentRows[0];

    const scopeClause = scopeColumn ? `AND ${scopeColumn} = $2` : '';
    const scopeParams = scopeColumn ? [current[orderColumn], scopeValue ?? current[scopeColumn]] : [current[orderColumn]];

    const { rows: neighborRows } = await client.query(
      direction === 'up'
        ? `SELECT * FROM ${table} WHERE ${orderColumn} < $1 ${scopeClause} ORDER BY ${orderColumn} DESC LIMIT 1`
        : `SELECT * FROM ${table} WHERE ${orderColumn} > $1 ${scopeClause} ORDER BY ${orderColumn} ASC LIMIT 1`,
      scopeParams
    );
    if (neighborRows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error(`This is already the ${direction === 'up' ? 'first' : 'last'} item.`);
      err.statusCode = 400;
      throw err;
    }
    const neighbor = neighborRows[0];

    await client.query(`UPDATE ${table} SET ${orderColumn} = $1 WHERE id = $2`, [neighbor[orderColumn], current.id]);
    await client.query(`UPDATE ${table} SET ${orderColumn} = $1 WHERE id = $2`, [current[orderColumn], neighbor.id]);
    await client.query('COMMIT');
    return { current, neighbor };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { moveItem };
