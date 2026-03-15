@echo off
cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo Failed to run npm install. Run "npm install" in this folder from Command Prompt, then run start.bat again.
    pause
    exit /b 1
  )
)
echo.
echo Starting server... DO NOT CLOSE THIS WINDOW.
echo.
node server.js
echo.
echo Server stopped. Press any key to close.
pause
