# The car of each order line, shown to the supplier

**What it does:** when a buyer places an order, the server reads the buyer's **My Garage** and records, for each order line, which car the part is for. The supplier portal then shows it on the Orders page (a small photo and the car in the list; the photo, car, version, engine, seats and a fit check under each item in the order detail), so the supplier is sure which part to send to the hub. **The buyer does nothing new**: no new question, no change on the website or in the mobile app.

## Which car (per order line)
* The product is made for specific cars (it has a fitment list): the buyer's **default** garage car if the product fits it; else another garage car it does fit; if it fits none, the default car is shown with the warning *"Not in this product's fitment list: please check before sending"*.
* The product fits any car (no fitment list): no car is recorded ("Fits any car").
* A guest, or a buyer with no car in My Garage: "No car on file".
* "Fits" means the car's model is on the product's fitment list **and the car's year is too** (a fit-list row always names a year). This matches the website's search by car. It is stricter than the "Confirmed fit" badge, which looks at the model only.
* Engine and transmission are not compared (a garage car's engine is free text): the supplier sees the engine and seats and compares them by eye.

## Safety
* The car is a **snapshot** taken when the order is placed (names, engine, seats): later changes to the vehicle data or the garage never change what the supplier was told. The photo is looked up live (version, else year, else model, else brand), so a replaced photo never leaves a broken link.
* Recording the car **can never stop an order**: it runs in a database savepoint; if anything goes wrong it is undone and logged, and the order goes through without a car.
* A supplier only ever receives the cars of the lines of **their own** sub-orders.
* Orders placed before this existed show no car (a dash); there is no backfill.

## Replacement orders
When an admin confirms a **replacement** for a faulty part, the replacement order is for the same car as the part it replaces, so the supplier who must send it sees that car too. The car is **copied from the original order line** (matched by product), not worked out again from the buyer's garage today, and it can never stop a replacement (it runs in a savepoint). A replacement of a part from an order placed before this existed has no car.

## Apply (from the project root)
1. Unzip over the project folder (it only adds files).
2. Patch the four existing files (dry run first). If you applied an earlier version of this change, run it again: the files already done say "already" and only the new one is patched:
   ```
   node scripts\patch-order-vehicles.js
   node scripts\patch-order-vehicles.js --write
   ```
   Each file is saved as `<file>.before-order-vehicles`. If a line says `REFUSED`, nothing was changed: send me that message.
3. Update the database (adds one table; safe to run twice):
   ```
   cd services\api
   npm run migrate
   ```
4. Restart the backend and the supplier portal (`.\scripts\start-leap.cmd` from the project root starts everything).

## Check it yourself in 3 steps
1. Sign in to the website as a buyer who has a car in **My Garage** (set as default) and place an order for a product whose fitment list includes that car.
2. Sign in to the **supplier portal** as that product's supplier: **Orders** now has a **Car** column showing that car, and opening the order shows the photo, the car, the version, engine and seats, and "Listed as fitting this car".
3. Place a second order with a product that does **not** list the car: the supplier sees the warning "Not in this product's fitment list: please check before sending".

## Tests
* API (18 tests: a real order through the real `POST /orders`, a real fault case through the real `confirmReplacement`, the real supplier endpoint, the real database): use a test database whose name ends in `_test` with migration 110 applied, then `set DATABASE_URL=...` and `node --test test/orderVehicles.test.js test/orderVehiclesReplacement.test.js` in `services\api`. They assume the standard seed (`supplier@leap.dev`, supplier `s1`, hub `hub_guangzhou`).
* Supplier portal (16 tests): `npx vitest run src/OrderVehicle.test.jsx src/OrderVehicleFlow.test.jsx` in `apps\supplier-portal`.

## What was and was not checked
Checked: the tests above; 15 deliberate breaks of the server code and 8 of the screens were each caught; the patch script turns your original files into exactly the patched ones; a real browser read five real orders in the supplier portal in Chinese and English, with the photos loading and no errors.
Not checked: the whole server was never started (the working copy used for the build lacked some of your files), so the real `POST /orders` and supplier endpoint ran with tiny stand-ins for four unrelated missing files; please do the 3-step check above on your machine. The portal's table and card styling in the screenshots came from a stand-in for your UI kit, so judge the final look on your own portal. The mobile app, the admin Orders page and the hub portal do not show the car yet.
