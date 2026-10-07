<#
.SYNOPSIS
  Starts Leap for local development: checks the database, applies migrations, starts the backend, then the admin / supplier / hub portals,
  each in its own window.

.DESCRIPTION
  What it does, in order (and it stops with a clear message if a step fails):
    1. checks node and npm exist, and installs a folder's packages if its node_modules is missing
    2. checks the database is reachable (host and port come from services\api\.env); tries to start the Windows Postgres service if it is not
    3. stops any OLD Leap server still running on the ports (only node processes: anything else is left alone and reported)
    4. applies database migrations (node db/migrate.js) and refuses to continue if that fails
    5. starts the backend and waits until /health answers, warning if a migration is still pending
    6. starts each portal (with --force so a stale dev cache can never show an old page, and --strictPort so it never silently moves to another port)

  Run it again after extracting any patch zip: it is safe to run repeatedly.

.PARAMETER Only
  What to start. Default: everything. Examples: -Only backend    -Only admin,hub

.PARAMETER SkipMigrate
  Do not run migrations (not recommended).

.PARAMETER Open
  Open the admin portal in your browser when everything is up.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\start-leap.ps1
#>
[CmdletBinding()]
param(
  [ValidateSet('all', 'backend', 'admin', 'supplier', 'hub')]
  [string[]]$Only = @('all'),
  [switch]$SkipMigrate,
  [switch]$Open
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $root (Join-Path 'services' 'api')
$wanted = if ($Only -contains 'all') { @('backend', 'admin', 'supplier', 'hub') } else { $Only }
$portalDirs = @{
  admin    = Join-Path $root (Join-Path 'apps' 'admin-dashboard')
  supplier = Join-Path $root (Join-Path 'apps' 'supplier-portal')
  hub      = Join-Path $root (Join-Path 'apps' 'hub-portal')
}

Write-Host ""
Write-Host "Leap - starting ($($wanted -join ', '))" -ForegroundColor White
Write-Host ("Project folder: " + $root)
Write-Host ""

# ---- 1. tools and packages ----
Write-Step "1/6  Checking node and npm..."
foreach ($tool in 'node', 'npm') {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Write-Fail "$tool was not found. Install Node.js (the LTS version) and open a NEW PowerShell window."; exit 1 }
}
Write-Ok ("node " + (& node --version))
$needPackages = @()
if (($wanted -contains 'backend') -and -not (Test-Path -LiteralPath (Join-Path $apiDir 'node_modules'))) { $needPackages += $apiDir }
foreach ($name in 'admin', 'supplier', 'hub') {
  if (($wanted -contains $name) -and -not (Test-Path -LiteralPath (Join-Path $portalDirs[$name] 'node_modules'))) { $needPackages += $portalDirs[$name] }
}
foreach ($dir in $needPackages) {
  Write-Warn ("Packages are missing in " + $dir + ": running npm install (this can take a few minutes)...")
  Push-Location -LiteralPath $dir
  try { & npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed in $dir"; exit 1 } } finally { Pop-Location }
}

# ---- 2. database ----
Write-Step "2/6  Checking the database..."
$database = Get-DatabaseEndpoint $apiDir
$databaseUp = Test-TcpPort $database.Host $database.Port
if (-not $databaseUp) {
  Write-Warn ("The database is not answering on " + $database.Host + ":" + $database.Port + ".")
  $service = $null
  if (Get-Command Get-Service -ErrorAction SilentlyContinue) { $service = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1 }
  if ($service) {
    Write-Host ("  Trying to start the Windows service '" + $service.Name + "'...")
    try { if ($service.Status -ne 'Running') { Start-Service -Name $service.Name -ErrorAction Stop } } catch { Write-Warn ("  Could not start it (" + $_.Exception.Message + "). Open PowerShell AS ADMINISTRATOR and run:  net start " + $service.Name) }
    for ($i = 0; $i -lt 20 -and -not $databaseUp; $i++) { Start-Sleep -Seconds 1; $databaseUp = Test-TcpPort $database.Host $database.Port }
  }
}
if (-not $databaseUp) {
  Write-Fail ("Still no database on " + $database.Host + ":" + $database.Port + ". Start PostgreSQL (as Administrator:  net start postgresql-x64-14 ), check the port in services\api\.env, and run this again.")
  exit 1
}
Write-Ok ("Database is reachable at " + $database.Host + ":" + $database.Port)

# ---- 3. stop old servers ----
Write-Step "3/6  Stopping any old Leap servers on the ports we need..."
$allFree = $true
foreach ($name in $wanted) {
  if (-not (Stop-LeapPort $name $script:LeapPorts[$name])) { $allFree = $false }
}
if (-not $allFree) { Write-Fail "Free the port(s) above and run this again."; exit 1 }
Write-Ok "Ports are free"

# ---- 4. migrations ----
if ($wanted -contains 'backend') {
  if ($SkipMigrate) {
    Write-Step "4/6  Skipping migrations (-SkipMigrate)"
  } else {
    Write-Step "4/6  Applying database migrations..."
    Push-Location -LiteralPath $apiDir
    # Windows PowerShell 5.1 turns anything a program writes to stderr into a script-stopping error when ErrorActionPreference is 'Stop', which would
    # kill this script before it could print its own message about a failed migration. So relax it for this one call and check the exit code instead.
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      # Show only what matters: migrations that were APPLIED (or any problem), plus a count of the ones already done, instead of ~100 "skip" lines.
      $migrateOutput = @(& node db/migrate.js 2>&1 | ForEach-Object { "$_" })
      $migrateExit = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $previousPreference
      Pop-Location
    }
    $alreadyApplied = @($migrateOutput | Where-Object { $_ -match '^skip ' }).Count
    foreach ($line in ($migrateOutput | Where-Object { $_ -notmatch '^skip ' -and $_.Trim() -ne '' })) { Write-Host ("  " + $line) }
    if ($migrateExit -ne 0) { Write-Fail "The migration FAILED (see the message above). Nothing was started. Fix it, then run this again."; exit 1 }
    Write-Ok ("Migrations are up to date ($alreadyApplied were already applied)")
  }
} else {
  Write-Step "4/6  Migrations: not needed (backend not being started)"
}

# ---- 5. backend ----
if ($wanted -contains 'backend') {
  Write-Step "5/6  Starting the backend (its own window)..."
  Start-InNewWindow 'Leap backend' $apiDir 'node src/index.js'
  $health = Wait-ForUrl ("http://localhost:" + $script:LeapPorts['backend'] + "/health") 40 { param($r) $r.Content -match '"status"\s*:\s*"ok"' }
  if (-not $health) { Write-Fail "The backend did not answer within 40 seconds. Read its window: the last lines say why."; exit 1 }
  Write-Ok ("Backend is up on http://localhost:" + $script:LeapPorts['backend'])
  if ($health.Content -match '"pendingMigrations"\s*:\s*\[\s*"') { Write-Warn "The backend reports a migration that is still pending: run  node db/migrate.js  in services\api, then start again." }
} else {
  Write-Step "5/6  Backend: not being started"
  if (-not (Test-TcpPort 'localhost' $script:LeapPorts['backend'])) { Write-Warn ("Nothing is answering on the backend port " + $script:LeapPorts['backend'] + ": the portals will load but show errors until it is started.") }
}

# ---- 6. portals ----
Write-Step "6/6  Starting the portals (each in its own window)..."
$started = @()
foreach ($name in 'admin', 'supplier', 'hub') {
  if ($wanted -notcontains $name) { continue }
  $port = $script:LeapPorts[$name]
  Start-InNewWindow ("Leap " + $name) $portalDirs[$name] ("npm run dev -- --port $port --strictPort --force")
  $started += $name
}
$failed = @()
foreach ($name in $started) {
  $port = $script:LeapPorts[$name]
  $page = Wait-ForUrl ("http://localhost:" + $port + "/") 40
  if ($page) { Write-Ok ("$name portal is up on http://localhost:$port") } else { Write-Fail ("$name portal did not answer on port $port within 40 seconds. Read its window."); $failed += $name }
}

Write-Host ""
if ($failed.Count -gt 0) { Write-Fail ("Not everything started: " + ($failed -join ', ')); exit 1 }
Write-Host "Everything is up:" -ForegroundColor White
if ($wanted -contains 'backend')  { Write-Host ("  backend   http://localhost:" + $script:LeapPorts['backend'] + "/health") }
if ($wanted -contains 'admin')    { Write-Host ("  admin     http://localhost:" + $script:LeapPorts['admin']    + "   (admin@leap.dev / admin_dev_password_123 - keyboard in English)") }
if ($wanted -contains 'supplier') { Write-Host ("  supplier  http://localhost:" + $script:LeapPorts['supplier']) }
if ($wanted -contains 'hub')      { Write-Host ("  hub       http://localhost:" + $script:LeapPorts['hub']) }
Write-Host "Press Ctrl+F5 in the browser the first time. To stop everything: scripts\stop-leap.ps1"
if ($Open -and ($wanted -contains 'admin')) { Start-Process ("http://localhost:" + $script:LeapPorts['admin']) | Out-Null }
exit 0
