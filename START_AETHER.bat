@echo off
cd /d "%~dp0"

rem Check whether something is already listening on port 8000 -- if AETHER
rem is already running from an earlier launch, don't start a second server
rem and don't force-open yet another tab. This is what was causing "a lot
rem of browsers" to pile up: this file used to open a new tab every single
rem time it ran, with no check for whether one was already open.
netstat -ano | findstr ":8000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
  echo AETHER already appears to be running on port 8000.
  echo Switch to that existing browser tab instead of opening a new one.
  echo ^(If you don't see it, check other open browser windows/tabs first.^)
  pause
  exit /b
)

echo Starting AETHER local server...
start "" http://localhost:8000/index.html
npx serve -l 8000
