@echo off
setlocal enabledelayedexpansion

for %%F in (tests\unit\*.test.ts) do (
  echo Running %%F
  node scripts/test/run-tests.mjs none "%%F"
  if errorlevel 1 (
    exit /b 1
  )
)

exit /b 0
