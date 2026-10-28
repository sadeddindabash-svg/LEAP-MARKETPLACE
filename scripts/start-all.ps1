<#
.SYNOPSIS
  ONE command: restarts the backend and the admin / supplier / hub portals (start-leap.ps1), starts the website (port 3001), and builds and starts the app on the phone connected by USB.

.DESCRIPTION
  What it does, in order (and it stops with a clear message if the first step fails):
    1. backend + admin + supplier + hub portals: runs start-leap.ps1 (stops any old copy, applies new migrations, waits for the backend). If that fails, nothing else is started.
    2. the website: stops an old copy on port 3001 (only a node process), then starts it in its own window and waits for it
    3. the phone app: finds the address of THIS computer (the phone needs it), checks the phone is connected, then runs "flutter run --release" in its own window
  Every server runs in its own window: close a window to stop that server. To stop everything: start-all.ps1 -Stop

.PARAMETER NoStorefront   do not start the website
.PARAMETER NoPhone        do not build or start the phone app
.PARAMETER PhoneId        the phone's id (as "flutter devices" shows it). Default: 2GSUT23311005353
.PARAMETER ApiHost        this computer's address for the phone. Default: found automatically
.PARAMETER CleanWebsite   delete the website's .next cache first (use after a patch if a page looks old)
.PARAMETER Stop           stop everything instead (backend, portals and website)
.PARAMETER DryRun         only SAY what would be done; start nothing

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1 -NoPhone
#>
[CmdletBinding()]
param(
  [switch]$NoStorefront,
  [switch]$NoPhone,
  [string]$PhoneId = '2GSUT23311005353',
  [string]$ApiHost = '',
  [switch]$CleanWebsite,
  [switch]$Stop,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
$root = Split-Path -Parent $PSScriptRoot
$storefrontDir = Join-Path $root (Join-Path 'apps' 'web-storefront')
$mobileDir = Join-Path $root (Join-Path 'apps' 'mobile')
$storefrontPort = 3001
$backendPort = $script:LeapPorts['backend']
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
try { Start-Transcript -Path (Join-Path $logDir 'start-all.log') -Force | Out-Null } catch { }
function Exit-All([int]$Code) {
  if ($Code -ne 0) { Write-Host ("  A log of this run is in " + (Join-Path $logDir 'start-all.log') + "  - send it if you need help.") -ForegroundColor Yellow }
  try { Stop-Transcript | Out-Null } catch { }
  exit $Code
}
function Say-Would([string]$Text) { Write-Host ("  [dry run] would: " + $Text) -ForegroundColor DarkGray }

# This computer's address on the network (the phone reaches the backend through it); $null when it cannot be found.
function Get-LanAddress {
  try {
    $config = Get-NetIPConfiguration -ErrorAction Stop | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1
    if ($config -and $config.IPv4Address) { return @($config.IPv4Address)[0].IPAddress }
  } catch { }
  return $null
}

Write-Host ""
Write-Host "Leap - everything" -ForegroundColor White
Write-Host ("Project folder: " + $root)
Write-Host ""

# ---- stop everything ----
if ($Stop) {
  Write-Step "Stopping the backend and the portals..."
  if ($DryRun) { Say-Would "run stop-leap.ps1, then stop the website on port $storefrontPort" } else {
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'stop-leap.ps1')
    Write-Step "Stopping the website..."
    if (Stop-LeapPort 'website' $storefrontPort) { Write-Ok "The website is stopped (or was not running)" } else { Exit-All 1 }
  }
  Write-Host "The phone app keeps running on the phone; it just cannot reach the backend until you start it again." -ForegroundColor Gray
  Exit-All 0
}

# ---- 1. backend and portals ----
Write-Step "1/3  Backend and the admin, supplier and hub portals (start-leap.ps1)..."
if ($DryRun) { Say-Would "run start-leap.ps1 (stops old copies, applies migrations, starts the backend and the three portals)" } else {
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-leap.ps1')
  if ($LASTEXITCODE -ne 0) { Write-Fail "The backend or a portal did not start (see above). The website and the phone app were NOT started: they need the backend."; Exit-All 1 }
}

# ---- 2. the website ----
Write-Host ""
if ($NoStorefront) { Write-Step "2/3  Website: skipped (-NoStorefront)" } else {
  Write-Step "2/3  The website on port $storefrontPort..."
  if (-not (Test-Path -LiteralPath (Join-Path $storefrontDir 'package.json'))) { Write-Fail ("The website folder was not found: " + $storefrontDir); Exit-All 1 }
  if ($DryRun) {
    if (-not (Test-Path -LiteralPath (Join-Path $storefrontDir 'node_modules'))) { Say-Would "run npm install in the website folder (packages are missing)" }
    Say-Would "stop an old node process on port $storefrontPort"
    if ($CleanWebsite) { Say-Would "delete apps\web-storefront\.next" }
    Say-Would "open a window: npm run dev -- -p $storefrontPort, and wait for http://localhost:$storefrontPort/"
  } else {
    if (-not (Test-Path -LiteralPath (Join-Path $storefrontDir 'node_modules'))) {
      Write-Warn "Packages are missing in the website folder: running npm install (this can take a few minutes)..."
      Push-Location -LiteralPath $storefrontDir
      try { & npm install } finally { Pop-Location }
      if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed in the website folder."; Exit-All 1 }
    }
    if (-not (Stop-LeapPort 'website' $storefrontPort)) { Write-Fail "Port $storefrontPort is not free, so the website cannot start there."; Exit-All 1 }
    if ($CleanWebsite) {
      $cache = Join-Path $storefrontDir '.next'
      if (Test-Path -LiteralPath $cache) { Remove-Item -LiteralPath $cache -Recurse -Force -ErrorAction SilentlyContinue; Write-Ok "Deleted the website's .next cache" }
    }
    Start-InNewWindow "Leap website" $storefrontDir "npm run dev -- -p $storefrontPort"
    Write-Host "  (the first page can take up to a minute while it compiles)" -ForegroundColor Gray
    $page = Wait-ForUrl ("http://localhost:" + $storefrontPort + "/") 150
    if ($page) { Write-Ok ("The website is up on http://localhost:" + $storefrontPort) } else { Write-Warn ("The website did not answer within 150 seconds. Read its window: it may still be compiling, or show an error to send me.") }
  }
}

# ---- 3. the phone app ----
Write-Host ""
$phoneUrl = $null
if ($NoPhone) { Write-Step "3/3  Phone app: skipped (-NoPhone)" } else {
  Write-Step "3/3  The phone app (flutter run on the phone connected by USB)..."
  $address = $ApiHost
  if (-not $address) { $address = Get-LanAddress }
  if (-not $address) { $address = '192.168.0.210'; Write-Warn ("This computer's address could not be found, so the usual one is used: " + $address + ". If the app cannot reach the backend, run again with  -ApiHost YOUR-ADDRESS  (ipconfig shows it).") }
  else { Write-Ok ("This computer's address for the phone: " + $address) }
  $phoneUrl = "http://" + $address + ":" + $backendPort
  if ($DryRun) {
    Say-Would "check the phone $PhoneId is listed by flutter devices"
    Say-Would "open a window in apps\mobile: flutter run --release -d $PhoneId --dart-define=API_BASE_URL=$phoneUrl"
  } elseif (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Write-Warn "flutter was not found in this window, so the phone app was not started. Open a NEW PowerShell window (so it sees Flutter) or use -NoPhone."
  } elseif (-not (Test-Path -LiteralPath (Join-Path $mobileDir 'pubspec.yaml'))) {
    Write-Warn ("The app folder was not found: " + $mobileDir)
  } else {
    $devices = (& flutter devices 2>&1 | Out-String)
    if ($devices -notmatch [regex]::Escape($PhoneId)) {
      Write-Warn ("The phone " + $PhoneId + " is not listed by 'flutter devices'. Plug in the USB cable, unlock the phone and allow USB debugging, then run again (or use -NoPhone). The phone app was NOT started.")
    } else {
      Write-Ok ("The phone " + $PhoneId + " is connected")
      Start-InNewWindow "Leap phone app" $mobileDir ("flutter run --release -d $PhoneId --dart-define=API_BASE_URL=$phoneUrl")
      Write-Host "  (building and installing takes a few minutes: keep the phone unlocked and tap Allow / Install if it asks)" -ForegroundColor Gray
    }
  }
}

Write-Host ""
Write-Host "Done. Addresses:" -ForegroundColor White
Write-Host ("  backend   http://localhost:" + $backendPort + "/health")
Write-Host ("  admin     http://localhost:" + $script:LeapPorts['admin'] + "   (admin@leap.dev / admin_dev_password_123)")
Write-Host ("  supplier  http://localhost:" + $script:LeapPorts['supplier'])
Write-Host ("  hub       http://localhost:" + $script:LeapPorts['hub'])
if (-not $NoStorefront) { Write-Host ("  website   http://localhost:" + $storefrontPort) }
if ($phoneUrl) { Write-Host ("  the phone app talks to  " + $phoneUrl) }
Write-Host "Press Ctrl+F5 in the browser the first time. To stop everything:  scripts\start-all.cmd -Stop" -ForegroundColor Gray
Exit-All 0
