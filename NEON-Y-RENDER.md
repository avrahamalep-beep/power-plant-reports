# Base de datos en la nube (Neon) + Render — informes que no se borran

Tu app ya sabe guardar en **PostgreSQL** cuando existe la variable **`DATABASE_URL`**. No puedo entrar en tu cuenta de Render ni de Neon por ti: tú pegas la URL una vez y apruebas el deploy. Aquí va el camino completo.

---

## 1. Crear la base gratis en Neon

1. Abre **[https://console.neon.tech](https://console.neon.tech)** e inicia sesión (GitHub está bien).
2. **Create a project** (nombre libre, región cercana a Oregon si usas Render en Oregon).
3. Cuando esté listo, entra al proyecto → pestaña **Dashboard** o **Connection details**.
4. Copia la **Connection string** (URI). Suele verse así:
   ```text
   postgresql://usuario:CONTRASEÑA@ep-xxxxx.region.aws.neon.tech/neondb?sslmode=require
   ```
5. **Cópiala entera** (incluye `?sslmode=require` si viene). No la subas a GitHub: solo a Render como variable secreta.

**Nota:** Neon ofrece conexión “pooled” y “direct”. Para un único servicio Node en Render suele bastar la **direct**. Si Neon te muestra dos, prueba primero la que pone *connection string* por defecto.

---

## 2. Poner `DATABASE_URL` en Render

1. Abre **[https://dashboard.render.com](https://dashboard.render.com)**.
2. Entra en tu servicio web (**power-plant-reports** o el nombre que tengas).
3. Menú lateral → **Environment** (o **Environment variables**).
4. **Add Environment Variable**:
   - **Key:** `DATABASE_URL` (exactamente así, mayúsculas).
   - **Value:** pega la connection string de Neon **sin espacios** al inicio o al final.
5. Marca como **secret** si Render lo ofrece (recomendado).
6. Pulsa **Save Changes**.

Render **reiniciará** el servicio solo o te pedirá un deploy.

---

## 3. Redesplegar (por si acaso)

1. En el mismo servicio → **Manual Deploy** → **Deploy latest commit** (o elige la rama `main`).
2. Espera a que termine en verde.
3. Abre **Logs** del servicio: al arrancar debe aparecer algo como:
   ```text
   Storage: PostgreSQL (DATABASE_URL) — history survives new deploys/restarts.
   ```
4. Si sigue diciendo **local JSON** o aviso de **RENDER sin DATABASE_URL**, la variable no está definida en **ese** servicio o tiene un typo en el nombre.

---

## 4. Probar la app

1. Abre tu URL (`https://power-plant-reports.onrender.com` o la tuya).
2. Crea un **reporte de prueba** y guarda.
3. Espera 1–2 minutos o haz otro deploy: el reporte debería **seguir** en **Reports saved**.

---

## 5. Probar en tu PC (opcional)

En la carpeta del proyecto, crea un archivo **`.env`** (no se sube a git si está en `.gitignore`):

```env
DATABASE_URL=postgresql://...tu cadena de neon...
```

Instala dependencias y arranca:

```bat
npm install
npm start
```

El proyecto carga **`.env`** automáticamente (`dotenv`). La consola debe mostrar el mismo mensaje de **PostgreSQL**.

---

## Problemas frecuentes

| Síntoma | Qué revisar |
|--------|-------------|
| Error `ECONNREFUSED` / timeout | Firewall raro en Neon; revisa que el string sea el actual del dashboard. |
| Error SSL | La app ya fuerza SSL para hosts no locales; la URI debe llevar `sslmode=require` si Neon lo indica. |
| “No reports” después de activar DB | Los informes **viejos** en el disco de Render **no** se migran solos; los **nuevos** sí van a Postgres. |
| Variable en “Environment Group” | Asegúrate de que el **web service** enlazado recibe esa variable (a veces hay que asociar el grupo al servicio). |

---

## 6. Correo con adjuntos desde la app (opcional)

En Render → **Environment** del mismo servicio web puedes añadir variables **SMTP** (ver `.env.example`: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, etc.). No migra datos: solo habilita el botón **Send by email** en el detalle de un reporte guardado. Los reportes antiguos no se modifican.

---

## Atajos en Windows

- **`HAZLO-AUTOMATICO.bat`**: `npm install`, crea `.env` desde `.env.example` si no existe (y abre el Bloc de notas), **commit + push** a `main`, y abre Render, Neon, la app online y esta guía.
- **`CONFIGURAR-NEON-RENDER.bat`**: crea `.env` si falta, abre Neon, Render y esta guía (para pegar `DATABASE_URL` y opcionalmente SMTP en Render o en `.env` local).
