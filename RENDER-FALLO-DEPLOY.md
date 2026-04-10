# Si el deploy en Render falla

## 1. Mira el error exacto

En **Render** → tu servicio → pestaña **Events** o **Logs**.

- **Build failed** → el fallo es en `npm install` (copia las últimas líneas en rojo).
- **Deploy failed** / **Exited with status** → el fallo es al **arrancar** Node (mira **Runtime logs**).

Sin ese mensaje solo podemos adivinar.

---

## 2. Comprueba el panel (servicio creado a mano)

Si creaste el Web Service **sin** Blueprint:

| Campo | Valor |
|-------|--------|
| **Root Directory** | *(vacío)* |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

**Environment** → añade si hace falta: `NODE_VERSION` = `20`

---

## 3. Conflicto con `render.yaml`

Si el servicio se creó **solo en el panel** y luego añadiste `render.yaml`, a veces Render intenta **sincronizar** y falla.

**Prueba:** en GitHub, renombra `render.yaml` → `render.yaml.off`, haz commit, y en Render **Manual Deploy**.  
Configura Build/Start como en la tabla de arriba.

---

## 4. Errores típicos

| Mensaje | Qué hacer |
|---------|-----------|
| `Cannot find module` | `npm install` local, sube `package-lock.json`, vuelve a deploy. |
| `EADDRINUSE` / port | La app debe usar `process.env.PORT` (este proyecto ya lo hace). |
| Build timeout | Plan free a veces falla por tiempo; reintenta **Clear build cache & deploy**. |

---

## 5. Tras corregir

**Manual Deploy** → **Deploy latest commit** y espera a que el build termine en verde.
