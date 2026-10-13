@echo off
rem Double-click to find out why nothing loads after signing in. Runs scripts\check-data-loading.ps1 (it only reads).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-data-loading.ps1" %*
echo.
pause
