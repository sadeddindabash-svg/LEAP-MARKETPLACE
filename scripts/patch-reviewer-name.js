#!/usr/bin/env node
/**
 * Reviews: the reviewer's name is hidden on the product page, in the mobile app and on the website ("michael" -> "MI***el";
 * 4 letters or fewer -> "A***"; spaces ignored; Arabic too). The admin portal still sees full names (moderation needs them).
 *
 *   node scripts/patch-reviewer-name.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-reviewer-name.js --write    applies it (each changed file is saved as <file>.before-reviewer-name first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied).
 * Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored":[{"file":"apps/mobile/lib/widgets/reviews_section.dart","what":"the app's reviews show the hidden name (MI***el), not the full name","done":"Text(maskReviewerName(r.buyerName) ??","pairs":[["import '../models/review.dart';\n","import '../models/review.dart';\nimport '../core/reviewer_name.dart';\n"],["Text(r.buyerName ?? (widget.isAr","Text(maskReviewerName(r.buyerName) ?? (widget.isAr"]]},{"file":"apps/web-storefront/lib/review.ts","what":"the website's rule for hiding a reviewer's name","done":"export function maskReviewerName(","pairs":[["export const wholeStars = (average: number | null): number => (average == null ? 0 : Math.round(average));\n","export const wholeStars = (average: number | null): number => (average == null ? 0 : Math.round(average));\n\n/** A reviewer's name as other buyers see it: the first 2 letters in capitals, ***, the last 2 (\"michael\" -> \"MI***el\"). 4 letters or fewer: the first and *** (\"Ali\" -> \"A***\"). Spaces are ignored. Empty -> null (the page shows \"Buyer\"). */\nexport function maskReviewerName(name: string | null | undefined): string | null {\n  if (!name) return null;\n  const chars = Array.from(name.replace(/\\s+/g, \"\"));\n  if (chars.length === 0) return null;\n  if (chars.length <= 4) return `${chars[0].toUpperCase()}***`;\n  return `${chars[0]}${chars[1]}`.toUpperCase() + \"***\" + chars.slice(-2).join(\"\");\n}\n"]]},{"file":"apps/web-storefront/components/ReviewsSection.tsx","what":"the website's reviews show the hidden name (MI***el), not the full name","done":"{maskReviewerName(r.buyerName) || t(\"buyer\")}","pairs":[["import { MAX_REVIEW_PHOTOS, REVIEW_BATCH, canAddPhoto, myReviewOf, reviewErrorKey, reviewState, wholeStars } from \"@/lib/review\";","import { MAX_REVIEW_PHOTOS, REVIEW_BATCH, canAddPhoto, maskReviewerName, myReviewOf, reviewErrorKey, reviewState, wholeStars } from \"@/lib/review\";"],["{r.buyerName || t(\"buyer\")}","{maskReviewerName(r.buyerName) || t(\"buyer\")}"]]}],"created":[{"file":"apps/mobile/lib/core/reviewer_name.dart","what":"the app's rule for hiding a reviewer's name","text":"/// A reviewer's name as other buyers see it, the same rule as the website: the first 2 letters in capitals, ***, the last 2\n/// (\"michael\" -> \"MI***el\"). 4 letters or fewer: the first and *** (\"Ali\" -> \"A***\"). Spaces are ignored. Empty -> null (the screen shows \"Buyer\").\nString? maskReviewerName(String? name) {\n  if (name == null) return null;\n  final chars = name.replaceAll(RegExp(r'\\s+'), '').runes.map(String.fromCharCode).toList();\n  if (chars.isEmpty) return null;\n  if (chars.length <= 4) return '${chars.first.toUpperCase()}***';\n  return '${chars[0].toUpperCase()}${chars[1].toUpperCase()}***${chars[chars.length - 2]}${chars[chars.length - 1]}';\n}\n"},{"file":"apps/mobile/test/reviewer_name_test.dart","what":"the app's tests of the hidden name","text":"import 'dart:io';\nimport 'package:flutter_test/flutter_test.dart';\nimport '../lib/core/reviewer_name.dart';\n\n// A reviewer's name is hidden on the product screen (the same rule as the website).\nvoid main() {\n  test('the first 2 letters in capitals, ***, and the last 2', () {\n    expect(maskReviewerName('micheal'), 'MI***al');\n    expect(maskReviewerName('michael'), 'MI***el');\n    expect(maskReviewerName('Sarah'), 'SA***ah');\n  });\n  test('a full name is treated as one (spaces ignored)', () {\n    expect(maskReviewerName('Mohammed Alharbi'), 'MO***bi');\n    expect(maskReviewerName('  Ahmed  Ali '), 'AH***li');\n  });\n  test('a short name (4 letters or fewer) is hidden almost completely', () {\n    expect(maskReviewerName('Ali'), 'A***');\n    expect(maskReviewerName('omar'), 'O***');\n  });\n  test('Arabic names', () {\n    expect(maskReviewerName('محمد العتيبي'), 'مح***بي');\n    expect(maskReviewerName('علي'), 'ع***');\n  });\n  test('no name -> null, so the screen shows \"Buyer\"', () {\n    expect(maskReviewerName(null), isNull);\n    expect(maskReviewerName(''), isNull);\n    expect(maskReviewerName('   '), isNull);\n  });\n  test('the reviews list shows the hidden name, never the full one', () {\n    final src = File('lib/widgets/reviews_section.dart').readAsStringSync();\n    expect(src.contains(\"import '../core/reviewer_name.dart';\"), isTrue);\n    expect(src.contains('Text(maskReviewerName(r.buyerName) ??'), isTrue);\n    expect(src.contains('Text(r.buyerName ??'), isFalse);\n  });\n}\n"},{"file":"apps/web-storefront/lib/reviewer-name.test.ts","what":"the website's tests of the hidden name","text":"import { describe, expect, it } from \"vitest\";\nimport { maskReviewerName } from \"./review\";\n\ndescribe(\"maskReviewerName: a reviewer's name is hidden on the product page\", () => {\n  it(\"shows the first 2 letters in capitals, ***, and the last 2\", () => {\n    expect(maskReviewerName(\"micheal\")).toBe(\"MI***al\");\n    expect(maskReviewerName(\"michael\")).toBe(\"MI***el\");\n    expect(maskReviewerName(\"Sarah\")).toBe(\"SA***ah\");\n  });\n  it(\"treats a full name as one (spaces ignored)\", () => {\n    expect(maskReviewerName(\"Mohammed Alharbi\")).toBe(\"MO***bi\");\n    expect(maskReviewerName(\"  Ahmed  Ali \")).toBe(\"AH***li\");\n  });\n  it(\"hides a short name (4 letters or fewer) almost completely\", () => {\n    expect(maskReviewerName(\"Ali\")).toBe(\"A***\");\n    expect(maskReviewerName(\"omar\")).toBe(\"O***\");\n    expect(maskReviewerName(\"x\")).toBe(\"X***\");\n  });\n  it(\"works for Arabic names\", () => {\n    expect(maskReviewerName(\"محمد العتيبي\")).toBe(\"مح***بي\");\n    expect(maskReviewerName(\"علي\")).toBe(\"ع***\");\n  });\n  it(\"no name -> null, so the page shows 'Buyer'\", () => {\n    expect(maskReviewerName(null)).toBeNull();\n    expect(maskReviewerName(undefined)).toBeNull();\n    expect(maskReviewerName(\"\")).toBeNull();\n    expect(maskReviewerName(\"   \")).toBeNull();\n  });\n});\n"}]};
const once = (s, a) => s.split(a).length === 2;
const plan = [];
let problems = 0;
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { console.log(`REFUSED   ${e.file}: its text is not what this patch expects, so nothing was changed. Send this file.`); problems++; continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.created) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(path.dirname(p))) { console.log(`MISSING   ${path.dirname(e.file)}: folder not found. Run this from D:\\LEAP-MARKETPLACE.`); problems++; continue; }
  if (fs.existsSync(p)) {
    const s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    if (s === e.text) { console.log(`already   ${e.file}: ${e.what}`); continue; }
    console.log(`REFUSED   ${e.file}: a different file with this name is already there, so nothing was changed. Send this file.`); problems++; continue;
  }
  plan.push({ file: e.file, what: e.what, before: null, after: e.text });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) {
    const p = path.join(root, c.file);
    if (c.before !== null) fs.writeFileSync(`${p}.before-reviewer-name`, c.before);
    fs.writeFileSync(p, c.after);
    console.log(`${c.before === null ? 'created ' : 'patched '}  ${c.file}: ${c.what}`);
  } else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
if (write && plan.length) console.log('\nDone. App: press R in the start-all window (or run start-all again). Website: Ctrl+F5.');
