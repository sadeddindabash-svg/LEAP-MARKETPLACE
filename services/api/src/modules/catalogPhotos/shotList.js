// The SHOT LIST: a spreadsheet to give whoever makes the pictures (a designer, a photographer, or an image-generating tool). One row for every picture that is needed: the 62 sections first, then each part (parts that are only
// different sizes of the same thing share one row and one picture). Each row has the file name to save the picture under (the code), the names in three languages, what to show, and a ready-to-use prompt in one common style.
const ExcelJS = require('exceljs');
const { loadCoverage } = require('./coverage');

const TOP_PARTS = 150;           // "priority 2": the parts that already have products, up to this many (the ones most likely to be seen first)
const STYLE = 'Realistic product photo, single object, centered, three-quarter view, soft studio lighting, plain light neutral background (hex EEF2F6), sharp focus, square 1:1, no brand logos, no text, no watermark, no people, no hands.';
const SPEC = [
  ['Size and file', 'Square. The import crops to a square and saves at 512 x 512 pixels, so make them at least 800 x 800. JPG, PNG or WebP.'],
  ['File name', 'The CODE of the row, for example BRK.jpg (a section) or BRK-001.jpg (a part). Capitals or small letters both work.'],
  ['Shared pictures', 'Parts that are only different sizes of one thing share a row ("Applies to"). Save the picture under the FIRST code; the import gives it to all of them.'],
  ['Style', 'One object, three-quarter view, soft studio light, plain light background, no brand, no text. The same look for every picture matters more than detail: they are shown between 40 and 72 pixels wide.'],
  ['Checking', 'Someone who knows car parts should look at every picture before it is imported (an image tool can draw a part with the wrong shape or the wrong number of bolts).'],
  ['Priority', '1 = the sections. 2 = parts that already have products. 3 = the rest. Start with 1, then 2.'],
  ['Importing', 'Admin portal > Categories > Photos: choose the pictures, check the preview, press Import. Undo is available afterwards.'],
];
const sectionPrompt = (s) => `A typical ${s.nameEn} component of a car (the most recognisable single part of the ${s.nameEn} system). ${STYLE}`;
const partPrompt = (p, section, siblings) => `A single ${siblings.length > 1 ? p.subcategoryEn || p.nameEn : p.nameEn}, a car part from the ${section.nameEn} system. ${STYLE}`;

/** The rows of the shot list (also used by the tests). `missingOnly` leaves out everything that already has a real picture. */
async function buildRows(q, { missingOnly = false } = {}) {
  const cov = await loadCoverage(q);
  const sectionOf = new Map(cov.sections.map((s) => [s.id, s]));
  const rows = cov.sections.map((s) => ({ tier: 1, code: s.code, applies: [s.code], type: 'Section', section: s.nameEn, nameEn: s.nameEn, nameAr: s.nameAr, nameZh: s.nameZh, show: `Section "${s.nameEn}": one part that people recognise it by`, prompt: sectionPrompt(s), hasPhoto: s.hasPhoto, products: 0 }));
  const groups = new Map();
  for (const p of cov.parts) { if (!groups.has(p.group)) groups.set(p.group, []); groups.get(p.group).push(p); }
  const ranked = [...groups.values()].map((members) => ({ members, products: members.reduce((n, m) => n + m.products, 0), first: members[0] }))
    .sort((a, b) => b.products - a.products || a.first.sectionOrder - b.first.sectionOrder || String(a.first.code).localeCompare(String(b.first.code)));
  ranked.forEach((g, i) => {
    const p = g.first; const section = sectionOf.get(p.sectionId) || { nameEn: p.sectionCode };
    rows.push({ tier: i < TOP_PARTS && g.products > 0 ? 2 : 3, code: p.code, applies: g.members.map((m) => m.code), type: 'Part', section: section.nameEn, nameEn: g.members.length > 1 ? (p.subcategoryEn || p.nameEn) : p.nameEn, nameAr: p.nameAr, nameZh: p.nameZh,
      show: g.members.length > 1 ? `${p.subcategoryEn || p.nameEn} (the sizes ${g.members.map((m) => m.nameEn).join(', ')} share this picture)` : p.nameEn, prompt: partPrompt(p, section, g.members), hasPhoto: g.members.every((m) => m.hasPhoto), products: g.products });
  });
  return missingOnly ? rows.filter((r) => !r.hasPhoto) : rows;
}
async function buildWorkbook(q, options = {}) {
  const rows = await buildRows(q, options); const wb = new ExcelJS.Workbook(); wb.creator = 'Leap Auto Parts';
  const ws = wb.addWorksheet('Shot list', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [{ header: 'Priority', key: 'tier', width: 9 }, { header: 'File name', key: 'file', width: 18 }, { header: 'Applies to codes', key: 'applies', width: 26 }, { header: 'Type', key: 'type', width: 9 }, { header: 'Section', key: 'section', width: 22 },
    { header: 'Name (English)', key: 'nameEn', width: 30 }, { header: 'Name (Arabic)', key: 'nameAr', width: 30 }, { header: 'Name (Chinese)', key: 'nameZh', width: 24 }, { header: 'What to show', key: 'show', width: 54 }, { header: 'Prompt for an image tool', key: 'prompt', width: 90 },
    { header: 'Has a picture', key: 'has', width: 13 }, { header: 'Active products', key: 'products', width: 15 }];
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow({ tier: r.tier, file: `${r.code}.jpg`, applies: r.applies.join(', '), type: r.type, section: r.section, nameEn: r.nameEn, nameAr: r.nameAr, nameZh: r.nameZh, show: r.show, prompt: r.prompt, has: r.hasPhoto ? 'yes' : 'no', products: r.products });
  const how = wb.addWorksheet('How to use'); how.columns = [{ header: 'Topic', key: 'a', width: 18 }, { header: 'What to know', key: 'b', width: 120 }]; how.getRow(1).font = { bold: true };
  for (const [a, b] of SPEC) how.addRow({ a, b });
  return wb;
}
module.exports = { buildRows, buildWorkbook, TOP_PARTS, STYLE };
