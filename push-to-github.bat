@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo.
echo --- Subir proyecto a GitHub ---
echo.

if not exist ".git" (
  git init
  git add .
  git commit -m "Initial commit"
  git branch -M main
  echo.
  set /p GITHUB_USER="Escribe tu usuario de GitHub (sin espacios): "
  if "!GITHUB_USER!"=="" (
    echo No escribiste usuario. Ejecuta manualmente:
    echo   git remote add origin https://github.com/TU_USUARIO/power-plant-reports.git
    echo   git push -u origin main
    echo Reemplaza TU_USUARIO por tu usuario de GitHub.
    pause
    exit /b 0
  )
  git remote add origin https://github.com/%GITHUB_USER%/power-plant-reports.git
  echo.
  echo Subiendo a GitHub...
  git push -u origin main
  echo.
  if errorlevel 1 (
    echo Si pide contraseña, en GitHub no se usa la de la cuenta.
    echo Usa un Token: GitHub - Settings - Developer settings - Personal access tokens - Generate.
    echo Da permisos "repo" y usa el token como contraseña.
  ) else (
    echo Listo. Repo: https://github.com/%GITHUB_USER%/power-plant-reports
  )
) else (
  echo Ya existe .git. Para subir cambios usa:
  echo   git add .
  echo   git commit -m "mensaje"
  echo   git push
)

echo.
pause
