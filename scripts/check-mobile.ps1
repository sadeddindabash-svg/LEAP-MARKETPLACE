<#
.SYNOPSIS
  Checks the mobile app: flutter pub get, flutter analyze, flutter test, and tells you in plain words whether it is fine.

.DESCRIPTION
  Needs Flutter installed (the  flutter  command must work in a PowerShell window). Runs in apps\mobile. Everything Flutter prints is also saved in
  logs\mobile-check.log, so it can be sent if something is wrong. Errors from analyze or a failing test make this report FAIL; warnings and hints are shown
  but do not.

.PARAMETER SkipTests
  Only analyze, do not run the tests.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\check-mobile.ps1
#>
[CmdletBinding()]
param([switch]$SkipTests)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$root = Split-Path -Parent $PSScriptRoot
$mobileDir = Join-Path $root (Join-Path 'apps' 'mobile')
$logDir = Join-Path $root 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir 'mobile-check.log'
$log = New-Object System.Collections.Generic.List[string]

Write-Host ""
Write-Host "Leap - checking the mobile app" -ForegroundColor White
if (-not (Test-Path -LiteralPath $mobileDir)) { Write-Fail ("The mobile app folder was not found: " + $mobileDir); exit 1 }
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
  Write-Fail "The  flutter  command was not found. Install Flutter (https://docs.flutter.dev/get-started/install), then open a NEW PowerShell window and try again."
  exit 1
}

# Runs flutter with the given arguments inside apps\mobile; returns its lines (plain text) and exit code. Windows PowerShell 5.1 turns anything a program writes to its
# error output into a script-stopping error when ErrorActionPreference is 'Stop', so relax it for the call and look at the exit code instead.
function Invoke-Flutter([string[]]$FlutterArgs) {
  Push-Location -LiteralPath $mobileDir
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $lines = @(& flutter @FlutterArgs 2>&1 | ForEach-Object { ConvertTo-PlainLine $_ })
    $exit = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
    Pop-Location
  }
  $log.Add(("=== flutter " + ($FlutterArgs -join ' ') + "  (exit " + $exit + ")")); foreach ($l in $lines) { $log.Add($l) }
  return @{ Lines = $lines; Exit = $exit }
}

$failed = $false

Write-Step "1/3  flutter pub get..."
$get = Invoke-Flutter @('pub', 'get')
if ($get.Exit -ne 0) {
  Write-Fail "flutter pub get failed (it needs an internet connection to fetch the app's packages). Last lines:"
  foreach ($l in ($get.Lines | Select-Object -Last 8)) { Write-Host ("    | " + $l) -ForegroundColor DarkGray }
  Set-Content -LiteralPath $logFile -Value $log
  Write-Host ("  Everything Flutter printed is in " + $logFile)
  exit 1
}
Write-Ok "packages are up to date"

Write-Step "2/3  flutter analyze..."
$analyze = Invoke-Flutter @('analyze')
$issues = @($analyze.Lines | Where-Object { $_ -match '^\s*(error|warning|info)\s+[^\w\s]' })
$errors = @($issues | Where-Object { $_ -match '^\s*error\s' })
$warnings = @($issues | Where-Object { $_ -match '^\s*warning\s' })
$hints = @($issues | Where-Object { $_ -match '^\s*info\s' })
if ($errors.Count -eq 0 -and $analyze.Exit -ne 0 -and $issues.Count -eq 0) {
  Write-Fail "flutter analyze stopped with an error that is not a code issue. Last lines:"
  foreach ($l in ($analyze.Lines | Select-Object -Last 8)) { Write-Host ("    | " + $l) -ForegroundColor DarkGray }
  $failed = $true
} elseif ($errors.Count -eq 0) {
  Write-Ok ("no errors (" + $warnings.Count + " warning(s), " + $hints.Count + " hint(s))")
} else {
  Write-Fail ($errors.Count.ToString() + " error(s) found:")
  foreach ($l in ($errors | Select-Object -First 15)) { Write-Host ("    | " + $l.Trim()) -ForegroundColor Red }
  if ($errors.Count -gt 15) { Write-Host ("    | ... and " + ($errors.Count - 15) + " more (all in " + $logFile + ")") -ForegroundColor Red }
  if ($errors | Where-Object { $_ -match 'add_vehicle_screen\.dart' }) {
    Write-Warn "add_vehicle_screen.dart is an OLD screen that nothing uses any more (it calls functions that no longer exist). It can simply be deleted:  del apps\mobile\lib\features\garage\add_vehicle_screen.dart   then run this again."
  }
  $failed = $true
}
if ($warnings.Count -gt 0) { foreach ($l in ($warnings | Select-Object -First 5)) { Write-Host ("    | " + $l.Trim()) -ForegroundColor Yellow } }

if ($SkipTests) {
  Write-Step "3/3  flutter test: skipped (-SkipTests)"
} else {
  Write-Step "3/3  flutter test..."
  $test = Invoke-Flutter @('test')
  $summary = @($test.Lines | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 1)
  if ($test.Exit -eq 0) {
    Write-Ok ("tests passed" + $(if ($summary.Count -gt 0) { "  (" + $summary[0].Trim() + ")" } else { "" }))
  } else {
    Write-Fail "some tests failed or could not run. The failures:"
    $shown = @($test.Lines | Where-Object { $_ -match '\[E\]|Expected:|Actual:|Error:|failed' } | Select-Object -First 12)
    foreach ($l in $shown) { Write-Host ("    | " + $l.Trim()) -ForegroundColor Red }
    if ($summary.Count -gt 0 -and ($shown -notcontains $summary[0])) { Write-Host ("    | " + $summary[0].Trim()) -ForegroundColor Red }
    $failed = $true
  }
}

Set-Content -LiteralPath $logFile -Value $log
Write-Host ""
if ($failed) {
  Write-Fail ("The mobile app check FAILED. Everything Flutter printed is in " + $logFile + "  - send it if you need help.")
  exit 1
}
Write-Host "The mobile app check PASSED." -ForegroundColor Green
exit 0
