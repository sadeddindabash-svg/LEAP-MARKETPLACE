@echo off
rem Double-click to check the mobile app (flutter pub get, analyze, test) and read the result. Needs Flutter installed.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0check-mobile.ps1" %*
echo.
pause
