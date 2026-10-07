<#
.SYNOPSIS
  Stops the Leap servers started by start-leap.ps1 (backend, admin, supplier and hub portals).
  Only node processes listening on Leap's own ports are stopped; anything else is left alone and reported.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

Write-Host ""
Write-Host "Leap - stopping" -ForegroundColor White
if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
  Write-Fail "This needs Windows PowerShell (Get-NetTCPConnection). Close the server windows by hand instead."
  exit 1
}
$stoppedAny = $false
$problem = $false
foreach ($name in $script:LeapPorts.Keys) {
  $port = $script:LeapPorts[$name]
  if ((Get-ListeningProcessIds $port).Count -eq 0) { Write-Host ("  $name (port $port): not running"); continue }
  if (Stop-LeapPort $name $port) { $stoppedAny = $true } else { $problem = $true }
}
Write-Host ""
if ($problem) { Write-Fail "Something is still running (see above)."; exit 1 }
if ($stoppedAny) { Write-Ok "Stopped. (The server windows stay open and can simply be closed.)" } else { Write-Ok "Nothing was running." }
exit 0
