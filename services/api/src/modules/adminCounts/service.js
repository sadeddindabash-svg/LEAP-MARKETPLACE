/**
 * The numbers in the admin portal's side menu (and on the tabs inside its groups): what is waiting for the platform.
 *   orders            orders not delivered yet (not cancelled); `late`: the ones the delay check already found late (supplier_sub_orders.delay_notified)
 *   suppliers         suppliers waiting for approval
 *   supplierMessages  messages from suppliers an admin has not opened yet (suppliers.admin_messages_read_at, migration 131)
 *   returns           return cases still open
 *   flagged           flagged shipments still open
 *   tickets           support tickets still open
 *   shippingCosts     parcel shipping costs waiting for an admin (migration 127)
 */
async function countsFor(db) {
  const one = async (sql) => Number((await db.query(sql)).rows[0].n);
  const { rows: [o] } = await db.query(
    `SELECT COUNT(*) AS n,
            COUNT(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM supplier_sub_orders so WHERE so.order_id = o.id AND so.status != 'cancelled' AND so.delay_notified = true
                AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered'))) AS late
     FROM orders o
     WHERE o.status != 'cancelled'
       AND EXISTS (
         SELECT 1 FROM supplier_sub_orders so WHERE so.order_id = o.id AND so.status != 'cancelled'
           AND NOT EXISTS (SELECT 1 FROM hub_shipments hs WHERE hs.sub_order_id = so.id AND hs.status = 'delivered'))`
  );
  return {
    orders: { notDelivered: Number(o.n), late: Number(o.late) },
    suppliers: await one(`SELECT COUNT(*) AS n FROM suppliers WHERE verification_status = 'pending'`),
    supplierMessages: await one(
      `SELECT COUNT(*) AS n FROM supplier_messages sm JOIN suppliers s ON s.id = sm.supplier_id
       WHERE sm.sender_role = 'supplier' AND sm.created_at > COALESCE(s.admin_messages_read_at, '-infinity'::timestamptz)`),
    returns: await one(`SELECT COUNT(*) AS n FROM return_cases WHERE status IN ('awaiting', 'in_progress')`),
    flagged: await one(`SELECT COUNT(*) AS n FROM hub_shipments WHERE resolved_at IS NULL AND status IN ('flagged', 'returned_to_supplier', 'discarded_at_hub')`),
    tickets: await one(`SELECT COUNT(*) AS n FROM support_tickets WHERE status != 'resolved'`),
    shippingCosts: await one(`SELECT COUNT(*) AS n FROM hub_parcel_costs WHERE state IN ('needs_photo', 'waiting')`).catch(() => 0),
  };
}

/** An admin opened a supplier's thread: its messages are read. */
async function markSupplierMessagesRead(db, supplierId) {
  await db.query('UPDATE suppliers SET admin_messages_read_at = now() WHERE id = $1', [supplierId]);
}

module.exports = { countsFor, markSupplierMessagesRead };
