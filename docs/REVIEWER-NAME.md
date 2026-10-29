# Hidden reviewer names (mobile app + website)

On the product page a reviewer's name is shown hidden:

| Name             | Shown as |
|------------------|----------|
| micheal          | MI***al  |
| Mohammed Alharbi | MO***bi  |
| محمد العتيبي      | مح***بي  |
| Ali              | A***     |
| (no name)        | Buyer    |

Rule: first 2 letters in capitals, ***, last 2 letters; 4 letters or fewer ->
first letter and ***; spaces ignored. The admin portal still shows full names.

No server change. No migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_reviewer_name.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-reviewer-name.js
    node scripts\patch-reviewer-name.js --write
    cd apps\mobile
    flutter test test\reviewer_name_test.dart
    cd ..\web-storefront
    npx vitest run lib/reviewer-name.test.ts
    cd ..\..
    .\scripts\start-all.cmd -Stop
    .\scripts\start-all.cmd

Undo: each changed file is saved as <file>.before-reviewer-name.
