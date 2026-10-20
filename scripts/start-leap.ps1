<#
.SYNOPSIS
  Starts Leap for local development: checks the database, applies migrations, starts the backend, then the admin / supplier / hub portals,
  each in its own window.

.DESCRIPTION
  What it does, in order (and it stops with a clear message if a step fails):
    1. checks node and npm exist, and installs a folder's packages if its node_modules is missing (and the backend's exceljs and jszip if they are absent)
    2. checks the database is reachable (host and port come from services\api\.env); tries to start the Windows Postgres service if it is not
    3. stops any OLD Leap server still running on the ports (only node processes: anything else is left alone and reported)
    4. applies database migrations (node db/migrate.js) and refuses to continue if that fails
    5. starts the backend and waits until /health answers, warning if a migration is still pending. If it does not start, the last lines it printed are
       shown HERE with the likely reason; a missing package is installed and the start is tried once more
       (everything the backend prints is also saved in logs\backend.log, and this whole run in logs\start-leap.log)
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
# A log of this whole run, so there is always something to send when help is needed (the windows of the servers can close and take their messages with them).
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$backendLog = Join-Path $logDir 'backend.log'
$runLog = Join-Path $logDir 'start-leap.log'
try { Start-Transcript -Path $runLog -Force | Out-Null } catch { }
function Exit-Leap([int]$Code) {
  if ($Code -ne 0) { Write-Host ("  A log of this run is in " + $runLog + "  - send it if you need help.") -ForegroundColor Yellow }
  try { Stop-Transcript | Out-Null } catch { }
  exit $Code
}
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
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Write-Fail "$tool was not found. Install Node.js (the LTS version) and open a NEW PowerShell window."; Exit-Leap 1 }
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
  try { & npm install --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed in $dir"; Exit-Leap 1 } } finally { Pop-Location }
}

# The backend also needs exceljs and jszip (the Excel import of vehicle data). A patch zip does not bring packages, so install them here when they are absent.
if (($wanted -contains 'backend') -and (Test-Path -LiteralPath (Join-Path $apiDir 'node_modules'))) {
  $absent = @(Get-MissingPackages $apiDir $script:LeapApiExtras)
  if ($absent.Count -gt 0) {
    Write-Warn ("The backend needs " + ($absent -join ' and ') + " (the Excel import of vehicle data) and it is not installed yet: installing it...")
    Push-Location -LiteralPath $apiDir
    try { & npm install @absent --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { Write-Fail ("npm install " + ($absent -join ' ') + " failed in " + $apiDir); Exit-Leap 1 } } finally { Pop-Location }
    Write-Ok ("Installed " + ($absent -join ' and '))
  }
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
  Exit-Leap 1
}
Write-Ok ("Database is reachable at " + $database.Host + ":" + $database.Port)

# ---- 3. stop old servers ----
Write-Step "3/6  Stopping any old Leap servers on the ports we need..."
$allFree = $true
foreach ($name in $wanted) {
  if (-not (Stop-LeapPort $name $script:LeapPorts[$name])) { $allFree = $false }
}
if (-not $allFree) { Write-Fail "Free the port(s) above and run this again."; Exit-Leap 1 }
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
    if ($migrateExit -ne 0) { Write-Fail "The migration FAILED (see the message above). Nothing was started. Fix it, then run this again."; Exit-Leap 1 }
    Write-Ok ("Migrations are up to date ($alreadyApplied were already applied)")
  }
} else {
  Write-Step "4/6  Migrations: not needed (backend not being started)"
}

# ---- 5. backend ----
if ($wanted -contains 'backend') {
  Write-Step "5/6  Starting the backend (its own window; what it prints is also saved in logs\backend.log)..."
  $backendCommand = '& ''' + (Join-Path $PSScriptRoot 'run-backend.ps1') + ''' -ApiDir ''' + $apiDir + ''' -LogFile ''' + $backendLog + ''''
  $health = $null
  for ($attempt = 1; $attempt -le 2 -and -not $health; $attempt++) {
    Set-Content -LiteralPath $backendLog -Value '' -ErrorAction SilentlyContinue          # so an old log can never be mistaken for this start
    Start-InNewWindow 'Leap backend' $apiDir $backendCommand
    $crashed = { $null -ne (Get-StartupHint @(Get-Content -LiteralPath $backendLog -Tail 40 -ErrorAction SilentlyContinue)) }
    $health = Wait-ForUrl ("http://localhost:" + $script:LeapPorts['backend'] + "/health") 40 { param($r) $r.Content -match '"status"\s*:\s*"ok"' } $crashed
    if ($health) { break }
    Write-Fail "The backend did not start. This is the end of what it printed:"
    $tail = @(Show-LogTail $backendLog 25)
    $hint = Get-StartupHint $tail
    if ($hint) { Write-Warn $hint.Text } else { Write-Warn "No known cause found in that output (if it only shows normal start-up lines it may just be slow: run this again)." }
    if ($attempt -eq 1 -and $hint -and $hint.Kind -eq 'module' -and (Test-InstallablePackage $apiDir $hint.MissingModule)) {
      Write-Warn ("Installing " + $hint.MissingModule + " and trying once more (you can close the backend window that stopped)...")
      Push-Location -LiteralPath $apiDir
      try { & npm install $hint.MissingModule --no-audit --no-fund; $installExit = $LASTEXITCODE } finally { Pop-Location }
      if ($installExit -ne 0) { Write-Fail ("npm install " + $hint.MissingModule + " failed."); break }
      continue
    }
    break
  }
  if (-not $health) { Write-Fail ("The backend is not running. Its full output is in " + $backendLog); Exit-Leap 1 }
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
if ($failed.Count -gt 0) { Write-Fail ("Not everything started: " + ($failed -join ', ')); Exit-Leap 1 }
Write-Host "Everything is up:" -ForegroundColor White
if ($wanted -contains 'backend')  { Write-Host ("  backend   http://localhost:" + $script:LeapPorts['backend'] + "/health") }
if ($wanted -contains 'admin')    { Write-Host ("  admin     http://localhost:" + $script:LeapPorts['admin']    + "   (admin@leap.dev / admin_dev_password_123 - keyboard in English)") }
if ($wanted -contains 'supplier') { Write-Host ("  supplier  http://localhost:" + $script:LeapPorts['supplier']) }
if ($wanted -contains 'hub')      { Write-Host ("  hub       http://localhost:" + $script:LeapPorts['hub']) }
Write-Host "Press Ctrl+F5 in the browser the first time. To stop everything: scripts\stop-leap.ps1"
if ($Open -and ($wanted -contains 'admin')) { Start-Process ("http://localhost:" + $script:LeapPorts['admin']) | Out-Null }
Exit-Leap 0
