# Vehicle Data: Download Excel

Admin portal > Vehicle Data > "Download Excel" tab: choose All brands or one
brand, press "Download Excel (.xlsx)".

The file follows the Leap_GEELY sheet: one row per version;
Brand | Model | Year | Version | Engine | Seats in English, then Arabic, then
Chinese; then "Vehicle Photo" with the photo inside the cell (the version's
photo, else its year's). Click a photo to open it full size. A WebP photo (Excel
cannot show WebP) or a missing file becomes an "Open photo" link.
Sheet: "GEELY Models" (one brand) or "All Models". File:
Leap_GEELY_Vehicles.xlsx or Leap_All_Brands_Vehicles.xlsx.

No migration.

## Apply (PowerShell)

    cd D:\LEAP-MARKETPLACE
    Expand-Archive -Path "$env:USERPROFILE\Downloads\leap_vehicle_export.zip" -DestinationPath D:\LEAP-MARKETPLACE -Force
    node scripts\patch-vehicle-export.js
    node scripts\patch-vehicle-export.js --write
    cd services\api
    node --test test\vehicleExport.test.js
    cd ..\..\apps\admin-dashboard
    npx vitest run src/VehicleExportPanel.wiring.test.js
    cd ..\..
    .\scripts\start-all.cmd -Stop
    .\scripts\start-all.cmd -NoPhone

Undo: each changed file is saved as <file>.before-vehicle-export.
