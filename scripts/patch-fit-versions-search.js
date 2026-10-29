#!/usr/bin/env node
/**
 * Website: the "Parts Fit with my Car" switch (the search filter) uses the buyer's VERSION too: a part narrowed to OTHER versions of the car is no longer listed; a part for the buyer's version and a part that is not narrowed are.
 * The switch adds versionId to the address (and removes it when switched off or when the car is changed by hand); the search page, the lazy-loaded pages and the website's own products route pass it to the shop's API.
 * A saved car with no version sends none (every part of that year is listed, as before). Needs the server package (patch-fit-versions.js). Run it AFTER the other storefront patches.
 *
 *   node scripts/patch-fit-versions-search.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-fit-versions-search.js --write    applies it (each changed file is saved as <file>.before-fit-versions-search first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/web-storefront/lib/api.ts", "what": "the product search can carry the buyer's version", "done": "a part narrowed to other versions is then not listed.", "pairs": [["  year?: number;\n  page?: number;\n  limit?: number;\n  lang?: Lang;\n  part?: string;", "  year?: number;\n  /** The buyer's VERSION of that car: a part narrowed to other versions is then not listed. */\n  versionId?: string;\n  page?: number;\n  limit?: number;\n  lang?: Lang;\n  part?: string;"], ["  if (params.year) query.set(\"year\", String(params.year));\n  if (params.lang === \"ar\") query.set(\"lang\", \"ar\");\n  if (params.more) query.set(\"more\", \"1\");", "  if (params.year) query.set(\"year\", String(params.year));\n  if (params.versionId) query.set(\"versionId\", params.versionId);\n  if (params.lang === \"ar\") query.set(\"lang\", \"ar\");\n  if (params.more) query.set(\"more\", \"1\");"]]}, {"file": "apps/web-storefront/lib/gridSource.ts", "what": "a lazily loaded search list carries the buyer's version (and checks it)", "done": "versionId", "pairs": [["| { kind: \"search\"; params: { q?: string; category?: string; part?: string; generationId?: string; year?: number } }", "| { kind: \"search\"; params: { q?: string; category?: string; part?: string; generationId?: string; year?: number; versionId?: string } }"], ["const { q: text, category, part, generationId, year } = source.params;", "const { q: text, category, part, generationId, year, versionId } = source.params;"], ["    if (year) q.set(\"year\", String(year));\n  }", "    if (year) q.set(\"year\", String(year));\n    if (versionId) q.set(\"versionId\", versionId);\n  }"], ["const params: { q?: string; category?: string; part?: string; generationId?: string; year?: number } = {};", "const params: { q?: string; category?: string; part?: string; generationId?: string; year?: number; versionId?: string } = {};"], ["[\"category\", \"part\", \"generationId\"] as const", "[\"category\", \"part\", \"generationId\", \"versionId\"] as const"]]}, {"file": "apps/web-storefront/app/api/products/route.ts", "what": "the website's products route passes the buyer's version on", "done": "versionId", "pairs": [["const { q, category, part, generationId, year } = source.params;", "const { q, category, part, generationId, year, versionId } = source.params;"], ["fetchProductsPaginated({ search: q, category, part, generationId, year, page, limit, lang, more: true });", "fetchProductsPaginated({ search: q, category, part, generationId, year, versionId, page, limit, lang, more: true });"]]}, {"file": "apps/web-storefront/app/search/page.tsx", "what": "the search page reads the buyer's version and passes it on", "done": "versionId", "pairs": [["generationId?: string; year?: string; page?: string }>;", "generationId?: string; year?: string; versionId?: string; page?: string }>;"], ["const { q, category, part, generationId, year, page } = await searchParams;", "const { q, category, part, generationId, year, versionId, page } = await searchParams;"], ["fetchProductsPaginated({ search: q, category, part, generationId, year: year ? Number(year) : undefined, page: pageNum,", "fetchProductsPaginated({ search: q, category, part, generationId, year: year ? Number(year) : undefined, versionId, page: pageNum,"], ["params: { q, category, part, generationId, year: year ? Number(year) : undefined } }}", "params: { q, category, part, generationId, year: year ? Number(year) : undefined, versionId } }}"]]}, {"file": "apps/web-storefront/components/FitsMyCarToggle.tsx", "what": "the switch adds the buyer's version to the filter", "done": "versionId", "pairs": [["if (active) { next.delete(\"generationId\"); next.delete(\"year\"); } else { next.set(\"generationId\", car.generationId); next.set(\"year\", String(car.year)); }", "if (active) { next.delete(\"generationId\"); next.delete(\"year\"); next.delete(\"versionId\"); } else { next.set(\"generationId\", car.generationId); next.set(\"year\", String(car.year)); if (car.versionId) next.set(\"versionId\", car.versionId); else next.delete(\"versionId\"); }"]]}, {"file": "apps/web-storefront/components/VehicleFilter.tsx", "what": "choosing another car by hand drops the switch's version", "done": "versionId", "pairs": [["    if (year) params.set(\"year\", year); else params.delete(\"year\");\n    router.push(", "    if (year) params.set(\"year\", year); else params.delete(\"year\");\n    params.delete(\"versionId\");      // another car chosen by hand: the version of the switch no longer belongs to it\n    router.push("], ["params.delete(\"generationId\"); params.delete(\"year\");", "params.delete(\"generationId\"); params.delete(\"year\"); params.delete(\"versionId\");"]]}], "whole": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-search-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'fit-versions-search-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-fit-versions-search`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
