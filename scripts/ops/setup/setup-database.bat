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

set "BOOTSTRAP_SQL=scripts\ops\postgres\bootstrap-kk-vps.sql"
set "AI_SCOPE_MIGRATION=infrastructure\database\migrations\016_ai_assistant_user_scope.sql"
set "AGENT_RUN_EVENT_MIGRATION=infrastructure\database\migrations\020_agent_run_events.sql"
set "AGENT_SESSION_MIGRATION=infrastructure\database\migrations\021_agent_sessions.sql"
set "AGENT_RUN_SESSION_BINDING_MIGRATION=infrastructure\database\migrations\022_agent_run_session_binding.sql"
set "AGENT_RUN_SEMANTIC_EVENT_MIGRATION=infrastructure\database\migrations\023_agent_run_semantic_events.sql"
if not exist "%BOOTSTRAP_SQL%" (
  echo Missing bootstrap SQL: %BOOTSTRAP_SQL%
  exit /b 1
)
if not exist "%AI_SCOPE_MIGRATION%" (
  echo Missing AI assistant scope migration: %AI_SCOPE_MIGRATION%
  exit /b 1
)
if not exist "%AGENT_RUN_EVENT_MIGRATION%" (
  echo Missing Agent Run event migration: %AGENT_RUN_EVENT_MIGRATION%
  exit /b 1
)
if not exist "%AGENT_SESSION_MIGRATION%" (
  echo Missing Agent Session migration: %AGENT_SESSION_MIGRATION%
  exit /b 1
)
if not exist "%AGENT_RUN_SESSION_BINDING_MIGRATION%" (
  echo Missing Agent Run Session binding migration: %AGENT_RUN_SESSION_BINDING_MIGRATION%
  exit /b 1
)
if not exist "%AGENT_RUN_SEMANTIC_EVENT_MIGRATION%" (
  echo Missing Agent Run semantic event migration: %AGENT_RUN_SEMANTIC_EVENT_MIGRATION%
  exit /b 1
)

echo [1/7] Checking psql...
where psql >nul 2>&1
if %errorlevel% neq 0 (
  echo psql was not found in PATH. Install PostgreSQL client tools on this machine or run the SQL on the VPS.
  exit /b 1
)

echo [2/7] Applying VPS PostgreSQL bootstrap...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%BOOTSTRAP_SQL%"
if %errorlevel% neq 0 (
  echo Failed to apply bootstrap SQL.
  exit /b 1
)

echo [3/7] Applying AI assistant user scope migration...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%AI_SCOPE_MIGRATION%"
if %errorlevel% neq 0 (
  echo Failed to apply AI assistant user scope migration.
  exit /b 1
)

echo [4/7] Applying Agent Run event migration...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%AGENT_RUN_EVENT_MIGRATION%"
if %errorlevel% neq 0 (
  echo Failed to apply Agent Run event migration.
  exit /b 1
)

echo [5/7] Applying Agent Session migration...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%AGENT_SESSION_MIGRATION%"
if %errorlevel% neq 0 (
  echo Failed to apply Agent Session migration.
  exit /b 1
)

echo [6/7] Applying Agent Run Session binding migration...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%AGENT_RUN_SESSION_BINDING_MIGRATION%"
if %errorlevel% neq 0 (
  echo Failed to apply Agent Run Session binding migration.
  exit /b 1
)

echo [7/7] Applying Agent Run semantic event migration...
psql "%DATABASE_URL%" -v ON_ERROR_STOP=1 -f "%AGENT_RUN_SEMANTIC_EVENT_MIGRATION%"
if %errorlevel% neq 0 (
  echo Failed to apply Agent Run semantic event migration.
  exit /b 1
)

echo.
echo Done.
endlocal
