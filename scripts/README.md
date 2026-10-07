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
