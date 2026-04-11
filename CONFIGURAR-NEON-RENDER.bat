@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Configurar DATABASE_URL - Neon + Render
cls
echo.
echo ════════════════════════════════════════════════════════════
echo   Neon + Render: memoria en la nube para los reportes
echo ════════════════════════════════════════════════════════════
echo.
echo  PASOS RAPIDOS (detalle en NEON-Y-RENDER.md):
echo.
echo   1) Neon: copia la "Connection string" del proyecto.
echo   2) Render: tu servicio web -^> Environment -^> Add
echo        Key:  DATABASE_URL
echo        Value: (pega la cadena completa)
echo   3) Save -^> Manual Deploy -^> revisa Logs: debe decir PostgreSQL.
echo.
echo Abriendo Neon y Render en el navegador...
echo.
start "" "https://console.neon.tech/"
timeout /t 2 /nobreak >nul
start "" "https://dashboard.render.com/"
echo Listo. Cuando guardes la variable en Render, espera el deploy.
echo.
pause
