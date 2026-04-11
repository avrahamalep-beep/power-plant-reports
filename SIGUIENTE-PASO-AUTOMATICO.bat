@echo off
cd /d "%~dp0"
title Siguiente paso automatico - Deploy Render
chcp 65001 >nul
echo.
echo ========================================
echo   SIGUIENTE PASO (automatico)
echo ========================================
echo.

echo [0/4] npm install...
call npm install
if errorlevel 1 (
  echo ERROR npm install
  pause
  exit /b 1
)

echo.
echo [1/4] Subiendo cambios a GitHub (si hay algo nuevo)...
git add -A
git diff --staged --quiet
if errorlevel 1 (
  git commit -m "chore: auto deploy trigger"
)
git push origin main
if errorlevel 1 (
  echo.
  echo ERROR: no se pudo hacer push. Revisa Git / token.
  pause
  exit /b 1
)
echo OK - push hecho. Render desplegara solo en 2-5 min si Auto-Deploy esta activo.
echo.

echo [2/4] Abriendo panel de Render (estado del deploy)...
start "" "https://dashboard.render.com"

timeout /t 2 /nobreak >nul

echo [3/4] Abriendo la app online...
start "" "https://power-plant-reports.onrender.com"

echo.
echo [4/4] Listo.
echo - Si el build falla: Render - tu servicio - Logs
echo - Primera carga gratis puede tardar 1-3 minutos
echo - Flujo completo ^(env + Neon^): HAZLO-AUTOMATICO.bat
echo.
pause
