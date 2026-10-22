#!/usr/bin/env node
/**
 * Categories: "Cannot delete this category - real products still reference it". The refusal now opens a window that shows exactly WHICH products still use the category (live, hidden, waiting for review, suppliers'
 * drafts) and lets the admin delete those products and the category in one safe step (typed confirmation; a product that an order or a quote request points at is never touched). Run it AFTER scripts/patch-product-delete.js.
 *
 *   node scripts/patch-category-remove.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-category-remove.js --write    applies it (each changed file is saved as <file>.before-category-remove first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "services/api/src/modules/catalog/routes.js", "what": "mount the category removal routes and tell the screen WHY a category cannot be deleted (inUse)", "done": "categoryRemove", "pairs": [["module.exports = router;", "// Categories > Delete: what still uses a category, and removing it together with its products (see categoryRemove.js).\nrouter.use('/admin/categories', require('./categoryRemove'));\n\nmodule.exports = router;"], ["      return res.status(409).json({ error: 'Cannot delete this category — real products still reference it' });", "      return res.status(409).json({ error: 'Cannot delete this category — real products still reference it', inUse: true });"]]}, {"file": "apps/admin-dashboard/src/auth.js", "what": "deleting a category: the refusal carries its details, and the calls that show what uses a category and remove it with its products", "done": "removeCategoryWithProducts", "pairs": [["export async function deleteCategory(token, id) {\n  const response = await fetch(`${API_BASE_URL}/catalog/categories/${id}`, {\n    method: \"DELETE\",\n    headers: { Authorization: `Bearer ${token}` },\n  });\n  if (response.status === 401) throw new SessionExpiredError(\"Your session has expired. Please log in again.\");\n  if (response.status === 204) return null;\n  const data = await response.json();\n  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);", "export async function deleteCategory(token, id) {\n  const response = await fetch(`${API_BASE_URL}/catalog/categories/${id}`, {\n    method: \"DELETE\",\n    headers: { Authorization: `Bearer ${token}` },\n  });\n  if (response.status === 401) throw new SessionExpiredError(\"Your session has expired. Please log in again.\");\n  if (response.status === 204) return null;\n  const data = await response.json();\n  if (!response.ok) { const error = new Error(data.error || `Request failed (${response.status})`); error.payload = data; throw error; }          // payload.inUse = products still use it"], ["export async function fetchProductRequirements() {", "// Categories: what still uses a category, and removing it together with its products (see the server's catalog/categoryRemove.js).\nasync function categoryCall(method, id, path, token, body) {\n  const response = await fetch(`${API_BASE_URL}/catalog/admin/categories/${encodeURIComponent(id)}/${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { \"Content-Type\": \"application/json\" } : {}) }, body: body ? JSON.stringify(body) : undefined });\n  if (response.status === 401) throw new SessionExpiredError(\"Your session has expired. Please log in again.\");\n  const data = await response.json().catch(() => ({}));\n  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);\n  return data;\n}\nexport const fetchCategoryInUse = (token, id) => categoryCall(\"GET\", id, \"in-use\", token);\nexport const removeCategoryWithProducts = (token, id, confirm) => categoryCall(\"POST\", id, \"remove\", token, { confirm });\nexport async function fetchProductRequirements() {"]]}, {"file": "apps/admin-dashboard/src/App.jsx", "what": "a category that cannot be deleted opens a window showing what is using it, with a way to clear it out", "done": "CategoryInUseDialog", "pairs": [["ProductReviewDialog, ProductPageDelete } from \"./ProductDeleteDialog\";", "ProductReviewDialog, ProductPageDelete } from \"./ProductDeleteDialog\";\nimport CategoryInUseDialog from \"./CategoryInUseDialog\";"], ["  const [pendingDeleteCat, setPendingDeleteCat] = useState(null); // {id, nameEn}", "  const [pendingDeleteCat, setPendingDeleteCat] = useState(null); // {id, nameEn}\n  const [inUseCat, setInUseCat] = useState(null);                 // {id, nameEn}: the window that shows what still uses a category"], ["      setErrorMessage(err.message); // e.g. the real 409 messages for real products or attached parts\n    } finally {\n      setPendingDeleteCat(null);", "      if (err.payload && err.payload.inUse) { setInUseCat({ id, nameEn: pendingDeleteCat?.nameEn }); return; }          // products still use it: show WHICH, and offer to clear them\n      setErrorMessage(err.message); // e.g. the real 409 messages for real products or attached parts\n    } finally {\n      setPendingDeleteCat(null);"], ["        onCancel={() => setPendingDeleteCat(null)}\n      />\n      <EditDialog", "        onCancel={() => setPendingDeleteCat(null)}\n      />\n      {inUseCat && <CategoryInUseDialog categoryId={inUseCat.id} categoryName={inUseCat.nameEn} onClose={() => setInUseCat(null)} onChanged={() => loadCategories()} onSessionExpired={onSessionExpired} />}\n      <EditDialog"]]}], "whole": [], "tests": []};
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
  const fresh = fs.readFileSync(path.join(__dirname, 'category-remove-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'category-remove-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-category-remove`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
