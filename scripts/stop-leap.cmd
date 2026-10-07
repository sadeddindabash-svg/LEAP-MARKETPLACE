@echo off
rem Double-click to stop Leap. Runs scripts\stop-leap.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-leap.ps1" %*
echo.
pause
