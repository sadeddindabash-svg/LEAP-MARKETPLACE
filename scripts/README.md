# Start / stop scripts (Windows)

One command to bring Leap up for local development, and one to take it down.

| | |
|---|---|
| `scripts\start-leap.cmd` | **Double-click** to start everything (it keeps its window open at the end so you can read it) |
| `scripts\stop-leap.cmd` | Double-click to stop everything |
| `scripts\start-leap.ps1` | The same thing from PowerShell: `powershell -ExecutionPolicy Bypass -File scripts\start-leap.ps1` |
| `scripts\stop-leap.ps1` | `powershell -ExecutionPolicy Bypass -File scripts\stop-leap.ps1` |

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

## What was tested (and what was not)

Run for real under PowerShell 7.4, with a stand-in for the one Windows-only command (`Get-NetTCPConnection`): the full start (all four servers answer); the stop (all four ports freed); a port held by a **non-node** program (refused, the program left running); the database being **down** (clear message, nothing started); a **failing migration** (real error shown, nothing started, nothing recorded); a folder whose name has a **space and an apostrophe**; start-up repeated while everything is already running. All three scripts parse with PowerShell's own parser, are plain ASCII, and avoid PowerShell-7-only syntax.

**Not tested:** on **Windows PowerShell 5.1** itself (what a Windows PC runs), the real Windows port and service commands, and the separate windows: none exist in the sandbox. The one known difference (5.1 treats program output on stderr as an error) is handled in the migration step. If anything misbehaves, tell me what the window printed.

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
