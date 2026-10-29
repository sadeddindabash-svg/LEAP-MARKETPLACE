#!/usr/bin/env node
/**
 * SERVER: a part's fitment can be NARROWED to some VERSIONS of the car (migration 114, services/api/src/modules/orderVehicles/fitmentVersions.js from the same package).
 *   - the supplier's create-product call accepts fitment.versionIds (the default, none, is "every version": nothing changes for any existing part); the admin's fitment edit keeps a part's narrowing when it re-saves the list
 *   - the supplier's own product list carries, for each car, the versions it is narrowed to; the buyer's product answer carries fitVersions (the narrowed cars and their versions) and fitVersionNames
 * No other behaviour changes. Restart the backend afterwards.
 *
 *   node scripts/patch-fit-versions.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-fit-versions.js --write    applies it (each changed file is saved as <file>.before-fit-versions first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/orderVehicles/productCars.js", "what": "the fitment reads the versions a car is narrowed to: the supplier's list shows them, the buyer's answer carries fitVersions", "done": "buyerVersionRules", "pairs": [["const MAX_SUPPLIER_CARS = 4;", "const { readVersionsByEntry, buyerVersionRules } = require('./fitmentVersions');\nconst MAX_SUPPLIER_CARS = 4;"], ["`SELECT pfe.product_id, pfe.generation_id, pfe.year, b.name AS brand,", "`SELECT pfe.id AS entry_id, pfe.product_id, pfe.generation_id, pfe.year, b.name AS brand,"], ["  const byProduct = new Map();\n  for (const r of rows) {", "  const versionsOf = await readVersionsByEntry(q, rows.map((r) => r.entry_id));      // the versions each car is narrowed to (none = every version)\n  for (const r of rows) r.versions = versionsOf.get(r.entry_id) || null;\n  const byProduct = new Map();\n  for (const r of rows) {"], ["engine: r.engine || null, transmission: r.transmission || null,", "engine: r.engine || null, transmission: r.transmission || null,\n        // null = every version\n        versions: r.versions ? r.versions.map((v) => ({ id: v.id, name: names(v.name, v.nameAr, v.nameZh), engine: v.engine, seats: v.seats })) : null,\n       "], ["      fitKeys: entries.slice(0, MAX_KEYS).map((r) => `${r.generation_id}|${r.year}`),", "      fitKeys: entries.slice(0, MAX_KEYS).map((r) => `${r.generation_id}|${r.year}`),\n      // The cars of this part that are NARROWED to some versions ({ \"generation|year\": [version ids] }) and the names of those versions. A car that is not in it fits EVERY version.\n      ...buyerVersionRules(entries.slice(0, MAX_KEYS)),"]]}, {"file": "services/api/src/modules/supplier/routes.js", "what": "a new product's fitment can be narrowed to some versions of the car (fitment.versionIds); none means every version", "done": "versionChoice", "pairs": [["const express = require('express');", "const express = require('express');\nconst { resolveVersionChoice, insertFitmentEntry } = require('../orderVehicles/fitmentVersions');"], ["    // ---- Create the product. `name` starts equal to the Chinese", "    // Optional: only some versions of this car (none = every version, as before).\n    const versionChoice = await resolveVersionChoice(client, generationId, fitment.versionIds);\n    if (versionChoice.error) {\n      await client.query('ROLLBACK');\n      return res.status(400).json({ error: versionChoice.error });\n    }\n\n    // ---- Create the product. `name` starts equal to the Chinese"], ["    await client.query(\n      `INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ($1, $2, $3, $4, $5)`,\n      [id, generationId, year, engineId || null, transmissionId || null]\n    );\n", "    await insertFitmentEntry(client, id, { generationId, year, engineId, transmissionId }, versionChoice.ids);\n"]]}, {"file": "services/api/src/modules/catalog/routes.js", "what": "an admin who re-saves a part's fitment keeps its narrowing to versions (or sets it with fitment[].versionIds)", "done": "replaceProductFitment(client, req.params.id, fitment)", "pairs": [["const { loadBuyerFit } = require('../orderVehicles/productCars');", "const { loadBuyerFit } = require('../orderVehicles/productCars');\nconst { replaceProductFitment } = require('../orderVehicles/fitmentVersions');"], ["    if (fitment !== undefined) {\n      await client.query('DELETE FROM product_fitment_entries WHERE product_id = $1', [req.params.id]);\n      for (const f of fitment) {\n        await client.query(\n          `INSERT INTO product_fitment_entries (product_id, generation_id, year, engine_id, transmission_id) VALUES ($1, $2, $3, $4, $5)`,\n          [req.params.id, f.generationId, f.year, f.engineId || null, f.transmissionId || null]\n        );\n      }\n    }\n", "    if (fitment !== undefined) {\n      // Re-saving the list must not lose a car's narrowing to some versions: it is kept for the same car, or replaced when the edit says (fitment[].versionIds).\n      const replaced = await replaceProductFitment(client, req.params.id, fitment);\n      if (replaced.error) {\n        await client.query('ROLLBACK');\n        return res.status(400).json({ error: replaced.error });\n      }\n    }\n"], ["function buildProductMatchQuery({ category, part, vehicleId, search, generationId, year }) {", "function buildProductMatchQuery({ category, part, vehicleId, search, generationId, year, versionId }) {"], ["    const genIdx = params.length + 1;\n    params.push(generationId);\n", "    const genIdx = params.length + 1;\n    params.push(generationId);\n    // The buyer's VERSION: a part narrowed to some versions of the car only counts when the buyer's version is one of them (a part that is not narrowed fits every version).\n    // A version that does not belong to this generation (a stale one) is ignored.\n    let versionSql = '';\n    if (versionId) {\n      const versionIdx = params.length + 1;\n      params.push(versionId);\n      versionSql = ` AND (NOT EXISTS (SELECT 1 FROM product_fitment_entry_versions pfev WHERE pfev.entry_id = pfe2.id)\n        OR EXISTS (SELECT 1 FROM product_fitment_entry_versions pfev WHERE pfev.entry_id = pfe2.id AND pfev.version_id = $${versionIdx})\n        OR NOT EXISTS (SELECT 1 FROM vehicle_versions vv WHERE vv.id = $${versionIdx} AND vv.generation_id = $${genIdx}))`;\n    }\n"], ["AND pfe2.generation_id = $${genIdx} AND pfe2.year = $${yearIdx})`", "AND pfe2.generation_id = $${genIdx} AND pfe2.year = $${yearIdx}${versionSql})`"], ["WHERE pfe2.product_id = p.id AND pfe2.generation_id = $${genIdx})`", "WHERE pfe2.product_id = p.id AND pfe2.generation_id = $${genIdx}${versionSql})`"], ["lang, generationId, year, minPrice, maxPrice, maxDeliveryDays, page, limit, more } = req.query;", "lang, generationId, year, versionId, minPrice, maxPrice, maxDeliveryDays, page, limit, more } = req.query;"], ["buildProductMatchQuery({ category, part, vehicleId, search, generationId, year });", "buildProductMatchQuery({ category, part, vehicleId, search, generationId, year, versionId });"], ["lang, generationId, year, minPrice, maxPrice, maxDeliveryDays, destinationIsoCode }), computeList)", "lang, generationId, year, versionId, minPrice, maxPrice, maxDeliveryDays, destinationIsoCode }), computeList)"]]}, {"file": "services/api/test/productCars.test.js", "what": "the older test of the supplier's car expects the new versions field (null: every version)", "done": "photoUrl: '/uploads/zz-pc-genA.png', versions: null });", "pairs": [["transmission: 'Automatic', photoUrl: '/uploads/zz-pc-genA.png' });", "transmission: 'Automatic', photoUrl: '/uploads/zz-pc-genA.png', versions: null });"]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(e.done)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a, b] of e.pairs) { if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-fit-versions`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
