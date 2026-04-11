@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title HAZLO AUTOMATICO — deps, .env, push, navegador
chcp 65001 >nul
color 0A
echo.
echo  ============================================================
echo    HAZLO AUTOMATICO
echo  ============================================================
echo    Carpeta: %CD%
echo    Un clic: npm install, .env si falta, git, abrir Neon/Render/app
echo  ============================================================
echo.

echo [1/6] Dependencias npm...
call npm install
if errorlevel 1 (
  color 0C
  echo.
  echo  *** ERROR: npm install fallo ^(revisa Node.js instalado^) ***
  pause
  exit /b 1
)
echo       OK.

echo.
echo [2/6] Archivo .env en tu PC ^(Render usa sus propias variables en la nube^)...
if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo       Creado .env desde .env.example
    echo       Se abre el Bloc de notas: pega DATABASE_URL ^(Neon^) y opcional SMTP_* para correo.
    start "" notepad ".env"
    timeout /t 3 /nobreak >nul
  ) else (
    echo       No existe .env.example — crea .env a mano si hace falta.
  )
) else (
  echo       .env ya existe — no se modifica.
)

echo.
echo [3/6] Rama main...
git branch -M main 2>nul

echo.
echo [4/6] Git: guardando cambios...
git add -A
git diff --staged --quiet
if errorlevel 1 (
  git commit -m "chore: auto deploy %date% %time%"
  echo       Commit creado.
) else (
  echo       Nada nuevo que commitear.
)

echo.
echo [5/6] Git: subiendo a GitHub ^(Render despliega solo si esta enlazado^)...
git push origin main
if errorlevel 1 (
  color 0C
  echo.
  echo  *** ERROR en push ***
  echo  - Si dice "Could not resolve host: github.com" = DNS o red bloquea GitHub
  echo    ^(muy comun en oficina^). Prueba hotspot movil u otra red.
  echo  - Lee: SI-GITHUB-NO-RESUELVE.md en esta carpeta
  echo  - Otros fallos: internet / VPN / firewall
  echo  - Si pide login: GitHub - Personal Access Token
  echo.
  pause
  exit /b 1
)
echo       Push OK.

echo.
echo [6/6] Abriendo navegador y guia...
start "" "https://dashboard.render.com"
timeout /t 1 /nobreak >nul
start "" "https://console.neon.tech/"
timeout /t 1 /nobreak >nul
start "" "https://power-plant-reports.onrender.com"
if exist "NEON-Y-RENDER.md" (
  timeout /t 1 /nobreak >nul
  start "" "%CD%\NEON-Y-RENDER.md"
)

echo.
echo  ============================================================
echo    LISTO
echo  ============================================================
echo    - Dependencias al dia
echo    - GitHub actualizado — Render redeploya solo ^(Auto-Deploy^)
echo    - Ventanas: Render, Neon, app online, NEON-Y-RENDER.md
echo.
echo    Variables en la NUBE ^(DATABASE_URL, SMTP_*^): Render -^> tu servicio -^> Environment
echo    Atajo solo enlaces: CONFIGURAR-NEON-RENDER.bat
echo    Si GitHub no resuelve: SI-GITHUB-NO-RESUELVE.md
echo  ============================================================
echo.
pause
