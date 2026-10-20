# Runs the backend inside the window start-leap.ps1 opens: shows everything it prints AND saves it in a log file (so the reason for a failed start can be read
# by start-leap, and sent to the Leap team). ASCII only on purpose (Windows PowerShell 5.1 reads a script without a byte-order mark in the legacy code page).
param(
  [Parameter(Mandatory = $true)][string]$ApiDir,
  [Parameter(Mandatory = $true)][string]$LogFile
)
Set-Location -LiteralPath $ApiDir
# PowerShell wraps each line a program writes to its error output in an error record, and shows an EMPTY such line as "System.Management.Automation.RemoteException":
# turn each line back into plain text and blank those out, so the screen and the log read exactly as the backend wrote them.
& node src/index.js 2>&1 | ForEach-Object {
  $text = if ($_ -is [System.Management.Automation.ErrorRecord]) { $_.Exception.Message } else { [string]$_ }
  if ($text -eq 'System.Management.Automation.RemoteException') { $text = '' }
  $text
} | Tee-Object -FilePath $LogFile
