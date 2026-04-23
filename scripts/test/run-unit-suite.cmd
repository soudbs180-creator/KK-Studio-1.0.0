@echo off
setlocal enabledelayedexpansion

for %%F in (tests\unit\*.test.ts) do (
  echo Running %%F
  node --import ./scripts/test/set-log-level.mjs --test --test-concurrency=1 --test-isolation=none "%%F"
  if errorlevel 1 (
    exit /b 1
  )
)

exit /b 0
