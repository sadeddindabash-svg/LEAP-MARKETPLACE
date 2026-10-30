# Product name minimums by language

The supplier's product name must have at least:
  English 15 characters, Chinese 5, Arabic 15 (all characters count:
  spaces, digits and signs too), and at most 100.
The language is found from the name: Chinese characters -> Chinese, else
Arabic letters -> Arabic, else English.

The admin changes the three numbers in the admin portal:
Products > Product requirements > "Minimum product name length".

- Add product: the counter under the name shows the minimum for its language;
  the server refuses a name outside the rule.
- Bulk upload: a row outside the rule is shown in red ("not imported") and the
  server refuses it.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_name_minimums.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-name-minimums.js
    node scripts\patch-name-minimums.js --write
    cd services\api
    npm run migrate
    node --test test\supplierName.test.js
    cd ..\..\apps\supplier-portal
    npx vitest run --exclude "**/*.integration.test.js"
    cd ..\..
    .\scripts\start-all.cmd -Stop
    .\scripts\start-all.cmd -NoPhone

Undo: each changed file is saved as <file>.before-name-minimums.
