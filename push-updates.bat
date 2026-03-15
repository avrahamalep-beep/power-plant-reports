@echo off
cd /d "%~dp0"
echo.
echo --- Subir cambios a GitHub ---
echo.

git remote -v 2>nul | find "origin" >nul
if errorlevel 1 (
  echo Aun no esta conectado a GitHub.
  set /p GITHUB_USER="Tu usuario de GitHub: "
  git remote add origin https://github.com/%GITHUB_USER%/power-plant-reports.git
  echo.
)

git add .
git status
echo.
git commit -m "Update"
git branch -M main 2>nul
echo.
echo Subiendo a GitHub...
git push -u origin main
if errorlevel 1 git push origin main
echo.
if errorlevel 1 (
  echo Si falla, en GitHub crea el repo "power-plant-reports" y vuelve a ejecutar.
  echo Si pide contraseña, usa un Personal Access Token de GitHub.
)
echo.
pause
