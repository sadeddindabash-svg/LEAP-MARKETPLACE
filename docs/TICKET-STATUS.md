# Support tickets: the Status only moves forward

## What changed
* **Admin portal, Support > a ticket > Status card.** The current step is highlighted. Only LATER steps can be pressed:
  * **Open:** In progress and Resolved can be pressed (a step may be skipped).
  * **In progress:** Open is greyed out (dashed, with a note); Resolved can be pressed.
  * **Resolved:** nothing can be pressed: it is final.
* **Pressing Resolved asks first:** "Resolved can't be undone. Mark this ticket as resolved?" with **Yes, resolve** and **Cancel**. In progress moves at once.
* **The server enforces it too** (`PATCH /support/tickets/:id`): a backward change answers **409** and changes nothing, in one atomic statement, so two admins pressing at the same moment can't undo each other. The same status again is a harmless no-op. An admin reply on an Open ticket still moves it to In progress (forward), and never moves a Resolved ticket back.
* A buyer's new message about the same order after a ticket is Resolved opens a new ticket (as the site already does).

## Apply (from D:\LEAP-MARKETPLACE: type `cd D:\LEAP-MARKETPLACE` first)
```
Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_ticket_status.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
node scripts\patch-ticket-status.js
node scripts\patch-ticket-status.js --write
```
Then restart the backend and the admin portal (`.\scripts\start-all.cmd -NoPhone -NoStorefront`) and reload the admin page (Ctrl+F5). No migration. The patch changes `services\api\src\modules\support\routes.js` and `apps\admin-dashboard\src\App.jsx` (each saved as `<file>.before-ticket-status`), says "already" if run twice, and changes NOTHING if a line it needs is not exactly as expected (it names the file; send it to me).

## What to look at
Open a ticket: Status card as above. Press Resolved: the question appears; Cancel changes nothing; Yes, resolve makes every button grey. Try the same ticket in two browser tabs: the second tab's old button is refused with a clear message.

## Tests
Server (needs the database): `cd services\api` then `node --test test\supportStatus.test.js` (8 tests). Admin portal: `cd apps\admin-dashboard` then `npx vitest run src\TicketStatusFlow.test.jsx src\TicketsFlow.test.jsx`.
`scripts/break-check-order-vehicles.py tsserver | tsadmin` break the code on purpose (6 and 8 ways) and expect the tests to fail.
