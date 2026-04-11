@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Actualizar la web — Power plant reports
echo.
echo  Actualizar la web = npm install, .env si falta, push a GitHub, abrir Render + Neon + app.
echo  (Llama a HAZLO-AUTOMATICO.bat)
echo.
call "%~dp0HAZLO-AUTOMATICO.bat"
