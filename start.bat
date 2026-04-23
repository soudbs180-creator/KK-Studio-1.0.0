@echo off
chcp 65001 >nul
cls
cd /d "%~dp0"

echo ================================================
echo    KK Studio - Stable Dev Server
echo ================================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found
    echo Please install: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Show Node version
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [INFO] Node.js: %NODE_VERSION%

REM Check dependencies
if not exist "node_modules" (
    echo [INSTALL] Installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Install failed
        pause
        exit /b 1
    )
)

REM Start server
echo.
echo [START] Starting stable dev server...
echo.
call npm run clean
if %errorlevel% neq 0 (
    echo [ERROR] Clean failed
    pause
    exit /b 1
)
echo.
echo ----------------------------------------
echo  URL: http://localhost:3000
echo  Stop: npm run dev:stop
echo  Logs: .kk-local\logs
echo ----------------------------------------
echo.
echo [INFO] Keep this window open while using http://localhost:3000
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/dev-launch.ps1 -Restart -SkipVite
if %errorlevel% neq 0 (
    echo [ERROR] Local API bootstrap failed
    pause
    exit /b 1
)

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:3000'"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/run-vite-dev.ps1
