<#
.SYNOPSIS
  "I can sign in but nothing loads": signs in as an admin, a supplier and a hub worker, calls the first things each portal and app loads, and shows for every
  call: did it work, how long did it take, how many items came back. Then says what that means.

.DESCRIPTION
  Changes nothing (only reads). If a seeded password was changed, pass the real one: -AdminPassword, -SupplierPassword, -HubPassword.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\check-data-loading.ps1
  powershell -ExecutionPolicy Bypass -File scripts\check-data-loading.ps1 -AdminPassword "my real password"
#>
[CmdletBinding()]
param(
  [string]$BaseUrl = 'http://localhost:4000',
  [string]$AdminEmail = 'admin@leap.dev',       [string]$AdminPassword = 'admin_dev_password_123',
  [string]$SupplierEmail = 'supplier@leap.dev', [string]$SupplierPassword = 'supplier_dev_password_123',
  [string]$HubEmail = 'hub@leap.dev',           [string]$HubPassword = 'hub_dev_password_123',
  [int]$SlowMs = 4000
)
$ErrorActionPreference = 'Continue'
. (Join-Path $PSScriptRoot '_common.ps1')

$script:errors = @(); $script:slow = @(); $script:empty = @(); $script:skipped = @(); $script:okCount = 0

# Calls one address and returns @{ ok; status; ms; body; count; message }.
function Invoke-Timed([string]$Method, [string]$Path, [string]$Token, $Body) {
  $result = @{ ok = $false; status = 0; ms = 0; body = $null; count = $null; message = '' }
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $headers = @{}
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    $params = @{ Uri = ($BaseUrl + $Path); Method = $Method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 60 }
    if ($Body) { $params['Body'] = ($Body | ConvertTo-Json -Compress); $params['ContentType'] = 'application/json' }
    $response = Invoke-WebRequest @params
    $result.ok = $true; $result.status = [int]$response.StatusCode
    try { $result.body = $response.Content | ConvertFrom-Json } catch { $result.body = $null }
  } catch {
    $result.message = $_.Exception.Message
    try { $result.status = [int]$_.Exception.Response.StatusCode } catch { }
    $text = $null
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $text = $_.ErrorDetails.Message }
    else { try { $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $text = $reader.ReadToEnd() } catch { } }
    if ($text) { try { $result.message = ($text | ConvertFrom-Json).error } catch { $result.message = $text } }
  }
  $watch.Stop(); $result.ms = [int]$watch.ElapsedMilliseconds
  if ($result.ok -and $null -ne $result.body) {
    if ($result.body -is [System.Array]) { $result.count = $result.body.Count }
    elseif ($result.body.PSObject.Properties.Name -contains 'products') { $result.count = @($result.body.products).Count }
    elseif ($result.body.PSObject.Properties.Name -contains 'items') { $result.count = @($result.body.items).Count }
  }
  return $result
}

function Show-Call([string]$Who, [string]$Path, [string]$Token) {
  $r = Invoke-Timed 'GET' $Path $Token $null
  $label = ("{0,-9} GET {1}" -f $Who, $Path)
  if (-not $r.ok) {
    Write-Fail ("$label -> " + $(if ($r.status) { "HTTP $($r.status)" } else { 'no answer' }) + " after $($r.ms) ms: " + $r.message)
    $script:errors += "$Who GET $Path"
    return
  }
  $items = ''; if ($null -ne $r.count) { $items = ", $($r.count) item(s)" }
  if ($r.ms -ge $SlowMs) { Write-Warn ("$label -> OK but SLOW: $($r.ms) ms$items"); $script:slow += "$Who GET $Path ($($r.ms) ms)" }
  else { Write-Ok ("$label -> $($r.ms) ms$items"); $script:okCount++ }
  if ($null -ne $r.count -and $r.count -eq 0) { $script:empty += "$Who GET $Path" }
}

function Sign-In([string]$Who, [string]$Email, [string]$Password) {
  $r = Invoke-Timed 'POST' '/auth/login' $null @{ email = $Email; password = $Password }
  if ($r.ok -and $r.body -and $r.body.token) { Write-Ok ("$Who signed in as $Email ($($r.ms) ms)"); return $r.body.token }
  if ($r.status -eq 401) { $script:skipped += $Who; Write-Warn "$Who could not sign in as ${Email}: wrong password (pass the real one with -${Who}Password). Skipped." }
  else { Write-Fail "$Who sign-in failed: HTTP $($r.status) $($r.message)"; $script:errors += "$Who sign-in" }
  return $null
}

Write-Host ""
Write-Host "Leap - why does nothing load after signing in?  ($BaseUrl)" -ForegroundColor White
Write-Host ""

Write-Step "1/5  Is the backend answering?"
$health = Invoke-Timed 'GET' '/health' $null $null
if (-not $health.ok) {
  Write-Fail "The backend does not answer at $BaseUrl ($($health.message)). Run scripts\start-leap.cmd, then run this again."
  exit 1
}
Write-Ok "/health answers in $($health.ms) ms"
if ($health.body.pendingMigrations -and @($health.body.pendingMigrations).Count -gt 0) { Write-Fail ("The database has migrations that were not applied: " + (@($health.body.pendingMigrations) -join ', ')); $script:errors += 'pending migrations' }

Write-Step "2/5  What the buyer app loads (no sign-in)"
Show-Call 'public' '/catalog/products' $null
Show-Call 'public' '/config/markets' $null

Write-Step "3/5  What the admin portal loads"
$admin = Sign-In 'Admin' $AdminEmail $AdminPassword
if ($admin) { foreach ($p in @('/overview', '/order', '/supplier', '/hub/flagged')) { Show-Call 'admin' $p $admin } }

Write-Step "4/5  What the supplier portal loads"
$supplier = Sign-In 'Supplier' $SupplierEmail $SupplierPassword
if ($supplier) { foreach ($p in @('/supplier/me', '/supplier/me/overview', '/supplier/me/orders', '/supplier/me/products')) { Show-Call 'supplier' $p $supplier } }

Write-Step "5/5  What the hub portal and hub app load"
$hub = Sign-In 'Hub' $HubEmail $HubPassword
if ($hub) { Show-Call 'hub' '/hub/me/shipments' $hub }

Write-Host ""
Write-Host "What this means" -ForegroundColor White
if ($script:errors.Count -gt 0) {
  Write-Fail "These calls FAILED: $($script:errors -join '; ')"
  Write-Host "  NEXT: look at the backend window (the one running start-leap) at the moment you load that page: the error is printed there. Copy that error and this output to me."
} elseif ($script:slow.Count -gt 0) {
  Write-Warn "These calls work but are SLOW: $($script:slow -join '; ')"
  Write-Host "  NEXT: slow lists are usually the pile of test data. Preview the clean-up:  cd services\api ; node scripts\remove-test-data.js   (then --apply, after the backup it prints). A phone times out after 30 seconds."
} elseif ($script:okCount -eq 0) {
  Write-Warn "Nothing could be checked (every sign-in was skipped). Pass the real passwords with -AdminPassword / -SupplierPassword / -HubPassword."
} else {
  Write-Ok "The backend delivers the data: every call that was checked worked and was fast."
  if ($script:skipped.Count -gt 0) { Write-Warn ("NOT checked (wrong password given): " + ($script:skipped -join ", ") + ". If that is the part that shows nothing, run again with its real password.") }
  if ($script:empty.Count -gt 0) { Write-Host "  These lists are genuinely EMPTY in the database (so a portal would show nothing, correctly): $($script:empty -join '; ')" ; Write-Host "  If you expected data there, it may have been removed by the test-data clean-up (node scripts\remove-test-data.js keeps a backup in services\api\backups)." }
  Write-Host "  NEXT: the problem is on the portal/app side. Open the portal, press F12, go to the Network tab, reload, and tell me which request is red (and its address). For a phone app: tell me exactly what it shows."
}
exit $(if ($script:errors.Count -gt 0) { 1 } else { 0 })
