@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Actualizar la web — Power plant reports
echo.
echo  Actualizar la web = subir codigo a GitHub y abrir Render + la app.
echo  (Es lo mismo que HAZLO-AUTOMATICO.bat)
echo.
call "%~dp0HAZLO-AUTOMATICO.bat"
