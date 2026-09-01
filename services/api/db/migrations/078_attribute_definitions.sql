-- Migration 078: adds a real, defined set of attribute names and
-- their own real allowed values, confirmed with the person directly
-- from their own real spreadsheet before building. Position is
-- deliberately excluded -- confirmed explicitly to keep using the
-- existing real position field instead of a second, overlapping one.
--
-- product_attributes.attribute_name now references this real table,
-- so only a genuinely defined attribute name can ever be stored --
-- enforced at the real database level, not just application code.
-- attribute_value itself is validated against attribute_definition_
-- values at the application layer (a same-table CHECK can't
-- reference another table's rows without a trigger, and this keeps
-- the real schema simple).

CREATE TABLE IF NOT EXISTS attribute_definitions (
  name    TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS attribute_definition_values (
  attribute_name  TEXT NOT NULL REFERENCES attribute_definitions(name) ON DELETE CASCADE,
  value           TEXT NOT NULL,
  PRIMARY KEY (attribute_name, value)
);

ALTER TABLE product_attributes
  ADD CONSTRAINT product_attributes_name_fk
  FOREIGN KEY (attribute_name) REFERENCES attribute_definitions(name);

INSERT INTO attribute_definitions (name) VALUES
  ('Color'), ('Light Option'), ('Engine Capacity'), ('Camera'), ('Finishing')
ON CONFLICT DO NOTHING;

INSERT INTO attribute_definition_values (attribute_name, value) VALUES
  ('Color', 'Black'), ('Color', 'White'), ('Color', 'Yellow'), ('Color', 'Blue'),
  ('Color', 'Red'), ('Color', 'Green'), ('Color', 'No Color'), ('Color', 'Brown'), ('Color', 'Grey'),
  ('Light Option', 'LED'), ('Light Option', 'Halogen'),
  ('Engine Capacity', '1'), ('Engine Capacity', '1.2'), ('Engine Capacity', '1.3'),
  ('Engine Capacity', '1.4'), ('Engine Capacity', '1.5'), ('Engine Capacity', '1.6'),
  ('Engine Capacity', '1.8'), ('Engine Capacity', '2'), ('Engine Capacity', '2.2'),
  ('Engine Capacity', '2.4'), ('Engine Capacity', '2.5'),
  ('Camera', 'With Camera'), ('Camera', 'Without Camera'),
  ('Finishing', 'Matt'), ('Finishing', 'Gloss'), ('Finishing', 'Plastic'),
  ('Finishing', 'Fiber'), ('Finishing', 'Electr-Plated')
ON CONFLICT DO NOTHING;
