@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Llevar app a internet - automatico
echo.
echo ========================================
echo   LLEVAR APP A INTERNET (automatico)
echo ========================================
echo.

:: 1) Git: subir codigo a GitHub
if not exist ".git" (
  echo [1/3] Iniciando Git y subiendo a GitHub...
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  echo.
  set /p GITHUB_USER="Escribe tu USUARIO de GitHub (ej: jperez): "
  if "!GITHUB_USER!"=="" (
    echo Falta usuario. Crea el repo en github.com: power-plant-reports
    echo Luego ejecuta de nuevo este archivo.
    goto :abrir
  )
  git remote add origin https://github.com/!GITHUB_USER!/power-plant-reports.git
  echo Subiendo...
  git push -u origin main
  if errorlevel 1 (
    echo.
    echo Si pide contrasena: en GitHub no uses la de la cuenta.
    echo Ve a GitHub - Settings - Developer settings - Personal access tokens.
    echo Genera un token con permiso "repo" y usalo como contrasena.
    pause
  )
) else (
  echo [1/3] Subiendo ultimos cambios a GitHub...
  git remote -v 2>nul | find "origin" >nul
  if errorlevel 1 (
    set /p GITHUB_USER="Tu usuario de GitHub: "
    git remote add origin https://github.com/!GITHUB_USER!/power-plant-reports.git
  )
  git add .
  git commit -m "Update" 2>nul
  git push -u origin main 2>nul
  if errorlevel 1 git push origin main 2>nul
)

echo.
echo [2/3] Abriendo Render en el navegador...
start "" "https://dashboard.render.com/select-repo?type=web"
timeout /t 2 /nobreak >nul

echo [3/3] Abriendo instrucciones (solo 6 pasos)...
start notepad "%~dp0DEPLOY-PASOS-RENDER.txt"

echo.
echo ========================================
echo   Listo. Sigue los 6 pasos en el
echo   archivo de texto que se abrio.
echo   Tu app quedara en:
echo   https://power-plant-reports.onrender.com
echo ========================================
echo.
pause
exit /b 0

:abrir
echo Abriendo Render...
start "" "https://dashboard.render.com/select-repo?type=web"
start notepad "%~dp0DEPLOY-PASOS-RENDER.txt"
pause
