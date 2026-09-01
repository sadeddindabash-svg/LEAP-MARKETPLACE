-- Migration 079: confirmed with the person, a genuine reversal of
-- the earlier decision (migration 078 deliberately excluded
-- Position, keeping it a separate required field) -- Position is
-- now a fully equal, selectable attribute, exactly like Color,
-- Camera, etc.: not shown by default, picked from the same "+ Add
-- attribute" dropdown, removable the same way, and confirmed
-- explicitly now fully optional (no longer a required field at
-- submission).
--
-- Uses the existing, real ALLOWED_POSITIONS values already
-- established elsewhere in this codebase (services/api/src/modules/
-- shared/productValidation.js) -- confirmed with the person earlier
-- ("for position use ours") to keep using this real, existing list
-- rather than the differently-worded variants from their original
-- spreadsheet.

INSERT INTO attribute_definitions (name) VALUES ('Position') ON CONFLICT DO NOTHING;

INSERT INTO attribute_definition_values (attribute_name, value) VALUES
  ('Position', 'Front'), ('Position', 'Rear'), ('Position', 'Left'), ('Position', 'Right'),
  ('Position', 'Front-Left'), ('Position', 'Front-Right'),
  ('Position', 'Rear-Left'), ('Position', 'Rear-Right'), ('Position', 'Universal')
ON CONFLICT DO NOTHING;
