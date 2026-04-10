# Si Render no puede clonar GitHub (`Could not resolve host: github.com`)

Eso es un **fallo de red/DNS en los servidores de Render**, no de tu repo. A veces dura horas o días en una región.

Tienes **dos caminos** que no dependen de que Render hable con GitHub.

---

## Opción A — Fly.io (sube el código desde tu PC)

Fly **no clona** tu repo en el primer paso igual que Render: tú subes la carpeta con la CLI.

1. Cuenta en https://fly.io
2. Instala **flyctl**: https://fly.io/docs/hands-on/install-flyctl/ (Windows: `powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"`)
3. En **Command Prompt** o PowerShell, en la carpeta del proyecto:
   ```cmd
   cd /d "C:\Users\...\Desktop\Round"
   fly auth login
   fly launch --no-deploy
   ```
   Si pide nombre de app, usa uno único, ej. `power-plant-reports-tuusuario`
4. Asegura el puerto en `fly.toml`: `internal_port = 3000` (ya está en el archivo del proyecto).
5. Despliega:
   ```cmd
   fly deploy
   ```
6. Fly te dará una URL tipo `https://power-plant-reports-xxx.fly.dev` — esa es tu app online (PC y móvil, cámara con HTTPS).

**Coste:** hay tier gratuito con límites; puede pedir tarjeta para verificación.

---

## Opción B — Render con imagen Docker (sin clonar GitHub en el build)

1. En **tu PC**, con Docker instalado:
   ```cmd
   docker build -t TU_USUARIO/power-plant-reports:latest .
   docker login
   docker push TU_USUARIO/power-plant-reports:latest
   ```
2. En **Render** → **New** → **Web Service** → **Deploy an existing image from a registry**.
3. Pega la imagen: `docker.io/TU_USUARIO/power-plant-reports:latest`
4. Puerto **3000**, Start command vacío (el CMD del Dockerfile ya arranca Node).

Render descarga la imagen de **Docker Hub**, no de GitHub.

---

## Seguir intentando solo Render + GitHub

- **Manual Deploy** cada varias horas.
- Cambiar **Region** del servicio (Oregon ↔ Frankfurt).
- Ticket a **Render Support** con el log `Could not resolve host: github.com`.

---

## Resumen

| Método | Evita clone GitHub en Render |
|--------|------------------------------|
| **Fly.io + `fly deploy`** | Sí (sube archivos desde tu PC) |
| **Docker Hub + Render imagen** | Sí |
| Render + repo GitHub | No — ahí falla el DNS |
