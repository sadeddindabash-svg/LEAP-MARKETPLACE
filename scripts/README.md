# Start / stop scripts (Windows)

One command to bring Leap up for local development, and one to take it down.

| | |
|---|---|
| `scripts\start-leap.cmd` | **Double-click** to start everything (it keeps its window open at the end so you can read it) |
| `scripts\stop-leap.cmd` | Double-click to stop everything |
| `scripts\start-leap.ps1` | The same thing from PowerShell: `powershell -ExecutionPolicy Bypass -File scripts\start-leap.ps1` |
| `scripts\stop-leap.ps1` | `powershell -ExecutionPolicy Bypass -File scripts\stop-leap.ps1` |
| `scripts\check-mobile.cmd` | Double-click to check the mobile app: `flutter pub get`, `flutter analyze`, `flutter test`, with a clear PASSED / FAILED (needs Flutter installed). See "Checking the mobile app" below |
| `scripts\run-backend.ps1` | Used by `start-leap` inside the backend window: shows what the backend prints AND saves it in `logs\backend.log`. You do not run it yourself |
| `scripts\make-arabic-review.js`, `scripts\apply-arabic-review.js` | The Arabic review: build the workbook for a native speaker, then apply the corrections. See "The Arabic review" below |

`-ExecutionPolicy Bypass` is needed because Windows blocks scripts by default; the `.cmd` files add it for you. The scripts work out where the project is from **their own location**, so there is no folder to edit.

## What `start-leap` does, in order

1. Checks `node` and `npm` exist, and runs `npm install` for any folder whose `node_modules` is missing.
2. Checks the **database** answers (the host and port are read from `services\api\.env`, so the port 5414 on your PC is respected). If not, it tries to start the Windows PostgreSQL service; if that needs Administrator rights it tells you the exact `net start` command and stops.
3. Stops any **old** Leap server still on ports 4000 / 5173 / 5174 / 5175. It only ever stops **node** processes; if something else owns a port it leaves it alone, tells you what it is, and stops.
4. Applies the database **migrations**. If one fails it shows the real error, **starts nothing**, and exits. (This is the step that prevents "the new code is running against an old database".) Only migrations actually applied are listed, with a count of those already done.
5. Starts the **backend** in its own window and waits until `/health` answers; warns if the backend reports a pending migration.
6. Starts the **admin, supplier and hub portals**, each in its own window, with `--force` (a stale development cache can never show an old page) and `--strictPort` (a portal never silently moves to another port, so the address printed here is always the right one), and waits until each answers.

It finishes by printing the addresses. **It is safe to run again at any time**, in particular right after extracting a patch zip.

Options: `-Only backend` / `-Only admin,hub` (start just those), `-SkipMigrate` (not recommended), `-Open` (open the admin portal in your browser).

## When the backend does not start (logs and self-repair)
`start-leap` now saves everything it prints about a run in **`logs\start-leap.log`** and everything the backend prints in **`logs\backend.log`** (the `logs` folder is created for you), so there is always something to send even when a window closes.
- If the backend does not answer, `start-leap` shows **the last lines the backend printed, right in its own window**, and names the likely cause in plain words: a missing package, the port already in use, the database refusing or not answering, or a migration that has not been run. A crash it recognises is noticed in about a second instead of after 40.
- **A missing package is repaired by itself:** if the cause is a missing package that the backend is known to need (`exceljs`, `jszip`, or anything listed in `services\api\package.json`), it runs `npm install` for that one package and starts the backend once more. A package that is NOT listed is never installed behind your back: it is named, and you decide.
- Before starting, it also checks that `exceljs` and `jszip` (needed by the Excel import of vehicle data) are installed, and installs them if they are not.
- Test of these decisions: `powershell -ExecutionPolicy Bypass -File scripts\test-start-helpers.ps1` (exit code 0 = all passed).

## Checking the mobile app (`check-mobile.cmd`)
Runs `flutter pub get`, `flutter analyze` and `flutter test` inside `apps\mobile` and says in plain words whether the app is fine: **errors** from analyze and failing tests make it FAIL, warnings and hints are shown but do not. Everything Flutter printed is saved in `logs\mobile-check.log`. `-SkipTests` only analyzes. If it reports errors in `add_vehicle_screen.dart`: that is an old screen nothing uses any more (it calls functions that no longer exist); delete it (`del apps\mobile\lib\features\garage\add_vehicle_screen.dart`) and run the check again.

## The Arabic review
1. `node scripts\make-arabic-review.js` builds **`Leap_Arabic_Review.xlsx`** from the CURRENT texts (website, server messages, app): texts written for the website or added since the last review are on the sheets to review (new ones first, highlighted), a glossary of the repeated words, the automatic checks, and a **wording consistency** check (for example how many texts say سيارة and how many مركبة). Needs `exceljs` (`npm install exceljs jszip` in `services\api`).
2. A native speaker fills **Approved?** (Yes / No / Unsure) and, for No, **Corrected Arabic**.
3. `node scripts\apply-arabic-review.js Leap_Arabic_Review.xlsx` shows what it WOULD change (a dry run). Add `--write` to apply. It changes only the corrected texts (website `i18n.ts`; server messages in BOTH `serverMessages.ts` and `server_messages.dart`, so the two stay identical; `app_strings.dart`), **refuses** a correction whose `{placeholders}` differ from the English text or that has no Arabic letters, reports Yes-with-a-correction as a conflict, lists Unsure rows without applying them, and compares with what is really in the code (so applying the same file twice is harmless).
4. Then run the website tests (`npm test` in `apps\web-storefront`) and `node scripts\make-arabic-review.js --update-baseline` to mark the texts as reviewed.
Tests of both tools: `node --test scripts\arabic-review.test.js`.

## What was tested (and what was not)

Run for real under PowerShell 7.4, with a stand-in for the one Windows-only command (`Get-NetTCPConnection`): the full start (all four servers answer); the stop (all four ports freed); a port held by a **non-node** program (refused, the program left running); the database being **down** (clear message, nothing started); a **failing migration** (real error shown, nothing started, nothing recorded); a folder whose name has a **space and an apostrophe**; start-up repeated while everything is already running. All three scripts parse with PowerShell's own parser, are plain ASCII, and avoid PowerShell-7-only syntax.

**The log, hint and self-repair part of `start-leap`** (and `check-mobile`) was run for real under PowerShell 7.4 on Linux with a stand-in backend and a stand-in `flutter`: a healthy start, a missing package that is listed (installed, backend started on the second try), a missing package that is not listed (not installed), a refused database, an unrecognised crash, and the installation of absent packages before the start. **Not run on Windows PowerShell 5.1**, so if its window shows something odd, send `logs\start-leap.log`.

**Not tested:** on **Windows PowerShell 5.1** itself (what a Windows PC runs), the real Windows port and service commands, and the separate windows: none exist in the sandbox. The one known difference (5.1 treats program output on stderr as an error) is handled in the migration step. If anything misbehaves, tell me what the window printed.

## You can sign in, but nothing loads (`check-data-loading.cmd`)

Double-click **`scripts\check-data-loading.cmd`** (or run `scripts\check-data-loading.ps1`). It only reads. It signs in as an admin, a supplier and a hub worker (the seeded accounts; if you changed a password pass it: `-AdminPassword`, `-SupplierPassword`, `-HubPassword`) and calls the first things each portal and app loads, printing for every call whether it worked, **how long it took** and **how many items came back**. Then it says what that means:
- **A call FAILED (HTTP 500 etc.)** -> the error is printed in the backend window at that moment: send me it together with this output.
- **A call is SLOW** (4 s or more; `-SlowMs` changes that) -> usually the pile of test data (thousands of orders and hubs make the lists huge; a phone gives up after 30 seconds). Preview the clean-up with `node scripts\remove-test-data.js`.
- **A list is genuinely EMPTY** -> the database has no such data (for example after the test-data clean-up).
- **Everything worked and was fast** -> the problem is on the portal or app side (browser F12 > Network tab).
`/health` now also says when the **database itself cannot be reached** (`status: database_unreachable`, HTTP 503, with the reason): before, a stopped database was reported as "every migration pending", which sent you to the wrong fix.

## The phone says "no internet connection" or "took too long" (`check-phone-connection.cmd`)

Double-click **`scripts\check-phone-connection.cmd`** (or run `scripts\check-phone-connection.ps1`). It changes nothing and tells you which of these it is, and what to do:
1. **The backend is not running** (the usual cause: its window was closed, `stop-leap.cmd` was run, or the PC restarted) -> run `start-leap.cmd`.
2. **The PC's address changed** since the app was built (the address is built into the app: `--dart-define=API_BASE_URL=http://<address>:4000`) -> it prints the new address and the rebuild command. `-AppAddress <address>` tells it which address the app was built with (default `192.168.0.210`).
3. **The backend only listens on this PC itself** -> restart it with `start-leap.cmd`.
4. **Windows Firewall / a "Public" Wi-Fi blocks the phone** -> run it again from **PowerShell as Administrator** with **`-FixFirewall`**: it opens port 4000 and sets the Wi-Fi to Private.
If everything on the PC is fine it prints the exact address to open in the **phone's** browser (`http://<address>:4000/health`) and, if even that does not load (some routers stop devices talking to each other), the USB route (`adb reverse tcp:4000 tcp:4000` and a build with `API_BASE_URL=http://localhost:4000`).
**Tested** with five simulated situations (everything fine, backend off, address changed, listening only on the PC, Public network with no firewall rule, and `-FixFirewall` without administrator rights), using stand-ins for the Windows-only network commands: the real Windows commands themselves were not run here.

## Running the tests safely (`run-tests.cmd`)

**Never run the test suites against the database your app uses**: they create hundreds of categories, parts, products, accounts and orders and leave them behind (your phone app then shows them). Use this instead:

| | |
|---|---|
| `scripts\run-tests.cmd` | **Double-click** to run every suite on a throwaway database (the window stays open at the end) |
| `scripts\run-tests.ps1` | The same from PowerShell: `powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1`. Options: `-Suites admin,supplier,hub` (default all three) and `-Filter payouts` (only test files whose name contains that text) |

What it does, in order:
1. **Prepares a separate test database**, `leap_marketplace_test` (named after yours: `..._dev` becomes `..._test`): creates it if needed, **wipes it**, applies every migration and loads the seed data. It can only ever wipe a database whose name **ends in `_test`**; yours can never be touched by it.
2. **Pauses your normal backend** and starts a hidden one that uses the test database (the tests expect it on port 4000).
3. **Runs the suites** (about 8 minutes for all three).
4. **Always** stops the test backend and **starts your normal backend again**, even if a test fails or you press Ctrl+C.

While it runs, **your app cannot reach the backend**. It never touches your real database. If something that is not Leap's backend is using port 4000, it refuses to start and changes nothing.

**One-time step (only if asked):** if your database user is not allowed to create databases, the first run stops and prints one line to run as the PostgreSQL administrator, like:
`& "C:\Program Files\PostgreSQL\14\bin\psql.exe" -h localhost -p 5434 -U postgres -c "CREATE DATABASE leap_marketplace_test OWNER leap_dev"` (it asks for the administrator password you chose when installing PostgreSQL). Run it once, then run the tests again.

**What was tested (PowerShell 7 with a stand-in for Windows' port command, not Windows PowerShell itself):** a normal run (the real database's counts before and after were identical, the test data landed in the test database, the normal backend came back); a run with a deliberately failing test (reported as failed, exit code 1, normal backend still restored); something that is not Leap on port 4000 (refused, left running, nothing changed); the first run with no test database, both when the user may create it and when the one-time step is needed; a filter that matches no file in a suite (not counted as a failure).

## Testing email on your own PC with Mailpit (no provider needed)

Mailpit is a free fake mail server with an inbox in your browser: nothing leaves your PC. Download `mailpit-windows-amd64.zip` from <https://github.com/axllent/mailpit/releases>, unzip it, and in its folder run (leave the window open):

```powershell
.\mailpit.exe --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025 --smtp-auth-accept-any --smtp-auth-allow-insecure
```

Add these to `services\api\.env`, then restart the backend (`stop-leap.cmd`, `start-leap.cmd`):

```
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_USER=dev
SMTP_PASSWORD=dev
SMTP_FROM_EMAIL=noreply@leap.test
SMTP_FROM_NAME=Leap Auto Parts
```

Open <http://localhost:8025> to see every email. `Invoke-RestMethod http://localhost:4000/health` should show `email: configured: True`, and `node scripts/send-test-email.js you@example.com ar` sends a test in Arabic. To make the reset button open from a **phone** on your Wi-Fi, also set `PUBLIC_API_URL=http://<your PC's address>:4000`. Delete the SMTP lines to go back to printing emails in the backend window.
