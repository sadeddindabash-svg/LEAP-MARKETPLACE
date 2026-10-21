# Vehicle versions: seats are part of "the same version"

**The problem:** a 5-seat and a 7-seat version of the same brand, model, year, version name and engine are two different vehicles, but the vehicle import (and the database) treated the second one as a duplicate (a "Problem" row: "This is the same version as row N").

**The fix:** a version is "the same" only when its **seats** are the same too. Changed in four places (all by this fix): the import's duplicate check, how the import finds an existing version, the database rule (migration 109), and the message when a version added or edited by hand already exists.

## Apply (from the project root)
1. Unzip over the project folder (it only adds files).
2. Patch the four existing files (dry run first):
   ```
   node scripts\patch-vehicle-seats.js
   node scripts\patch-vehicle-seats.js --write
   ```
   Each file is saved next to itself as `<file>.before-vehicle-seats`. If a line says `REFUSED`, nothing was changed: send me that message.
3. Update the database (safe to run twice; it only relaxes the old rule, so all existing data still fits):
   ```
   cd services\api
   npm run migrate
   ```
4. Restart the backend and check the file again in **Vehicle Data > Import from Excel**.

## What you will see
* Rows that differ only by seats (for example BJ60, 2022, May Day, 5 and 7 seats) are both **New**.
* A real duplicate (same brand, model, year, version, engine **and seats**) is still a Problem: "This is the same version as row N (same brand, model, year, version name, engine and seats)".
* Added by hand (Vehicle Data > Versions): the same name and engine with different seats is now accepted.
* Buyers tell such versions apart in the website and the app by their seats (the version list shows name, engine and seats).
* Importing a file again changes nothing, and "Update" refreshes each version separately: the 7-seat row never overwrites the 5-seat version.

## Tests
* `apps/admin-dashboard/src/vehicleVersionSeats.test.js` (4 tests): `npx vitest run src/vehicleVersionSeats.test.js` in `apps\admin-dashboard`.
* `services/api/test/vehicleVersionSeats.test.js` (4 tests, real importer and database): create or prepare a test database whose name ends in `_test` with migration 109 applied, then `set DATABASE_URL=...` and `node --test test/vehicleVersionSeats.test.js` in `services\api`.

## What was and was not checked
Checked: the new tests failed before the fix and pass after; each of 4 deliberate breaks (rules ignoring seats, the plan matching without seats in two ways, the database keeping the old rule) is caught; the patch script turns the original files into exactly the patched ones; the BJ60 rows from your file all pass; the existing vehicle rule tests still pass.
Not run here: your existing vehicle *integration* tests (they need the real backend). I read them: the one about adding the same version twice uses the same seats both times, so it is still correct, and its message check still matches the new message.
