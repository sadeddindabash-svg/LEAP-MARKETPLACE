<#
.SYNOPSIS
  Runs the automated tests against a THROWAWAY test database, so they can never fill the database your app uses with test data.

.DESCRIPTION
  The test suites create hundreds of categories, parts, products, accounts and orders. Run against the database the app uses, they leave all of it
  behind (the phone app then shows it). This script instead:
    1. prepares a separate test database (leap_marketplace_test): creates it if needed, wipes it, applies every migration, loads the seed data
       (it can only ever wipe a database whose name ends in "_test")
    2. pauses your normal backend, and starts a hidden backend that uses the TEST database (the tests expect it on port 4000)
    3. runs the test suites
    4. ALWAYS stops the test backend and starts your normal backend again, even if a test fails or you press Ctrl+C

  While it runs (about 8 minutes for everything) your app cannot reach the backend. Your real database is not touched.

.PARAMETER Suites
  Which test suites to run: admin, supplier, hub. Default: all three.

.PARAMETER Filter
  Only run test files whose name contains this text, e.g. -Filter emailCase

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1
  powershell -ExecutionPolicy Bypass -File scripts\run-tests.ps1 -Suites admin -Filter payouts
#>
[CmdletBinding()]
param(
  [ValidateSet('admin', 'supplier', 'hub')]
  [string[]]$Suites = @('admin', 'supplier', 'hub'),
  [string]$Filter
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root (Join-Path 'services' 'api')
$suiteDirs = @{
  admin    = Join-Path $root (Join-Path 'apps' 'admin-dashboard')
  supplier = Join-Path $root (Join-Path 'apps' 'supplier-portal')
  hub      = Join-Path $root (Join-Path 'apps' 'hub-portal')
}
$onWindows = ($PSVersionTable.PSEdition -eq 'Desktop') -or ($IsWindows -eq $true)
$backendPort = $script:LeapPorts['backend']
$logFile = Join-Path ([System.IO.Path]::GetTempPath()) 'leap-test-backend.log'

Write-Host ""
Write-Host "Leap - running the tests on a throwaway database" -ForegroundColor White
Write-Host ("Suites: " + ($Suites -join ', ') + $(if ($Filter) { "   Filter: $Filter" } else { "" }))
Write-Host ""

Write-Step "1/5  Checking node..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Fail "node was not found. Install Node.js and open a NEW PowerShell window."; exit 1 }
Write-Ok ("node " + (& node --version))

# ---- 1. the test database ----
Write-Step "2/5  Preparing the TEST database (your real database is not touched)..."
Push-Location -LiteralPath $apiDir
try {
  $previousPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $prepareOutput = @(& node db/prepare-test-db.js 2>&1 | ForEach-Object { "$_" })
  $prepareExit = $LASTEXITCODE
  $testUrl = (@(& node db/prepare-test-db.js --url 2>&1 | ForEach-Object { "$_" }) | Select-Object -Last 1)
  $ErrorActionPreference = $previousPreference
} finally { Pop-Location }
foreach ($line in $prepareOutput) { if ($line.Trim() -ne '') { Write-Host ("  " + $line) } }
if ($prepareExit -ne 0) {
  if ($prepareExit -eq 3) { Write-Fail "The test database could not be created automatically: do the ONE-TIME STEP shown above, then run this again." }
  else { Write-Fail "The test database could not be prepared (see above). Nothing was started or stopped." }
  exit 1
}
if (-not $testUrl -or $testUrl -notmatch '_test') { Write-Fail "Could not work out the test database address. Nothing was started or stopped."; exit 1 }

# ---- 2. swap the backends ----
Write-Step "3/5  Pausing your normal backend and starting one for the test database..."
$devWasRunning = (Get-ListeningProcessIds $backendPort).Count -gt 0
if ($devWasRunning) {
  if (-not (Stop-LeapPort 'backend' $backendPort)) { Write-Fail "Port $backendPort is in use by something that is not Leap's backend (see above). Nothing was changed."; exit 1 }
}
$testBackend = $null
$failed = @()
$results = [ordered]@{}
$originalDatabaseUrl = $env:DATABASE_URL
try {
  $env:DATABASE_URL = $testUrl
  $startArgs = @{ FilePath = (Get-Command node).Source; ArgumentList = 'src/index.js'; WorkingDirectory = $apiDir; RedirectStandardOutput = $logFile; RedirectStandardError = ($logFile + '.err'); PassThru = $true }
  if ($onWindows) { $startArgs.WindowStyle = 'Hidden' }
  $testBackend = Start-Process @startArgs
  $health = Wait-ForUrl ("http://localhost:" + $backendPort + "/health") 40 { param($r) $r.Content -match '"status"\s*:\s*"ok"' }
  if (-not $health) { throw "The test backend did not answer within 40 seconds. Its log: $logFile" }
  if ($health.Content -match '"pendingMigrations"\s*:\s*\[\s*"') { throw "The test backend reports a pending migration: the test database is not fully prepared." }
  Write-Ok "Test backend is up (hidden), using the TEST database"

  # ---- 3. the suites ----
  Write-Step "4/5  Running the tests (this takes several minutes)..."
  foreach ($suite in $Suites) {
    Write-Host ""
    Write-Host ("  --- " + $suite + " ---") -ForegroundColor White
    Push-Location -LiteralPath $suiteDirs[$suite]
    try {
      $previousPreference = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
      $vitestArgs = @('vitest', 'run'); if ($Filter) { $vitestArgs += $Filter }
      # (the RemoteException line is only PowerShell 7 noticing that a program wrote an empty line to its error stream)
      $output = @(& npx @vitestArgs 2>&1 | ForEach-Object { "$_"; if ("$_" -notmatch '^System\.Management\.Automation\.RemoteException$') { Write-Host $_ } })
      $suiteExit = $LASTEXITCODE
      $ErrorActionPreference = $previousPreference
    } finally { Pop-Location }
    $clean = $output | ForEach-Object { $_ -replace "\x1b\[[0-9;]*m", '' }
    $summary = @($clean | Where-Object { $_ -match '^\s*(Test Files|Tests)\s' } | ForEach-Object { $_.Trim() })
    # With -Filter, a suite that simply has no test file matching it is not a failure (vitest exits with 1 when nothing matches).
    $nothingMatched = @($clean | Where-Object { $_ -match 'No test files found' }).Count -gt 0
    if ($nothingMatched -and $Filter) { $suiteExit = 0; $summary = @("no test file matches '$Filter' (nothing to run)") }
    $results[$suite] = @{ exit = $suiteExit; summary = $summary }
    if ($suiteExit -ne 0) { $failed += $suite }
  }
} catch {
  Write-Fail $_.Exception.Message
  $failed += 'setup'
} finally {
  # ---- 4. ALWAYS put things back ----
  Write-Host ""
  Write-Step "5/5  Putting everything back..."
  if ($testBackend -and -not $testBackend.HasExited) { try { Stop-Process -Id $testBackend.Id -Force -ErrorAction Stop; Write-Ok "Test backend stopped" } catch { Write-Warn ("Could not stop the test backend (process " + $testBackend.Id + "): close it by hand.") } }
  [void](Stop-LeapPort 'test backend' $backendPort)
  $env:DATABASE_URL = $originalDatabaseUrl
  if ($devWasRunning) {
    Write-Host "  Starting your normal backend again..."
    & (Join-Path $PSScriptRoot 'start-leap.ps1') -Only backend | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Ok "Your normal backend is back" } else { Write-Warn "Could not restart your normal backend: run scripts\start-leap.cmd." }
  }
}

Write-Host ""
Write-Host "Results:" -ForegroundColor White
foreach ($suite in $results.Keys) {
  $r = $results[$suite]
  $mark = if ($r.exit -eq 0) { '[OK]' } else { '[XX]' }
  Write-Host ("  " + $mark + " " + $suite + ":  " + ($r.summary -join '   '))
}
if ($failed.Count -gt 0) { Write-Fail ("Failed: " + ($failed -join ', ')); exit 1 }
Write-Ok "All suites passed. Your real database was not touched."
exit 0
