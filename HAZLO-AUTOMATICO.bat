@echo off
setlocal enabledelayedexpansion
:: Siempre usa la carpeta donde esta este archivo (no hace falta cd manual)
cd /d "%~dp0"
title HAZLO AUTOMATICO - Git push + abrir app
color 0A
echo.
echo  ========================================
echo    HAZLO AUTOMATICO
echo  ========================================
echo    Carpeta: %CD%
echo    Un clic: commit + push + abrir Render y la app
echo  ========================================
echo.

echo [0/4] Rama main...
git branch -M main 2>nul

echo [1/4] Git: guardando cambios...
git add -A
git diff --staged --quiet
if errorlevel 1 (
  git commit -m "chore: auto deploy %date% %time%"
  echo       Commit creado.
) else (
  echo       Nada nuevo que commitear.
)

echo.
echo [2/4] Git: subiendo a GitHub ^(Render despliega solo si esta enlazado^)...
git push origin main
if errorlevel 1 (
  color 0C
  echo.
  echo  *** ERROR en push ***
  echo  - Si dice "Could not resolve host: github.com" = DNS o red bloquea GitHub
  echo    (muy comun en oficina). Prueba hotspot movil u otra red.
  echo  - Lee: SI-GITHUB-NO-RESUELVE.md en esta carpeta
  echo  - Otros fallos: internet / VPN / firewall
  echo  - Si pide login: GitHub - Personal Access Token
  echo.
  pause
  exit /b 1
)
echo       Push OK.

echo.
echo [3/4] Abriendo Render (panel)...
start "" "https://dashboard.render.com"

timeout /t 2 /nobreak >nul

echo [4/4] Abriendo la app online...
start "" "https://power-plant-reports.onrender.com"

echo.
echo  ========================================
echo    LISTO
echo  ========================================
echo    GitHub actualizado. Render redeploya solo.
echo.
echo    Para actualizar la web otra vez: este archivo o ACTUALIZAR-WEB.bat
echo    Si Render no clona: SI-RENDER-NO-CLONA-GITHUB.md
echo    Si GitHub no resuelve: SI-GITHUB-NO-RESUELVE.md
echo  ========================================
echo.
pause
