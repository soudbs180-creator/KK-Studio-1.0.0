@echo off
chcp 65001 >nul
cd /d "%~dp0\.."
powershell -ExecutionPolicy Bypass -File scripts/dev-stop.ps1
pause
