const MAX_VERSION_CHOICES = 60;
const MAX_RULE_KEYS = 500;

/**
 * A part's fitment entry is a generation and a year (and optionally an engine and a transmission). It can be NARROWED to some VERSIONS of that car (product_fitment_entry_versions):
 *   - no rows  = every version of that car (the default, and how every part worked before versions existed)
 *   - some rows = only those versions
 * The buyer's own car (My Garage) has a version; it is compared only when the part is narrowed.
 */

// What a supplier (or an admin) chose, checked against the car. Returns { ids } where [] means "all versions" (nothing is stored), or { error }.
// Choosing EVERY version of the generation is the same as choosing none: it is stored as "all versions", so a version added to the catalogue later still fits.
async function resolveVersionChoice(client, generationId, versionIds) {
  if (versionIds === undefined || versionIds === null) return { ids: [] };
  if (!Array.isArray(versionIds)) return { error: 'fitment.versionIds must be a list of versions' };
  const ids = [...new Set(versionIds.filter((v) => typeof v === 'string' && v.trim() !== '').map((v) => v.trim()))];
  if (ids.length !== versionIds.length && versionIds.some((v) => typeof v !== 'string' || v.trim() === '')) return { error: 'fitment.versionIds must be a list of version ids' };
  if (ids.length === 0) return { ids: [] };
  if (ids.length > MAX_VERSION_CHOICES) return { error: `fitment.versionIds can have at most ${MAX_VERSION_CHOICES} versions` };
  const { rows } = await client.query('SELECT id FROM vehicle_versions WHERE generation_id = $1', [generationId]);
  const ofGeneration = new Set(rows.map((r) => r.id));
  if (ids.some((id) => !ofGeneration.has(id))) return { error: 'fitment.versionIds has a version that does not belong to the given generation' };
  if (ids.length >= ofGeneration.size) return { ids: [] };
  return { ids };
}

async function saveEntryVersions(client, entryId, ids) {
  for (const id of ids || []) await client.query('INSERT INTO product_fitment_entry_versions (entry_id, version_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [entryId, id]);
}

// The narrowing of each entry, for readers: Map(entryId -> [{ id, name, nameAr, nameZh, engine, seats }]) (entries with no narrowing are not in the map).
async function readVersionsByEntry(q, entryIds) {
  const ids = [...new Set((entryIds || []).filter((x) => x !== undefined && x !== null))];
  const out = new Map();
  if (ids.length === 0) return out;
  const { rows } = await q.query(
    `SELECT pfev.entry_id, v.id, v.name, v.name_ar, v.name_zh, v.engine, v.seats
     FROM product_fitment_entry_versions pfev JOIN vehicle_versions v ON v.id = pfev.version_id
     WHERE pfev.entry_id = ANY($1) ORDER BY pfev.entry_id, v.sort_order, v.name`, [ids]);
  for (const r of rows) { if (!out.has(r.entry_id)) out.set(r.entry_id, []); out.get(r.entry_id).push({ id: r.id, name: r.name, nameAr: r.name_ar || null, nameZh: r.name_zh || null, engine: r.engine || null, seats: r.seats }); }
  return out;
}

/**
 * For the buyer's page: which cars (a generation and a year) of this part are narrowed, and to which versions. Only narrowed cars appear in `fitVersions`; a car that is not in it fits EVERY version.
 * Two entries for the same car (for example different engines): if ANY of them fits every version the car fits every version; otherwise the versions are joined.
 */
function buyerVersionRules(entries) {
  const byKey = new Map();
  for (const e of entries || []) {
    const key = `${e.generation_id}|${e.year}`;
    const versions = Array.isArray(e.versions) && e.versions.length > 0 ? e.versions : null;
    const cur = byKey.get(key);
    if (cur === undefined) byKey.set(key, versions ? new Map(versions.map((v) => [v.id, v])) : null);
    else if (cur !== null) { if (versions === null) byKey.set(key, null); else for (const v of versions) cur.set(v.id, v); }
  }
  const fitVersions = {}; const fitVersionNames = {};
  for (const [key, map] of byKey) {
    if (map === null || Object.keys(fitVersions).length >= MAX_RULE_KEYS) continue;
    fitVersions[key] = [...map.keys()];
    for (const v of map.values()) fitVersionNames[v.id] = { name: v.name, nameAr: v.nameAr || null, nameZh: v.nameZh || null };
  }
  return { fitVersions, fitVersionNames };
}

// The narrowing a product has now, by car, so an admin who re-saves the fitment list does not lose it: Map("generation|year|engine|transmission" -> [versionId]).
const entryKey = (e) => `${e.generation_id ?? e.generationId}|${e.year}|${e.engine_id ?? e.engineId ?? ''}|${e.transmission_id ?? e.transmissionId ?? ''}`;
async function readRestrictionsByKey(client, productId) {
  const { rows } = await client.query(
    `SELECT pfe.generation_id, pfe.year, pfe.engine_id, pfe.transmission_id, pfev.version_id
     FROM product_fitment_entries pfe JOIN product_fitment_entry_versions pfev ON pfev.entry_id = pfe.id WHERE pfe.product_id = $1`, [productId]);
  const out = new Map();
  for (const r of rows) { const k = entryKey(r); if (!out.has(k)) out.set(k, []); out.get(k).push(r.version_id); }
  return out;
}

// A fitment entry for a part, with the versions it is narrowed to (none = every version). Returns the new entry's id.
async function insertFitmentEntry(client, productId, { generationId, year, engineId, transmissionId }, versionIds) {
  const entry = await client.query(
    `INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [productId, generationId, year, engineId || null, transmissionId || null]
  );
  await saveEntryVersions(client, entry.rows[0].id, versionIds);
  return entry.rows[0].id;
}

// The admin's re-save of a part's whole fitment list. A car's narrowing to some versions is KEPT for the same car (same generation, year, engine and transmission) unless the edit sets it (fitment[].versionIds).
// Returns { error } (nothing was changed by this call: roll the transaction back) or {}.
async function replaceProductFitment(client, productId, fitment) {
  const kept = await readRestrictionsByKey(client, productId);
  await client.query('DELETE FROM product_fitment_entries WHERE product_id = $1', [productId]);
  for (const f of fitment) {
    const choice = f.versionIds !== undefined ? await resolveVersionChoice(client, f.generationId, f.versionIds) : { ids: kept.get(entryKey(f)) || [] };
    if (choice.error) return { error: choice.error };
    await insertFitmentEntry(client, productId, f, choice.ids);
  }
  return {};
}

module.exports = { MAX_VERSION_CHOICES, resolveVersionChoice, saveEntryVersions, readVersionsByEntry, buyerVersionRules, entryKey, readRestrictionsByKey, insertFitmentEntry, replaceProductFitment };
