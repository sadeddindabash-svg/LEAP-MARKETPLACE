-- A part's fitment can be NARROWED to some versions of a car. A fitment entry (a generation and a year) with NO rows here fits EVERY version of that car (as it always did);
-- with rows it fits only those versions. The buyer's own version (My Garage) is then used to say whether the part fits.
CREATE TABLE IF NOT EXISTS product_fitment_entry_versions (
  entry_id   INTEGER NOT NULL REFERENCES product_fitment_entries(id) ON DELETE CASCADE,
  version_id TEXT    NOT NULL REFERENCES vehicle_versions(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, version_id)
);
CREATE INDEX IF NOT EXISTS idx_pfev_version ON product_fitment_entry_versions (version_id);
