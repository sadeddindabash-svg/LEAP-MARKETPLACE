# Shared helpers for start-leap.ps1 and stop-leap.ps1. ASCII only on purpose: Windows PowerShell 5.1 reads a script that has no byte-order mark
# in the machine's legacy code page, which mangles anything else.

$script:LeapPorts = [ordered]@{ backend = 4000; admin = 5173; supplier = 5174; hub = 5175 }

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
function Wait-ForUrl([string]$Url, [int]$TimeoutSeconds = 40, [scriptblock]$Accept = { param($r) $true }) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
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
  Start-Process -FilePath $shellPath -ArgumentList ('-NoExit -NoProfile -Command "' + $inner + '"') | Out-Null
}
