# Power Plant Malfunction Reports

Web app for field malfunction reports. Use from PC or mobile: take photos/videos with the camera or upload files, save reports, copy fields to the ticket app, and open email with the report for GE Vernova contacts.

## Live app (online)

After you deploy on Render, open this URL on **PC or mobile** (same link for everyone):

**https://power-plant-reports.onrender.com**

First visit after idle can take ~1 minute (free tier wakes up). **Take photo** / **Record video** open the camera on phones (HTTPS helps).

## Keeping report history (reports are not lost)

On Render’s default free web service, the container disk is **ephemeral**: new deploys or restarts can **erase** `data/reports.json` and `uploads/`.

### Quick steps (Neon + Render)

1. Create a free **[Neon](https://neon.tech)** Postgres project → copy the **connection string**.
2. **Render** → your **web service** → **Environment** → add **`DATABASE_URL`** = paste that string → **Save**.
3. **Manual Deploy** → check **Logs** for: `Storage: PostgreSQL (DATABASE_URL)`.

**Spanish step-by-step (screenshots-style checklist):** open **`NEON-Y-RENDER.md`** in this repo, or double-click **`CONFIGURAR-NEON-RENDER.bat`** (opens Neon + Render in the browser).

**Local Postgres / Neon:** copy `.env.example` to `.env`, set `DATABASE_URL`, run `npm start`.

Behavior:

- **With `DATABASE_URL`**: reports and attachment files are stored in PostgreSQL. History survives deploys and idle restarts (within your DB provider’s limits).
- **Without `DATABASE_URL`**: the app uses `data/reports.json` and the `uploads/` folder (fine for **local** development on your PC).

Turning on `DATABASE_URL` does **not** import old JSON reports automatically; only **new** saves go to Postgres until you add a migration script.

## Automatic update (you run one file)

1. Double-click **`ABRIR-APP-ONLINE.bat`** — it pushes code to GitHub and opens Render + short instructions.
2. If Render is already connected to this repo, each **push** triggers a **new deploy** automatically.

Optional: in Render → your service → **Settings** → **Deploy Hook** → copy URL. In GitHub → repo **Settings** → **Secrets** → add **`RENDER_DEPLOY_HOOK_URL`** with that URL. Then every push to `main` also triggers deploy via GitHub Actions (see `.github/workflows/render-deploy.yml`).

## Requirements

- Node.js 16 or higher

## If `npm start` fails (PowerShell "scripts disabled")

**Option A – Run without npm:** Double-click **`start.bat`** (runs `node server.js`).

**Option B – PowerShell:** `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

**Option C – cmd:** `npm install` then `npm start`

## Install and run (local)

1. `npm install`
2. `npm start` or **`start.bat`**
3. Open **http://127.0.0.1:3000** (keep the server window open)

Optional: copy **`.env.example`** to **`.env`**, set **`DATABASE_URL`** to your Neon string — `server.js` loads `.env` automatically via `dotenv`.

## Sharing on same Wi-Fi (local server)

With **start.bat** running, use the `http://192.168.x.x:3000` link printed in the console. Allow Node.js in Windows Firewall if phones cannot connect.

## Features

- **New report**: KKS, Location, Description, attachments. **Take photo** and **Record video** use the device camera on mobile.
- **Copy all** / copy-paste per field for the ticket app.
- **Recipients**: GE Vernova list or custom email.
- **Reports saved**: **Report history** with search by KKS, description, location, and attachment names; open detail and download attachments.
