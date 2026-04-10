@echo off
cd /d "%~dp0"
title Siguiente paso automatico - Deploy Render
echo.
echo ========================================
echo   SIGUIENTE PASO (automatico)
echo ========================================
echo.

echo [1/3] Subiendo cambios a GitHub (si hay algo nuevo)...
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

echo [2/3] Abriendo panel de Render (estado del deploy)...
start "" "https://dashboard.render.com"

timeout /t 2 /nobreak >nul

echo [3/3] Abriendo la app online...
start "" "https://power-plant-reports.onrender.com"

echo.
echo Listo.
echo - Si el build falla: Render - tu servicio - Logs
echo - Primera carga gratis puede tardar 1-3 minutos
echo.
pause
