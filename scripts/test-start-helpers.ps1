# Checks the decisions start-leap.ps1 makes when the backend does not start: which message it gives for what the backend printed, and WHAT IT MAY INSTALL by itself.
# Run:  powershell -ExecutionPolicy Bypass -File scripts\test-start-helpers.ps1      (exit code 0 = all passed). ASCII only on purpose.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')
$failures = 0
function Check([string]$Name, [bool]$Ok) {
  if ($Ok) { Write-Host ("  PASS  " + $Name) -ForegroundColor Green } else { Write-Host ("  FAIL  " + $Name) -ForegroundColor Red; $script:failures++ }
}

Write-Host "What the script says for what the backend printed"
$h = Get-StartupHint @("Error: Cannot find module 'exceljs'", 'Require stack:')
Check "a missing package is recognised and named" ($h -and $h.Kind -eq 'module' -and $h.MissingModule -eq 'exceljs')
$h = Get-StartupHint @("Error: Cannot find module 'exceljs/lib/exceljs.nodejs.js'")
Check "a file inside a package gives the PACKAGE name" ($h -and $h.MissingModule -eq 'exceljs')
$h = Get-StartupHint @("Error: Cannot find module '@scope/pkg'")
Check "a scoped package keeps its scope" ($h -and $h.MissingModule -eq '@scope/pkg')
Check "a missing file of the project itself (a relative path) is NOT treated as a package" ($null -eq (Get-StartupHint @("Error: Cannot find module './routes'")))
Check "a parent folder path is not a package either" ($null -eq (Get-StartupHint @("Error: Cannot find module '../utils'")))
Check "a port already in use is recognised" ((Get-StartupHint @('Error: listen EADDRINUSE: address already in use :::4000')).Kind -eq 'port')
Check "a refused database connection is recognised" ((Get-StartupHint @('connect ECONNREFUSED 127.0.0.1:5432')).Kind -eq 'database')
Check "a wrong database password is recognised" ((Get-StartupHint @('error: password authentication failed for user "leap_dev"')).Kind -eq 'database')
Check "a missing database column or table points to the migration" ((Get-StartupHint @('error: column "version_id" of relation "user_saved_generations" does not exist')).Kind -eq 'migration')
Check "something it does not recognise gives no guess" ($null -eq (Get-StartupHint @('TypeError: something strange', 'at x (y.js:1:1)')))
Check "normal start-up lines give no guess" ($null -eq (Get-StartupHint @('Leap API listening on http://localhost:4000 (development)')))

Write-Host "What it may install by itself"
$dir = Join-Path ([System.IO.Path]::GetTempPath()) ("leap-helper-test-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $dir | Out-Null
try {
  Set-Content -LiteralPath (Join-Path $dir 'package.json') -Value '{ "name": "t", "dependencies": { "express": "4.0.0", "@scope/known": "1.0.0" } }'
  Check "the Excel import packages (exceljs, jszip) may be installed" ((Test-InstallablePackage $dir 'exceljs') -and (Test-InstallablePackage $dir 'jszip'))
  Check "a package listed in package.json may be installed" ((Test-InstallablePackage $dir 'express') -and (Test-InstallablePackage $dir '@scope/known'))
  Check "a package that is NOT listed is not installed behind the user's back" (-not (Test-InstallablePackage $dir 'left-pad'))
  Check "a path is never installed" (-not (Test-InstallablePackage $dir '../evil'))
  Check "a command line smuggled into the name is never installed" ((-not (Test-InstallablePackage $dir 'express; rm -rf x')) -and (-not (Test-InstallablePackage $dir 'express && calc')))
  Check "a Windows path is never installed" (-not (Test-InstallablePackage $dir 'C:\evil\pkg'))
  Check "an empty name is never installed" (-not (Test-InstallablePackage $dir ''))
  Check "with no package.json only the Excel import packages may be installed" ((-not (Test-InstallablePackage (Join-Path $dir 'nowhere') 'express')) -and (Test-InstallablePackage (Join-Path $dir 'nowhere') 'exceljs'))

  Write-Host "Which packages are missing"
  New-Item -ItemType Directory -Force -Path (Join-Path $dir 'node_modules\exceljs') | Out-Null
  Set-Content -LiteralPath (Join-Path $dir 'node_modules\exceljs\package.json') -Value '{}'
  $missing = @(Get-MissingPackages $dir @('exceljs', 'jszip'))
  Check "only the package that is really absent is reported" ($missing.Count -eq 1 -and $missing[0] -eq 'jszip')
  Check "nothing is reported when everything is there" (@(Get-MissingPackages $dir @('exceljs')).Count -eq 0)
} finally {
  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ""
if ($failures -gt 0) { Write-Host ("$failures check(s) FAILED") -ForegroundColor Red; exit 1 }
Write-Host "All checks passed" -ForegroundColor Green
exit 0
