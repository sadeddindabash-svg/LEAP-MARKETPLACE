@echo off
rem Double-click to run the tests on a throwaway database. Runs scripts\run-tests.ps1 with the permission it needs.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-tests.ps1" %*
echo.
pause
