-- Migration 121: the courier link needs NO sign-in any more.
--
-- Delivery companies will not give their drivers accounts, so whoever carries the parcel scans the label and asks the buyer for the 4-digit
-- code, face to face; the code is the proof (5 wrong codes still lock the parcel for 15 minutes). The courier may type their name and phone
-- (optional) so Leap knows who delivered. The delivery_drivers table from migration 120 stays (older proofs point at it) but is no longer used.
ALTER TABLE delivery_proofs ADD COLUMN courier_phone TEXT;
ALTER TABLE delivery_attempts
  ADD COLUMN courier_name TEXT,
  ADD COLUMN courier_phone TEXT;
