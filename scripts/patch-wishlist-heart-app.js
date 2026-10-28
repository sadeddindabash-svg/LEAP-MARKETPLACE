#!/usr/bin/env node
/**
 * Mobile app: a WISHLIST HEART on every product card (on the photo's corner, at the END side so it flips in Arabic; shown to everyone, a signed-out press opens the sign-in screen) and in the product screen's top bar. It replaces the small
 * heart that was in the card's price row for signed-in buyers only, and the card's own request per card: all hearts read ONE shared list (lib/core/wishlist_state.dart), loaded once.
 * Needs lib/models/wishlist_model.dart, lib/core/wishlist_state.dart and lib/widgets/wishlist_heart.dart from the same package. I cannot run Flutter: please run flutter analyze and flutter test, then try it (see docs/WISHLIST-HEART.md).
 *
 *   node scripts/patch-wishlist-heart-app.js            dry run: says what it would change, writes nothing
 *   node scripts/patch-wishlist-heart-app.js --write    applies it (each changed file is saved as <file>.before-wishlist-heart-app first)
 *
 * A file that is not exactly what the patch expects is NOT changed (the whole patch stops, so nothing is half applied). Windows (CRLF) line endings are handled. Running it twice is harmless ("already").
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const write = process.argv.includes('--write');
const DATA = {"anchored": [{"file": "apps/mobile/lib/widgets/product_card.dart", "what": "the card's heart moves to the photo's corner (for everyone) and uses the shared list: the old per-card request and the signed-in-only heart in the price row are gone", "done": "WishlistHeart", "pairs": [["import '../services/api_client.dart';", "import '../services/api_client.dart';\nimport 'wishlist_heart.dart';"], ["  bool? _isWishlisted; // null while unknown/loading; only checked for logged-in buyers\n  bool _isTogglingWishlist = false;\n", ""], ["  @override\n  void initState() {\n    super.initState();\n    _checkWishlistState();\n  }\n\n  void _checkWishlistState() {\n    final token = context.read<AuthState>().token;\n    if (token == null) return;\n    ApiClient().isWishlisted(token, widget.product.id).then((wishlisted) {\n      if (mounted) setState(() => _isWishlisted = wishlisted);\n    }).catchError((_) {}); // non-critical -- the heart just stays unfilled if this fails\n  }\n\n  Future<void> _toggleWishlist() async {\n    final token = context.read<AuthState>().token;\n    if (token == null) return;\n    setState(() => _isTogglingWishlist = true);\n    try {\n      if (_isWishlisted == true) {\n        await ApiClient().removeFromWishlist(token, widget.product.id);\n        if (mounted) setState(() => _isWishlisted = false);\n      } else {\n        await ApiClient().addToWishlist(token, widget.product.id);\n        if (mounted) setState(() => _isWishlisted = true);\n      }\n    } on ApiException catch (e) {\n      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));\n    } finally {\n      if (mounted) setState(() => _isTogglingWishlist = false);\n    }\n  }\n\n", ""], ["                      if (isLoggedIn) ...[\n                        InkWell(\n                          onTap: _isTogglingWishlist ? null : _toggleWishlist,\n                          borderRadius: BorderRadius.circular(14),\n                          child: Container(\n                            width: 28,\n                            height: 28,\n                            decoration: BoxDecoration(\n                              shape: BoxShape.circle,\n                              border: Border.all(color: LeapColors.line),\n                            ),\n                            child: _isTogglingWishlist\n                                ? const Padding(padding: EdgeInsets.all(6), child: CircularProgressIndicator(strokeWidth: 2))\n                                : Icon(\n                                    _isWishlisted == true ? Icons.favorite : Icons.favorite_border,\n                                    size: 15,\n                                    color: _isWishlisted == true ? LeapColors.signal : LeapColors.muted,\n                                  ),\n                          ),\n                        ),\n                        const SizedBox(width: 6),\n                      ],\n", ""], ["              AspectRatio(\n                aspectRatio: 1,\n                child: ClipRRect(", "              Stack(\n                children: [\n                  AspectRatio(\n                aspectRatio: 1,\n                child: ClipRRect("], ["                ),\n              ),\n              const SizedBox(height: 6),\n              Text(\n                p.name,", "                ),\n              ),\n                  PositionedDirectional(end: 6, bottom: 6, child: WishlistHeart(productId: p.id)),\n                ],\n              ),\n              const SizedBox(height: 6),\n              Text(\n                p.name,"], ["final isLoggedIn = context.watch<AuthState>().isLoggedIn;", "// ignore: unused_local_variable\n    final isLoggedIn = context.watch<AuthState>().isLoggedIn;      // (it used to decide whether the old heart showed; the new heart handles signed-out itself)"]]}, {"file": "apps/mobile/lib/features/catalog/product_screen.dart", "what": "a wishlist heart in the product screen's top bar, before Share", "done": "WishlistHeart", "pairs": [["import '../../widgets/reviews_section.dart';", "import '../../widgets/reviews_section.dart';\nimport '../../widgets/wishlist_heart.dart';"], ["IconButton(icon: const Icon(Icons.share_outlined), onPressed: _shareProduct,", "WishlistHeart(productId: widget.productId, variant: WishlistHeartVariant.appBar),\n          IconButton(icon: const Icon(Icons.share_outlined), onPressed: _shareProduct,"]]}, {"file": "apps/mobile/lib/core/app_strings.dart", "what": "the words of the heart (English and Arabic)", "done": "wishlist_unsave", "pairs": [["    'removed_from_wishlist': {'en': 'Removed from wishlist', 'ar': 'أُزيل من المفضلة'},", "    'removed_from_wishlist': {'en': 'Removed from wishlist', 'ar': 'أُزيل من المفضلة'},\n    'wishlist_save': {'en': 'Save to wishlist', 'ar': 'حفظ في المفضلة'},\n    'wishlist_unsave': {'en': 'Remove from wishlist', 'ar': 'إزالة من المفضلة'},\n    'wishlist_login': {'en': 'Log in to save', 'ar': 'سجّل الدخول للحفظ'},"]]}], "whole": []};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const once = (s, a) => s.split(a).length === 2;

const plan = [];
let problems = 0;
const refuse = (file, why) => { console.log(`REFUSED   ${file}: ${why}`); problems++; };
for (const e of DATA.anchored) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const c = (x) => (s.includes('\r\n') ? x.replace(/\r?\n/g, '\r\n') : x);
  if (s.includes(c(e.done))) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  let out = s;
  for (const [a0, b0] of e.pairs) { const a = c(a0), b = c(b0); if (!once(out, a)) { out = null; break; } out = out.replace(a, () => b); }
  if (out === null) { refuse(e.file, 'its text is not what this patch expects, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: out });
}
for (const e of DATA.whole) {
  const p = path.join(root, e.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${e.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'wishlist-heart-app-files', e.file), 'utf8');
  if (s === fresh) { console.log(`already   ${e.file}: ${e.what}`); continue; }
  if (sha(s) !== e.sha) { refuse(e.file, 'this file is not the one the new version was made from (it was changed on your side), so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: e.file, what: e.what, before: s, after: fresh });
}
for (const t of (DATA.tests || [])) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) { console.log(`MISSING   ${t.file}: not found. Run this from the project root.`); problems++; continue; }
  const s = fs.readFileSync(p, 'utf8');
  const fresh = fs.readFileSync(path.join(__dirname, 'wishlist-heart-app-files', t.file), 'utf8');
  if (s === fresh) { console.log(`already   ${t.file}: ${t.what}`); continue; }
  if (sha(s) !== t.sha) { refuse(t.file, 'this test file is not the one the new version was made from, so nothing was changed. Send this file to the Leap team.'); continue; }
  plan.push({ file: t.file, what: t.what, before: s, after: fresh });
}
if (problems > 0) { console.log('\nNothing was changed, because of the problem(s) above.'); process.exit(1); }
for (const c of plan) {
  if (write) { const p = path.join(root, c.file); fs.writeFileSync(`${p}.before-wishlist-heart-app`, c.before); fs.writeFileSync(p, c.after); console.log(`patched   ${c.file}: ${c.what}`); }
  else console.log(`would     ${c.file}: ${c.what}`);
}
if (!write && plan.length) console.log('\nDry run only. Add --write to apply.');
