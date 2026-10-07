@echo off
rem Double-click to start Leap. Runs scripts\start-leap.ps1 with the permission it needs.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-leap.ps1" %*
echo.
pause
