# Opciones gratis / online (si Render va lento)

## Por qué Render gratis tarda

El plan **Free** **apaga** la app tras ~15 min sin uso. La primera visita **despierta** el servidor: suele tardar **1–3 minutos** (pantalla "Application loading"). Después de eso, va más fluido un rato.

**Sin pagar:** acepta esperar **2–3 min** la primera vez, o usa otra plataforma (abajo).

---

## Opción A — Render de pago (la más simple si quieres rapidez)

- En Render: sube de plan o desactiva el "spin down" según lo que ofrezca tu cuenta.
- La app queda **siempre encendida** y abre en segundos.
- No cambias código.

---

## Opción B — Fly.io (gratis con límites, a veces más estable)

1. Cuenta en https://fly.io  
2. Instala CLI: https://fly.io/docs/hands-on/install-flyctl/  
3. En la carpeta del proyecto:
   ```cmd
   fly launch
   ```
   Sigue el asistente (acepta crear `fly.toml` si lo pide).  
4. `fly deploy`  
5. Te dan una URL `https://tu-app.fly.dev`

Puede pedir tarjeta solo para verificación. Límites del plan gratuito aplican.

---

## Opción C — Koyeb (tier gratuito)

- https://www.koyeb.com — Web Service desde GitHub, similar a Render.  
- A veces el arranque en frío también existe; prueba si en tu red va mejor que Render.

---

## Opción D — Railway (crédito, no siempre gratis para siempre)

- https://railway.app — A veces dan crédito inicial; despliegue desde GitHub.  
- Revisa si sigue siendo gratis para tu uso.

---

## Resumen

| Necesidad | Mejor encaje |
|-----------|----------------|
| Gratis y sin tocar nada | Render free: **espera 2–3 min** la primera carga |
| Gratis y otra URL | Probar **Fly.io** o **Koyeb** |
| Rápido siempre | **Render de pago** u otro plan "always on" |

Tu código (Express + fotos + cámara) sirve igual; solo cambias **dónde** lo despliegas.
