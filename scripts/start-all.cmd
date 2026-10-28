@echo off
rem Double-click to start EVERYTHING: backend, the three portals, the website and the phone app. Add -NoPhone to skip the phone, or -Stop to stop everything.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1" %*
echo.
pause
