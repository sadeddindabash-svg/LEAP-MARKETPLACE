# Shared helpers for start-leap.ps1 and stop-leap.ps1. ASCII only on purpose: Windows PowerShell 5.1 reads a script that has no byte-order mark
# in the machine's legacy code page, which mangles anything else.

$script:LeapPorts = [ordered]@{ backend = 4000; admin = 5173; supplier = 5174; hub = 5175 }
# Packages the backend needs that may not be installed yet on a PC that received the Excel import by patch zip (start-leap installs them if they are missing).
$script:LeapApiExtras = @('exceljs', 'jszip')

function Write-Step([string]$Text)  { Write-Host $Text -ForegroundColor Cyan }
function Write-Ok([string]$Text)    { Write-Host ("  [OK] " + $Text) -ForegroundColor Green }
function Write-Warn([string]$Text)  { Write-Host ("  [!!] " + $Text) -ForegroundColor Yellow }
function Write-Fail([string]$Text)  { Write-Host ("  [XX] " + $Text) -ForegroundColor Red }

# Host and port of the database, read from services\api\.env (DATABASE_URL). Falls back to localhost:5432.
function Get-DatabaseEndpoint([string]$ApiDir) {
  $endpoint = @{ Host = 'localhost'; Port = 5432 }
  $envFile = Join-Path $ApiDir '.env'
  if (Test-Path -LiteralPath $envFile) {
    $line = Select-String -LiteralPath $envFile -Pattern '^\s*DATABASE_URL\s*=\s*(.+)$' | Select-Object -First 1
    if ($line) {
      $url = $line.Matches[0].Groups[1].Value.Trim().Trim('"').Trim("'")
      if ($url -match '@([^:/\s]+)(?::(\d+))?/') {
        $endpoint.Host = $Matches[1]
        if ($Matches[2]) { $endpoint.Port = [int]$Matches[2] }
      }
    }
  }
  return $endpoint
}

function Test-TcpPort([string]$HostName, [int]$Port, [int]$TimeoutMs = 1500) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $task = $client.ConnectAsync($HostName, $Port)
    return ($task.Wait($TimeoutMs) -and $client.Connected)
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

# Polls a URL until it answers 200 (and, optionally, the answer passes $Accept). Returns the response, or $null on timeout.
# $GiveUp is checked on every round: when it returns $true the wait ends at once (used to stop waiting for a backend whose log already shows why it crashed).
function Wait-ForUrl([string]$Url, [int]$TimeoutSeconds = 40, [scriptblock]$Accept = { param($r) $true }, [scriptblock]$GiveUp = { $false }) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (& $GiveUp) { return $null }
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if (& $Accept $response) { return $response }
    } catch { }
    Start-Sleep -Milliseconds 700
  }
  return $null
}

# Who is listening on a port (process ids), or an empty list.
function Get-ListeningProcessIds([int]$Port) {
  if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { return @() }
  return @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
}

# Stops whatever is listening on a port, but ONLY if it is a node process (our own servers). Anything else is left alone and reported.
# Returns $true when the port is free afterwards.
function Stop-LeapPort([string]$Name, [int]$Port) {
  $ids = Get-ListeningProcessIds $Port
  if ($ids.Count -eq 0) { return $true }
  foreach ($id in $ids) {
    $process = Get-Process -Id $id -ErrorAction SilentlyContinue
    $processName = if ($process) { $process.ProcessName } else { 'unknown' }
    if ($processName -notmatch '^node(\.exe)?$') {
      Write-Fail ("Port $Port ($Name) is used by '$processName' (process $id), which is not a node process. Not stopping it: close it yourself, or free the port.")
      return $false
    }
    try {
      Stop-Process -Id $id -Force -ErrorAction Stop
      Write-Ok ("Stopped the old $Name (node, process $id, port $Port)")
    } catch {
      Write-Fail ("Could not stop process $id on port ${Port}: " + $_.Exception.Message)
      return $false
    }
  }
  for ($i = 0; $i -lt 20; $i++) {
    if ((Get-ListeningProcessIds $Port).Count -eq 0) { return $true }
    Start-Sleep -Milliseconds 300
  }
  Write-Fail ("Port $Port is still in use after stopping its process.")
  return $false
}

# Opens a command in its own window (so each server's output stays visible and the window can be closed to stop it).
function Start-InNewWindow([string]$Title, [string]$Directory, [string]$Command) {
  $shellPath = (Get-Process -Id $PID).Path
  $dir = $Directory -replace "'", "''"
  $inner = "try { `$Host.UI.RawUI.WindowTitle = '$Title' } catch { }; Set-Location -LiteralPath '$dir'; $Command"
  # -ExecutionPolicy Bypass: the new window must be allowed to run a script file too (run-backend.ps1); the window start-leap.cmd opened has it, a new one does not inherit it.
  Start-Process -FilePath $shellPath -ArgumentList ('-NoExit -NoProfile -ExecutionPolicy Bypass -Command "' + $inner + '"') | Out-Null
}

# Names from $Names that are NOT installed in <Dir>\node_modules.
function Get-MissingPackages([string]$Dir, [string[]]$Names) {
  $missing = @()
  foreach ($name in $Names) {
    if (-not (Test-Path -LiteralPath (Join-Path $Dir (Join-Path 'node_modules' (Join-Path $name 'package.json'))))) { $missing += $name }
  }
  return $missing
}

# The last lines of a log file, indented, so the reason a server did not start is shown right here instead of "read its window". Returns those lines.
function Show-LogTail([string]$Path, [int]$Lines = 25) {
  if (-not (Test-Path -LiteralPath $Path)) { Write-Warn ("No log was written (" + $Path + ")."); return @() }
  $tail = @(Get-Content -LiteralPath $Path -Tail $Lines -ErrorAction SilentlyContinue)
  foreach ($line in $tail) { Write-Host ("    | " + $line) -ForegroundColor DarkGray }
  return $tail
}

# Reads what a server printed when it failed to start and says in plain words what is wrong. Returns $null for anything it does not recognise.
# Kind 'module' also carries MissingModule: the package name only (never a path), so it can be installed.
function Get-StartupHint([string[]]$Lines) {
  $text = ($Lines -join "`n")
  if ($text -match "Cannot find module '(@[^'/]+/[^'/]+|[^'./\\@][^'/]*)") {
    return @{ Kind = 'module'; MissingModule = $Matches[1]; Text = ("A package the backend needs is not installed: " + $Matches[1] + ".") }
  }
  if ($text -match 'EADDRINUSE') { return @{ Kind = 'port'; Text = "The backend's port is already used by another program. Close the old backend window (or run scripts\stop-leap.cmd) and start again." } }
  if ($text -match 'password authentication failed') { return @{ Kind = 'database'; Text = "The database refused the user name or password. Check DATABASE_URL in services\api\.env." } }
  if ($text -match 'ECONNREFUSED' -and $text -match ':5\d{3}') { return @{ Kind = 'database'; Text = "The backend could not reach the database. Check that PostgreSQL is running and that the port in services\api\.env is right." } }
  if ($text -match '(column|relation|table) "[^"]+"( of relation "[^"]+")? does not exist') { return @{ Kind = 'migration'; Text = "The database is missing something this version needs: run  node db\migrate.js  in services\api, then start again." } }
  return $null
}

# May this package be installed automatically? Only plain package names that the backend is known to need: the extras above, or anything listed in services\api\package.json.
function Test-InstallablePackage([string]$ApiDir, [string]$Name) {
  if ($Name -notmatch '^(@[a-z0-9._-]+/)?[a-z0-9._-]+$') { return $false }
  if ($script:LeapApiExtras -contains $Name) { return $true }
  $packageFile = Join-Path $ApiDir 'package.json'
  if (-not (Test-Path -LiteralPath $packageFile)) { return $false }
  try {
    $json = Get-Content -LiteralPath $packageFile -Raw | ConvertFrom-Json
    foreach ($section in 'dependencies', 'optionalDependencies') {
      if ($json.$section -and ($json.$section.PSObject.Properties.Name -contains $Name)) { return $true }
    }
  } catch { }
  return $false
}

# One line of a program's output as plain text. PowerShell wraps each line a program writes to its ERROR output in an error record (and shows an empty one as
# "System.Management.Automation.RemoteException"): this turns either kind back into the text the program wrote.
function ConvertTo-PlainLine($Item) {
  $text = if ($Item -is [System.Management.Automation.ErrorRecord]) { $Item.Exception.Message } else { [string]$Item }
  if ($text -eq 'System.Management.Automation.RemoteException') { return '' }
  return $text
}

