# Poner la app online (Render) – paso a paso

Al terminar tendrás una **URL pública** (ej: `https://power-plant-reports.onrender.com`) que funciona desde PC y móvil, sin misma red ni tener tu PC encendido.

---

## Parte 1: Subir el proyecto a GitHub

### 1.1 Instalar Git (si no lo tienes)

- Descarga: https://git-scm.com/download/win  
- Instala con opciones por defecto.

### 1.2 Crear cuenta y repositorio en GitHub

1. Entra en **https://github.com** e inicia sesión (o crea cuenta gratis).
2. Clic en **+** (arriba derecha) → **New repository**.
3. **Repository name:** `power-plant-reports` (o el nombre que quieras).
4. Deja **Public**. No marques "Add a README".
5. Clic en **Create repository**.
6. En la página del repo verás una URL. Cópiala, será algo como:
   ```text
   https://github.com/TU_USUARIO/power-plant-reports.git
   ```
   (Sustituye `TU_USUARIO` por tu usuario de GitHub.)

### 1.3 Subir el código desde tu PC

1. Abre **Command Prompt** (cmd). No uses PowerShell.
2. Ve a la carpeta del proyecto:
   ```cmd
   cd /d "C:\Users\223094060\OneDrive - General Electric International, Inc\Desktop\Round"
   ```
3. Inicializa Git y haz el primer commit:
   ```cmd
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   ```
4. Conecta con tu repo (cambia la URL por la tuya de 1.2):
   ```cmd
   git remote add origin https://github.com/TU_USUARIO/power-plant-reports.git
   ```
5. Sube el código:
   ```cmd
   git push -u origin main
   ```
   Si pide usuario y contraseña: en GitHub ya no se usa contraseña; usa **Personal Access Token**. En GitHub: **Settings → Developer settings → Personal access tokens → Generate new token**. Marca `repo` y genera. Usa ese token como contraseña al hacer `git push`.

---

## Parte 2: Desplegar en Render

1. Entra en **https://render.com** e inicia sesión (o regístrate gratis con GitHub).
2. Clic en **New +** → **Web Service**.
3. Conecta GitHub si no está conectado: **Connect GitHub** y autoriza.
4. En **Repository** elige **power-plant-reports** (tu repo).
5. **Name:** `power-plant-reports` (o el que quieras).
6. **Region:** el más cercano a ti.
7. **Branch:** `main`.
8. **Build Command:** `npm install`
9. **Start Command:** `npm start`
10. **Instance type:** Free.
11. Clic en **Create Web Service**.

Render instalará dependencias y arrancará la app. En 2–5 minutos verás **Your service is live at** con una URL como:

```text
https://power-plant-reports.onrender.com
```

Esa es tu **URL online**. Compártela por WhatsApp, email o Teams; quien la abra (PC o móvil, cualquier red) verá la app.

---

## Resumen

| Paso | Dónde | Qué hacer |
|------|--------|-----------|
| 1 | GitHub | Crear repo `power-plant-reports` |
| 2 | cmd (carpeta Round) | `git init`, `git add .`, `git commit -m "Initial commit"`, `git branch -M main` |
| 3 | cmd | `git remote add origin https://github.com/TU_USUARIO/power-plant-reports.git` |
| 4 | cmd | `git push -u origin main` (usar token si pide contraseña) |
| 5 | Render | New → Web Service → repo → Build: `npm install`, Start: `npm start` → Create |
| 6 | Render | Copiar la URL que te dan y compartirla |

**Nota (plan gratis):** Si Render reinicia el servicio, los reportes y archivos subidos pueden borrarse. La app seguirá funcionando; solo se pierden los datos hasta que añadas base de datos o almacenamiento externo.
