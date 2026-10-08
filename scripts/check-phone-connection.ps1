<#
.SYNOPSIS
  Finds out why a phone cannot reach the Leap backend ("no internet connection" / "took too long" in the buyer or hub app), and says what to do.

.DESCRIPTION
  Checks, in order: (1) the backend answers on this PC; (2) which network addresses this PC has now, and whether the address built into the app
  is still one of them; (3) the backend is listening for OTHER devices, not only for this PC; (4) Windows Firewall lets other devices in on the
  port. Then it prints the one thing to do next. With -FixFirewall (run PowerShell AS ADMINISTRATOR) it also opens the port and makes the Wi-Fi
  network "Private", which is what usually blocks a phone.

.PARAMETER AppAddress
  The address the app was built with (default 192.168.0.210: the one in the --dart-define=API_BASE_URL used to build the apps).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\check-phone-connection.ps1
  powershell -ExecutionPolicy Bypass -File scripts\check-phone-connection.ps1 -FixFirewall
#>
[CmdletBinding()]
param(
  [string]$AppAddress = '192.168.0.210',
  [int]$Port = 4000,
  [switch]$FixFirewall
)

$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_common.ps1')

function Test-Backend([string]$address) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri ("http://" + $address + ":" + $Port + "/health") -TimeoutSec 6
    return ($r.Content -match '"status"\s*:\s*"ok"')
  } catch { return $false }
}
function Has([string]$cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

$problems = @()
$next = @()

Write-Host ""
Write-Host "Leap - why can't the phone reach the backend?" -ForegroundColor White
Write-Host ""

# ---- 1. the backend on this PC ----
Write-Step "1/4  Is the backend running on this PC?"
if (Test-Backend 'localhost') { Write-Ok "Yes: http://localhost:$Port/health answers" }
else {
  Write-Fail "NO. Nothing answers on http://localhost:$Port. This is the usual cause: the backend stops when its window is closed, after stop-leap.cmd, or after a restart."
  $problems += 'backend-down'
  $next += "Run  scripts\start-leap.cmd , wait for 'Everything is up', then run this check again."
}

# ---- 2. this PC's addresses ----
Write-Step "2/4  What addresses does this PC have right now?"
$addresses = @()
if (Has 'Get-NetIPAddress') {
  $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Bluetooth|VirtualBox|VMware' } |
    ForEach-Object { $_.IPAddress })
}
if ($addresses.Count -eq 0) { Write-Warn "Could not read this PC's addresses (is Wi-Fi connected?)." ; $problems += 'no-address' }
else { foreach ($a in $addresses) { Write-Host ("  " + $a) } }
if ($addresses.Count -gt 0) {
  if ($addresses -contains $AppAddress) { Write-Ok "The address built into the app ($AppAddress) is still this PC's address" }
  else {
    Write-Fail "This PC's address is now $($addresses -join ', ') but the app was built with $AppAddress. The app is knocking on the wrong door."
    $problems += 'address-changed'
    $next += "Rebuild the app with the new address, e.g.  flutter run --release -d <phone id> --dart-define=API_BASE_URL=http://$($addresses[0]):$Port  (and ask your router to always give this PC the same address: 'DHCP reservation')."
  }
  foreach ($a in $addresses) {
    if (Test-Backend $a) { Write-Ok "The backend answers on http://${a}:$Port from this PC" }
    elseif ($problems -notcontains 'backend-down') { Write-Fail "The backend does NOT answer on http://${a}:$Port even from this PC (it answers on localhost)."; $problems += 'not-on-network' }
  }
}

# ---- 3. who is listening ----
Write-Step "3/4  Is the backend listening for other devices?"
if (Has 'Get-NetTCPConnection') {
  $listening = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  if ($listening.Count -eq 0) { Write-Warn "Nothing is listening on port $Port." }
  else {
    $where = @($listening | ForEach-Object { $_.LocalAddress } | Sort-Object -Unique)
    Write-Host ("  listening on: " + ($where -join ', '))
    $everyone = $where | Where-Object { $_ -in @('0.0.0.0', '::') }
    if ($everyone) { Write-Ok "Yes: it accepts connections from other devices" }
    else { Write-Fail "It only listens on this PC itself ($($where -join ', ')), so a phone can never reach it."; $problems += 'local-only' ; $next += "Restart the backend with scripts\start-leap.cmd (it must not be started with a host of 127.0.0.1)." }
  }
} else { Write-Warn "Could not check (Get-NetTCPConnection is not available)." }

# ---- 4. the firewall ----
Write-Step "4/4  Does Windows Firewall let a phone in on port ${Port}?"
$category = $null
if (Has 'Get-NetConnectionProfile') {
  $profiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue)
  foreach ($p in $profiles) { Write-Host ("  network '" + $p.Name + "' (" + $p.InterfaceAlias + ") is " + $p.NetworkCategory) }
  $publicOnes = @($profiles | Where-Object { $_.NetworkCategory -eq 'Public' })
  if ($publicOnes.Count -gt 0) { $category = 'Public' }
}
$portRule = $false
if (Has 'Get-NetFirewallRule') {
  $rules = @(Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction SilentlyContinue)
  foreach ($rule in $rules) {
    $filter = Get-NetFirewallPortFilter -AssociatedNetFirewallRule $rule -ErrorAction SilentlyContinue
    if ($filter -and $filter.Protocol -eq 'TCP' -and ($filter.LocalPort -contains "$Port")) { $portRule = $true; break }
  }
}
if ($portRule) { Write-Ok "A firewall rule allows inbound TCP $Port" }
else { Write-Warn "No firewall rule opens port $Port. Windows may still let it through (a 'Node.js' prompt), but on a 'Public' network it usually blocks phones." }
if ($category -eq 'Public') { Write-Fail "Your Wi-Fi is set to 'Public'. Windows blocks other devices on Public networks by default."; $problems += 'public-network' }
if (($category -eq 'Public') -or (-not $portRule)) { $next += "Run this script again as Administrator with -FixFirewall: it opens port $Port and sets your Wi-Fi to Private." }

if ($FixFirewall) {
  Write-Host ""
  $isAdmin = $false
  try { $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } catch { }
  if (-not $isAdmin) { Write-Fail "-FixFirewall needs PowerShell opened AS ADMINISTRATOR (right-click PowerShell, Run as administrator)." }
  else {
    if (-not $portRule) { New-NetFirewallRule -DisplayName "Leap API $Port" -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null; Write-Ok "Opened inbound TCP $Port" }
    foreach ($p in @(Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' })) { Set-NetConnectionProfile -InterfaceIndex $p.InterfaceIndex -NetworkCategory Private; Write-Ok ("Set '" + $p.Name + "' to Private") }
    Write-Host "  Now try the phone again."
  }
}

# ---- the verdict ----
Write-Host ""
Write-Host "Result" -ForegroundColor White
if ($problems.Count -eq 0) {
  Write-Ok "Everything on this PC looks right."
  $phoneAddress = $AppAddress
  if ($addresses.Count -gt 0 -and ($addresses -notcontains $AppAddress)) { $phoneAddress = $addresses[0] }
  Write-Host "  NEXT: on the PHONE (same Wi-Fi, not mobile data) open Chrome and go to:   http://${phoneAddress}:$Port/health"
  Write-Host "    - It shows  `"status`":`"ok`"  -> the network is fine; the problem is inside the app (tell me what it shows)."
  Write-Host "    - It does not load        -> your ROUTER does not let devices talk to each other (common on mobile-operator routers). Use the USB cable instead:"
  Write-Host "        adb reverse tcp:$Port tcp:$Port"
  Write-Host "        flutter run --release -d <phone id> --dart-define=API_BASE_URL=http://localhost:$Port"
  exit 0
}
foreach ($step in $next) { Write-Host ("  NEXT: " + $step) }
exit 1
