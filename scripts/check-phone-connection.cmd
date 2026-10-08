@echo off
rem Double-click to find out why the phone cannot reach the backend. Run scripts\check-phone-connection.ps1.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-phone-connection.ps1" %*
echo.
pause
