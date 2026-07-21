@echo off
chcp 65001 >nul
title KK Studio
cd /d "%~dp0\.."
call "%~dp0\..\tools\start.bat"
