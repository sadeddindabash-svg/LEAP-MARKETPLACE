# LEAP Marketplace: start everything fresh, each part in its own window.
#   powershell -ExecutionPolicy Bypass -File D:\LEAP-MARKETPLACE\scripts\start-all.ps1
$root = 'D:\LEAP-MARKETPLACE'

Write-Host '1/5  Closing old API and portal windows (old node processes)...' -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host '2/5  Database (PostgreSQL)...' -ForegroundColor Cyan
$all = @(Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notmatch 'Odoo' })
$run = @($all | Where-Object { $_.Status -eq 'Running' })
if ($run.Count -gt 0) { Write-Host "     Already running: $(($run | ForEach-Object Name) -join ', ')" }
elseif ($all.Count -eq 0) { Write-Host '     No PostgreSQL service found on this PC. If the database runs another way, start it yourself.' -ForegroundColor Yellow }
else {
  $pg = $all | Sort-Object Name -Descending | Select-Object -First 1
  try { Start-Service $pg.Name -ErrorAction Stop; Write-Host "     $($pg.Name) started." }
  catch { Write-Host "     Could not start $($pg.Name) from here. Starting it as administrator (click Yes)..." -ForegroundColor Yellow
          Start-Process powershell -Verb RunAs -Wait -ArgumentList "-NoProfile -Command Start-Service '$($pg.Name)'" }
}

Write-Host '3/5  API (migrate, then run) in its own window...' -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='LEAP API'; cd '$root\services\api'; npm run migrate; npm run dev"

Write-Host '     Waiting for the API to answer on http://localhost:4000/health ...'
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 2
  try { $h = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 3; $ok = $true; break } catch {}
}
if ($ok) {
  Write-Host "     API: $($h.status)" -ForegroundColor Green
  if ($h.status -ne 'ok') { Write-Host '     The database cannot be reached. Look at the LEAP API window.' -ForegroundColor Red }
  elseif ($h.pendingMigrations -and $h.pendingMigrations.Count -gt 0) { Write-Host "     Migrations still waiting: $($h.pendingMigrations -join ', ')" -ForegroundColor Yellow }
} else { Write-Host '     The API did not answer in 2 minutes. Look at the LEAP API window for the red error and send it.' -ForegroundColor Red }

Write-Host '4/5  Portals, each in its own window...' -ForegroundColor Cyan
$portals = @(
  @{ name = 'LEAP Website';         dir = 'apps\web-storefront' },
  @{ name = 'LEAP Supplier Hub';    dir = 'apps\hub-portal' },
  @{ name = 'LEAP Supplier Portal'; dir = 'apps\supplier-portal' },
  @{ name = 'LEAP Admin';           dir = 'apps\admin-dashboard' }
)
foreach ($p in $portals) {
  $d = Join-Path $root $p.dir
  if (Test-Path (Join-Path $d 'package.json')) {
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$host.UI.RawUI.WindowTitle='$($p.name)'; cd '$d'; npm run dev"
    Write-Host "     $($p.name) started (its window shows its address)."
  }
}

Write-Host '5/5  Phone over USB...' -ForegroundColor Cyan
if (Get-Command adb -ErrorAction SilentlyContinue) {
  adb reverse tcp:4000 tcp:4000 2>$null
  if ($LASTEXITCODE -eq 0) { Write-Host '     Phone connected: the app can reach the API.' -ForegroundColor Green }
  else { Write-Host '     No phone on USB. Plug it in, then run: adb reverse tcp:4000 tcp:4000' -ForegroundColor Yellow }
} else { Write-Host '     adb not found, skipped.' -ForegroundColor Yellow }

Write-Host ''
Write-Host 'Done. For the app: cd apps\<app folder>; flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000' -ForegroundColor Green
