# Garage limit: up to 5 saved cars (the exact edits)

Included as whole files in `leap_garage_limit.zip`. **If you have changed any of these files since the project was last shared, do not overwrite them: apply the edits below by hand instead.**

## Server: `services/api/src/modules/garage/routes.js`
1. After `const { requireAuth } = require('../auth/middleware');` add:
   ```js
   const MAX_GARAGE_VEHICLES = 5;
   const GARAGE_FULL_MESSAGE = 'You can save up to 5 vehicles. Remove one to add another.';
   ```
   (the message must stay word for word: the app and the website translate it by matching this exact text)
2. In `router.post('/me', ...)`, replace the part from the comment "Real, reasonable default (new) ..." through the `INSERT INTO user_saved_generations ... ON CONFLICT DO NOTHING` query with ONE transaction on a pooled client: `BEGIN`; `SELECT pg_advisory_xact_lock(hashtext('garage:' + buyer id))`; read the buyer's saved (generation_id, year) rows; if the car being added is not already among them and they already have `MAX_GARAGE_VEHICLES` or more, `ROLLBACK` and `res.status(400).json({ error: GARAGE_FULL_MESSAGE })`; otherwise insert (the first car becomes the default) and `COMMIT`; always `ROLLBACK` on error and `release()` the client.
3. At the end of the file, after `module.exports = router;`, add `module.exports.MAX_GARAGE_VEHICLES = MAX_GARAGE_VEHICLES;` and `module.exports.GARAGE_FULL_MESSAGE = GARAGE_FULL_MESSAGE;`.
4. **Restart the backend.**

## Mobile app (NOT compiled or run where this was made: run `flutter analyze` and `flutter test`)
- `apps/mobile/lib/core/server_messages.dart`: add, immediately BEFORE the `'Saved vehicle not found'` entry:
  `'You can save up to 5 vehicles. Remove one to add another.': 'يمكنك حفظ 5 مركبات كحد أقصى. احذف إحداها لإضافة مركبة أخرى.',`
  (the website's list in `lib/serverMessages.ts` must be identical, in the same order: a test compares them)
- `apps/mobile/lib/core/app_strings.dart`: add after the `'add_a_vehicle'` entry:
  `'garage_limit_note': {'en': 'You can save up to 5 vehicles. Remove one to add another.', 'ar': 'يمكنك حفظ 5 مركبات كحد أقصى. احذف إحداها لإضافة مركبة أخرى.'},`
- `apps/mobile/lib/features/garage/garage_screen.dart`:
  1. before the long `/// BUY-004, BUY-010–012: ...` comment add `const int kMaxGarageVehicles = 5;`
  2. in `_GarageScreenState`, before `_addVehicle`, add `bool get _isFull => (_vehicles?.length ?? 0) >= kMaxGarageVehicles;` and, as the first lines of `_addVehicle`, `if (_isFull) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(tr(context, 'garage_limit_note')))); return; }`
  3. on the `OutlinedButton.icon(onPressed: _addVehicle, ...)` add `style: _isFull ? OutlinedButton.styleFrom(foregroundColor: Theme.of(context).disabledColor) : null,`
  4. in the final `Scaffold`'s `AppBar` add `actions: [ if (_vehicles != null && _vehicles!.isNotEmpty) Padding(padding: const EdgeInsetsDirectional.only(end: 16), child: Center(child: Text('${_vehicles!.length} / $kMaxGarageVehicles'))) ]`

## Website (`apps/web-storefront`)
`lib/garage.ts`, `lib/i18n.ts`, `lib/serverMessages.ts`, `app/garage/page.tsx`, `components/FindTools.tsx` and their tests, plus README.md. These are whole files from the same tested copy as the earlier zips.
