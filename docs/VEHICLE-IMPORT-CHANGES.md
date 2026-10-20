# Vehicle data, stage 2: import from an Excel sheet

Included as whole files in `leap_vehicle_data_stage2.zip`. **Apply `leap_vehicle_data_stage1.zip` first** (this zip builds on it: its `fitment/routes.js`, `auth.js` and `App.jsx` contain stage 1 too). If you have changed those three files since, apply the edits below by hand instead of overwriting.

## Before you start
1. In `services\api` run: `npm install exceljs` (the server reads the Excel file with it; this also adds it to `package.json`).
2. Restart the backend (no new migration: stage 1's migration 106 already has everything).
3. If the backend sits behind a web server or proxy, allow request bodies of at least **60 MB** (for example nginx `client_max_body_size 60m`), because a sheet with 100+ pictures is large (your AITO sheet is 17.6 MB).

## What it does (admin portal > Vehicle Data > "Import from Excel")
- **Download the template** (same layout as your AITO sheet: English block, the picture column, Arabic block, Chinese block, plus a "Read me" sheet).
- **Choose the file and press Check.** Nothing is saved. You see: rows read, new models / years / versions, rows that already exist, pictures found, and the rows that will be saved as "No photo yet"; every row with its result and messages; a "Problems and warnings only" filter; and a downloadable report (.xlsx).
- **Import.** Everything is saved together, or nothing is (and no picture file is left behind). It is recorded in the audit log (`vehicle_import`).
- **Rules:** the brand must already exist (created by hand with its photo): a row of a brand that does not exist blocks the import and the brand is named. Models and years are created (years without a photo). Each row needs Brand, Model, Version and Engine in English, Arabic AND Chinese, a valid Year and Seats that are the SAME in the three blocks, and a picture of at least 400 x 400 px if it has one (a row without a picture is imported and marked "No photo yet"). The same brand or model must be written the same way in every row, and no version may appear twice in a file. Pictures are found by the row of their top-left corner, in the "Vehicle Photo" column. Up to 2000 rows and 60 MB per file.
- **Rows that already exist** (same brand, model, year, version name and engine, ignoring capitals and extra spaces) are **skipped** by default. "Update rows that already exist" brings them up to date (names, engine, seats; a picture in the sheet REPLACES the saved one) and also updates the Arabic/Chinese names of an existing brand or model from the file.

## Server (`services/api/src/modules`)
- NEW `vehicleImport/` : `columns.js`, `parser.js`, `rules.js`, `plan.js`, `template.js`, `routes.js`.
- `fitment/routes.js`: just before `module.exports = router;` add `router.use('/import', require('../vehicleImport/routes'));` (the import checks "admin" and Vehicle Data access itself). Endpoints: `GET /fitment/import/template`, `POST /fitment/import/preview`, `POST /fitment/import/commit` (multipart: the file in the field `file`, and `mode` = `skip` or `update`).

## Admin portal (`apps/admin-dashboard/src`)
- NEW `VehicleImportPanel.jsx`. `auth.js`: `previewVehicleImport`, `commitVehicleImport`, `downloadVehicleImportTemplate`. `App.jsx`: import `VehicleImportPanel`; the tab list of `VehicleDataPage` gains `["import", "Import from Excel"]` after "Brands" and renders `<VehicleImportPanel onSessionExpired={onSessionExpired} onGoToBrands={() => setActiveTab("brands")} />`; the audit action list gains `'vehicle_import'`.
- Tests: NEW `VehicleImportPanel.test.jsx`, `vehicleImportRules.test.js`, `vehicleImport.integration.test.js`, helper `testSheets.js`. The integration test can also run YOUR real sheet: set the environment variable `LEAP_AITO_XLSX` to its path (it is skipped otherwise).
- NOT in the zip: `theme.js` and `src/lib/reorder.js` (stand-ins used only where I tested). Do not copy stand-ins over yours.

## How it was checked, and what was not
Your real AITO sheet through the real server and database and the real admin screens in a browser (13 checks): 135 rows, 112 pictures matched to their rows, 23 rows without a picture, 5 models, 12 years, 135 versions; a second import adds nothing; checking writes nothing. Tests: 13 + 12 + 13 new ones, and every one of the 24 deliberate breaks I tried was caught. **Not run here:** your full backend and the rest of your integration tests (my rebuilt copy lacks parts of your project). Please run your usual `npm test` and integration tests after applying.
