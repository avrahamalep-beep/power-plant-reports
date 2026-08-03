# AGENTS.md

## Cursor Cloud specific instructions

Single Node.js/Express app (see `README.md` for full details). One runnable service serves both the REST API and the static PWA frontend from `public/`.

### Running the app
- Dev/prod are identical: `npm start` (alias `npm run dev`, both run `node server.js`). Listens on `0.0.0.0:$PORT` (default `3000`).
- There is no build step (`npm run build` is a no-op) and no lint or automated test scripts in `package.json`. "Build/test/lint" for this repo effectively means running the server and exercising it.
- `.nvmrc` pins Node `20.18.1`, but `engines` only requires `>=20`; the app runs fine on the VM's default Node 22.

### Storage behavior (non-obvious)
- Without `DATABASE_URL`, the app uses a local fallback: `data/reports.json` + `uploads/` on disk (both git-ignored, created at runtime). This is enough to run and test end to end locally.
- With `DATABASE_URL` set, it uses PostgreSQL (auto-creates `reports` and `report_files` tables at startup; attachments stored as BYTEA). SSL is auto-enabled for non-localhost hosts. Switching storage does not migrate existing JSON reports.
- Copy `.env.example` to `.env` to configure `DATABASE_URL` / SMTP; `server.js` loads `.env` via `dotenv`.

### Optional features
- Email ("Send report by email") requires `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`; otherwise `/api/reports/:id/email` returns HTTP 503 and `/api/mail/status` reports `configured:false`. Not needed to run/test the core app.

### Quick smoke check
- `curl http://127.0.0.1:3000/health` → `OK`; `curl http://127.0.0.1:3000/api/reports` → JSON list.
