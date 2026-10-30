// One product per supplier + OE number + CAR. The car is the generation (brand and model) and the year, with its versions:
// "all versions" (no version rows) or exactly the same set of versions. The same OE number for another model, year or set of versions
// is another product. OE numbers are compared without spaces at the ends and in any letter case (dashes still count).
const oeKey = (s) => String(s ?? '').trim().toUpperCase();

/** For the given OE keys: the supplier's products with that OE number already listed for exactly this car. Returns Map(oeKey -> [productId]). */
async function findSameCarProducts(client, supplierId, keys, generationId, year, versionIds) {
  const out = new Map();
  const list = [...new Set((keys || []).map(oeKey).filter(Boolean))];
  if (list.length === 0 || !generationId || !year) return out;
  const { rows } = await client.query(
    `SELECT p.id, upper(btrim(p.oem_number)) AS k,
            COALESCE(array_agg(pfev.version_id::text ORDER BY pfev.version_id::text) FILTER (WHERE pfev.version_id IS NOT NULL), '{}') AS versions
     FROM products p
     JOIN product_fitment_entries pfe ON pfe.product_id = p.id
     LEFT JOIN product_fitment_entry_versions pfev ON pfev.entry_id = pfe.id
     WHERE p.supplier_id = $1 AND upper(btrim(p.oem_number)) = ANY($2) AND pfe.generation_id::text = $3::text AND pfe.year = $4
     GROUP BY p.id, p.oem_number, pfe.id`,
    [supplierId, list, generationId, Number(year)]
  );
  const want = [...(versionIds || [])].map(String).sort().join(',');
  for (const r of rows) {
    if ([...r.versions].sort().join(',') !== want) continue;
    if (!out.has(r.k)) out.set(r.k, []);
    if (!out.get(r.k).includes(r.id)) out.get(r.k).push(r.id);
  }
  return out;
}

module.exports = { oeKey, findSameCarProducts };
