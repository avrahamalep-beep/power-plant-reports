@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Configurar Neon + Render + .env local
cls
echo.
echo ════════════════════════════════════════════════════════════
echo   Neon + Render + correo SMTP ^(variables en el servidor^)
echo ════════════════════════════════════════════════════════════
echo.

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo   [Auto] Creado .env desde .env.example ^(solo tu PC^).
    echo   Edita y guarda: DATABASE_URL y si quieres envio SMTP: SMTP_HOST, SMTP_USER, SMTP_PASS...
    start "" notepad ".env"
    timeout /t 2 /nobreak >nul
  )
) else (
  echo   .env ya existe en esta carpeta ^(no se sobrescribe^).
)
echo.
echo   PASOS en Render ^(detalle: NEON-Y-RENDER.md^):
echo     Environment -^> DATABASE_URL = cadena Neon
echo     Opcional: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM ^(correo con adjuntos^)
echo.
echo   Abriendo Neon, Render y la guia...
echo.
start "" "https://console.neon.tech/"
timeout /t 1 /nobreak >nul
start "" "https://dashboard.render.com/"
timeout /t 1 /nobreak >nul
if exist "NEON-Y-RENDER.md" start "" "%CD%\NEON-Y-RENDER.md"
echo Listo. Guarda variables en Render y espera el deploy.
echo.
pause
