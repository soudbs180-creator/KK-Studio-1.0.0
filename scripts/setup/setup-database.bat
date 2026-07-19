@echo off
setlocal

echo ========================================
echo KK Studio Database Setup (VPS PostgreSQL)
echo ========================================
echo.

if "%DATABASE_URL%"=="" (
  echo DATABASE_URL is required.
  echo Example: set DATABASE_URL=postgres://kk:password@127.0.0.1:5432/kkstudio
  exit /b 1
)

set "BOOTSTRAP_SQL=scripts\postgres\bootstrap-kk-vps.sql"
set "AI_SCOPE_MIGRATION=migrations\016_ai_assistant_user_scope.sql"
if not exist "%BOOTSTRAP_SQL%" (
  echo Missing bootstrap SQL: %BOOTSTRAP_SQL%
  exit /b 1
)
if not exist "%AI_SCOPE_MIGRATION%" (
  echo Missing AI assistant scope migration: %AI_SCOPE_MIGRATION%
  exit /b 1
)

echo [1/3] Checking psql...
where psql >nul 2>&1
if %errorlevel% neq 0 (
  echo psql was not found in PATH. Install PostgreSQL client tools on this machine or run the SQL on the VPS.
  exit /b 1
)

echo [2/3] Applying VPS PostgreSQL bootstrap...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%BOOTSTRAP_SQL%"
if %errorlevel% neq 0 (
  echo Failed to apply bootstrap SQL.
  exit /b 1
)

echo [3/3] Applying AI assistant user scope migration...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%AI_SCOPE_MIGRATION%"
if %errorlevel% neq 0 (
  echo Failed to apply AI assistant user scope migration.
  exit /b 1
)

echo.
echo Done.
endlocal
