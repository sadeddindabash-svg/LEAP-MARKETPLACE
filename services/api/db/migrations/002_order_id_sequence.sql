-- Migration 002: order ID sequence
-- Generates sequential order IDs in the existing 'LP-XXXXXX' style used
-- throughout the mobile app, admin dashboard, and supplier portal mock
-- data (e.g. LP-208841). Starting the sequence at 900 so IDs continue from
-- roughly where the mock/demo data left off (LP-208841, LP-208690, etc. —
-- see app_config.dart and the prototype mock arrays) without colliding with
-- values already shown to stakeholders in screenshots/demos.

CREATE SEQUENCE IF NOT EXISTS order_id_seq START WITH 900 INCREMENT BY 1;
