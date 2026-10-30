# Supplier portal: the new Bulk upload

1. Download the template: 3 columns, OE Number | Item Name | Price (RMB).
2. Choose the vehicle as for one product: Brand | Model | Year, then All versions
   or Only some versions (applies to every row).
3. Choose the filled-in file. Each row shows the Category and Part class found
   from its item name ("Found from the name"); rows with several or no matches
   are marked to choose. Every row can be changed.
4. Add photos and video per row (as many as Settings ask), or many files at once
   named by OE number: 34116792217-1.jpg, 34116792217-2.jpg, 34116792217.mp4.
5. Import: a row with everything goes straight to review; any other row is a
   draft that keeps what it has and asks for the rest in My Drafts.

Position comes from the part name when it says it (Front Brake Disc -> Front);
otherwise it stays empty, as for one product. No migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_bulk_upload.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-bulk-upload.js
    node scripts\patch-bulk-upload.js --write
    cd services\api
    node --test test\bulkMatch.test.js
    cd ..\..\apps\supplier-portal
    npx vitest run --exclude "**/*.integration.test.js"
    cd ..\..
    .\scripts\start-all.cmd -Stop
    .\scripts\start-all.cmd -NoPhone

Undo: each changed file is saved as <file>.before-bulk-upload.
