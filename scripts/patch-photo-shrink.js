#!/usr/bin/env node
/**
 * Photos are made smaller when they arrive (1,000 suppliers x 150 products x 3+ photos in year 1): the longest side at most 1600 px,
 * WebP, turned the right way up, hidden details removed (camera, date, GPS location). About ten times less storage (~1.6 TB -> ~130 GB
 * in year 1) and faster pages. Every photo upload goes through it (products, reviews, hub evidence, brand and category photos).
 * The "at least 800 px" quality rule still checks the original. Videos are unchanged (8 seconds by default, 50 MB at most).
 * Needs: npm install sharp (in services/api). Without it, photos are kept as uploaded, as before.
 *   node scripts/patch-photo-shrink.js            dry run
 *   node scripts/patch-photo-shrink.js --write    applies it
 */
const DATA = {"created": [], "replaced": [], "anchored": [{"file": "services/api/src/modules/uploads/routes.js", "what": "API: photos shrunk when they arrive (longest side 1600 px, WebP, right way up, camera/date/GPS removed)", "done": "SHRINK_LONGEST_SIDE_PX", "pairs": [["const { getVideoDurationInSeconds } = require('get-video-duration');", "const { getVideoDurationInSeconds } = require('get-video-duration');\n// Photos are made smaller when they arrive (patch-photo-shrink): the longest side at most 1600 px, WebP, turned the right way up, and\n// the hidden details removed (camera, date, GPS location). About ten times less storage, and pages load much faster on phones.\n// Needs the \"sharp\" package (npm install sharp in services/api); without it photos are kept as uploaded, as before.\nlet sharp = null;\ntry { sharp = require('sharp'); } catch (e) { console.warn('[uploads] sharp is not installed: photos are kept as uploaded (run: npm install sharp in services/api)'); }\nconst SHRINK_LONGEST_SIDE_PX = 1600;\nconst SHRINK_WEBP_QUALITY = 82;", false], ["    const ext = req.file.mimetype === 'image/png' ? '.png' : req.file.mimetype === 'image/webp' ? '.webp' : '.jpg';\n    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;\n\n    if (isCloudStorageConfigured()) {\n      try {\n        const url = await uploadToCloud(req.file.buffer, filename, req.file.mimetype);\n        return res.status(201).json({ url, width: dimensions.width, height: dimensions.height, storage: 'cloud' });", "    // the photo as it will be kept: shrunk to WebP when sharp is there, else as uploaded\n    let body = req.file.buffer, mimetype = req.file.mimetype, width = dimensions.width, height = dimensions.height;\n    if (sharp) {\n      try {\n        const { data, info } = await sharp(req.file.buffer, { failOn: 'error' })\n          .rotate()                                                                   // the right way up (from the phone's orientation flag)\n          .resize({ width: SHRINK_LONGEST_SIDE_PX, height: SHRINK_LONGEST_SIDE_PX, fit: 'inside', withoutEnlargement: true })\n          .webp({ quality: SHRINK_WEBP_QUALITY })                                     // keeps transparency (logos, brand photos)\n          .toBuffer({ resolveWithObject: true });                                     // no metadata copied: camera, date and GPS are gone\n        body = data; mimetype = 'image/webp'; width = info.width; height = info.height;\n      } catch (shrinkErr) {\n        return res.status(400).json({ error: 'Could not read this image: the file may be damaged. Please try another photo.' });\n      }\n    }\n    const ext = mimetype === 'image/png' ? '.png' : mimetype === 'image/webp' ? '.webp' : '.jpg';\n    const filename = `${crypto.randomBytes(16).toString('hex')}${ext}`;\n\n    if (isCloudStorageConfigured()) {\n      try {\n        const url = await uploadToCloud(body, filename, mimetype);\n        return res.status(201).json({ url, width, height, storage: 'cloud' });", false], ["    fs.writeFileSync(path.join(UPLOAD_DIR, filename), req.file.buffer);\n    res.status(201).json({ url: `/uploads/${filename}`, width: dimensions.width, height: dimensions.height, storage: 'local' });", "    fs.writeFileSync(path.join(UPLOAD_DIR, filename), body);\n    res.status(201).json({ url: `/uploads/${filename}`, width, height, storage: 'local' });", false]]}]};
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const plan = [];
let problems = 0;
const once = (s, a) => s.split(a).length === 2;
const read = (file) => { const p = path.join(root, file); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
function edit(file, what, done, change) {
  const s = read(file);
  if (s === null) { console.log(`MISSING   ${file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; return; }
  if (s.replace(/\r\n/g, '\n').includes(done)) { console.log(`already   ${file}: ${what}`); return; }
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const out = change(s.replace(/\r\n/g, '\n'));
  if (typeof out !== 'string') { console.log(`REFUSED   ${file}: ${out && out.why ? out.why : 'its text is not what this patch expects'}, so nothing was changed. Send this file.`); problems++; return; }
  plan.push({ file, what, before: s, after: out.replace(/\n/g, eol) });
}

for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (e.base64) {      // a picture: written as it is
    const bytes = Buffer.from(e.base64, 'base64');
    if (fs.existsSync(p)) {
      if (fs.readFileSync(p).equals(bytes)) { console.log(`already   ${e.file}: ${e.what}`); continue; }
      console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
    }
    if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
    plan.push({ file: e.file, what: e.what, before: null, after: bytes });
    continue;
  }
  if (fs.existsSync(p)) {
    if (fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  // a new folder (services/api/src/modules/draftPhotos) is made, but only inside one that is already there
  if (!fs.existsSync(path.dirname(path.dirname(p)))) { console.log(`MISSING   ${path.dirname(path.dirname(e.file))}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
for (const e of DATA.replaced || []) {
  edit(e.file, e.what, e.done, (s) => (e.from.includes(s) ? e.text : { why: 'it is not the version patch-hub-label-design made (run that patch first, or send this file)' }));
}
for (const e of DATA.anchored) {
  // a test file: changed when it is there and as expected, otherwise left as it is (it does not stop the patch)
  if (e.optional) {
    const s = read(e.file);
    if (s === null) { console.log(`skipped   ${e.file}: not found (a test file; nothing to do)`); continue; }
    const n = s.replace(/\r\n/g, '\n');
    if (!n.includes(e.done) && (e.pairs.some(([a, , all]) => all !== 'maybe' && all !== 'alts' && !once(n, a)) || (e.block && (!n.includes(e.block.from) || !n.includes(e.block.to))))) { console.log(`skipped   ${e.file}: not as expected, left as it is (${e.what})`); continue; }
  }
  edit(e.file, e.what, e.done, (s) => {
    let out = s;
    for (const [a, b, all] of e.pairs) {
      if (all === 'alts') { const hit = a.find(([x]) => once(out, x)); if (!hit) return { why: `this part was not found: "${a[a.length - 1][0].split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(hit[0], () => hit[1]); continue; }
      if (all === 'maybe') { if (once(out, a)) out = out.replace(a, () => b); continue; }
      if (all) { if (!out.includes(a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.split(a).join(b); continue; } if (!once(out, a)) return { why: `this part was not found: "${a.split('\n').find((l) => l.trim()).trim().slice(0, 90)}"` }; out = out.replace(a, () => b); }
    if (e.region) {
      const r = e.region; const i = out.indexOf(r.from); const j = i < 0 ? -1 : out.indexOf(r.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${r.from.trim().slice(0, 60)}" was not found` };
      const seg = out.slice(i, j);
      if (r.must && !seg.includes(r.must)) return { why: `"${r.must}" was not found in the part starting "${r.from.trim().slice(0, 60)}"` };
      const changed = seg.replace(new RegExp(r.find, 'g'), r.repl);
      if (changed === seg) return { why: `nothing to change in the part starting "${r.from.trim().slice(0, 60)}"` };
      out = out.slice(0, i) + changed + out.slice(j);
    }
    if (e.block) {
      const i = out.indexOf(e.block.from); const j = i < 0 ? -1 : out.indexOf(e.block.to, i);
      if (i < 0 || j < 0) return { why: `the part starting "${e.block.from.trim().slice(0, 60)}" was not found` };
      out = out.slice(0, i) + e.block.text + out.slice(e.block.includeTo ? j + e.block.to.length : j);
    }
    return out;
  });
}
if (DATA.mount) edit('services/api/src/index.js', DATA.mount.what, DATA.mount.done, (s) => {
  const m = s.match(/\n([ \t]*)app\.use\('\/payouts', payoutsRoutes\);[^\n]*/);
  if (!m) return { why: "the line app.use('/payouts', payoutsRoutes); was not found" };
  const at = m.index + m[0].length;
  return s.slice(0, at) + `\n${m[1]}${DATA.mount.line}` + s.slice(at);
});
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-patch-photo-shrink`, c.before);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. Then: cd services\\api ; npm install sharp ; npm run dev   (one API window only)');
