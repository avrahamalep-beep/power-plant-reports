@echo off
cd /d "%~dp0"
echo Push a GitHub (carpeta del proyecto ya fijada automaticamente)
echo.
git status -sb
git push origin main
if errorlevel 1 (
  echo.
  echo Fallo: sin conexion a github.com (proxy/firewall/VPN).
  echo Prueba desde casa, VPN, o GitHub Desktop.
) else (
  echo OK - codigo en GitHub.
)
pause
