/**
 * The numbers beside Orders, Returns and Messages in the supplier portal's side menu (design A): what is waiting for the supplier.
 *   orders    new orders to accept (no answer yet), and accepted ones not shipped yet; `late`: new ones past their answer time (respond_by)
 *   returns   return / warranty cases still open (awaiting, in progress)
 *   messages  messages from the Leap team since the supplier last opened Messages (suppliers.messages_read_at, migration 128)
 */
async function countsFor(db, supplierId) {
  const { rows: [o] } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE so.accepted_at IS NULL) AS to_accept,
            COUNT(*) FILTER (WHERE so.accepted_at IS NOT NULL) AS to_ship,
            COUNT(*) FILTER (WHERE so.accepted_at IS NULL AND so.respond_by IS NOT NULL AND so.respond_by < now()) AS late
     FROM supplier_sub_orders so
     WHERE so.supplier_id = $1 AND so.status IN ('pending', 'preparing') AND so.refused_at IS NULL`, [supplierId]
  );
  const { rows: [r] } = await db.query(
    `SELECT COUNT(*) AS n FROM return_cases rc JOIN supplier_sub_orders so ON so.id = rc.sub_order_id
     WHERE so.supplier_id = $1 AND rc.status IN ('awaiting', 'in_progress')`, [supplierId]
  );
  const { rows: [m] } = await db.query(
    `SELECT COUNT(*) AS n FROM supplier_messages sm JOIN suppliers s ON s.id = sm.supplier_id
     WHERE sm.supplier_id = $1 AND sm.sender_role = 'admin' AND sm.created_at > COALESCE(s.messages_read_at, '-infinity'::timestamptz)`, [supplierId]
  );
  const toAccept = Number(o.to_accept); const toShip = Number(o.to_ship);
  return { orders: { waiting: toAccept + toShip, toAccept, toShip, late: Number(o.late) }, returns: Number(r.n), messages: Number(m.n) };
}

/** The supplier opened Messages: the number beside it goes away. */
async function markMessagesRead(db, supplierId) {
  await db.query('UPDATE suppliers SET messages_read_at = now() WHERE id = $1', [supplierId]);
}

module.exports = { countsFor, markMessagesRead };
