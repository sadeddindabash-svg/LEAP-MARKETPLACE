-- Migration 052: real shipping consolidation preference on orders
-- (#51), real ticket helpfulness feedback (#100).
--
-- CONFIRMED SCOPE, shipping preference: nullable, defaulting to the
-- real existing behavior (ship as available, the only behavior that
-- existed before this) -- a NULL/false value here changes nothing
-- for any real, already-placed order.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS wait_for_all_shipments BOOLEAN NOT NULL DEFAULT false;

-- CONFIRMED SCOPE, ticket feedback: nullable -- most real tickets
-- will never receive a real answer to this (a buyer has to actually
-- tap something), and NULL honestly represents "never asked or never
-- answered", not a real "false" default that would misrepresent
-- silence as a real, negative answer.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS resolution_helpful BOOLEAN;
