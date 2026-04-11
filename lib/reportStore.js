const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const USE_PG = Boolean(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim());

const REPORTS_FILE = path.join(__dirname, '..', 'data', 'reports.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

let pool = null;

function ensureFileDirs() {
  if (!fs.existsSync(path.dirname(REPORTS_FILE))) {
    fs.mkdirSync(path.dirname(REPORTS_FILE), { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function readReportsFile() {
  try {
    const data = fs.readFileSync(REPORTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeReportsFile(reports) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
}

function rowToReport(row) {
  let attachments = row.attachments;
  if (attachments == null) attachments = [];
  if (typeof attachments === 'string') {
    try {
      attachments = JSON.parse(attachments);
    } catch {
      attachments = [];
    }
  }
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at;
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at;
  return {
    id: row.id,
    kks: row.kks ?? '',
    location: row.location ?? '',
    description: row.description ?? '',
    sentTo: row.sent_to ?? [],
    customRecipient: row.custom_recipient ?? '',
    newIssueNote: row.new_issue_note ?? '',
    createdAt,
    updatedAt,
    attachments: Array.isArray(attachments) ? attachments : []
  };
}

async function init() {
  if (USE_PG) {
    const { Pool } = require('pg');
    const conn = process.env.DATABASE_URL;
    const isLocal = /localhost|127\.0\.0\.1/i.test(conn);
    pool = new Pool({
      connectionString: conn,
      max: 10,
      connectionTimeoutMillis: 15000,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY,
        kks TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        sent_to JSONB NOT NULL DEFAULT '[]',
        custom_recipient TEXT NOT NULL DEFAULT '',
        new_issue_note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS report_files (
        id UUID PRIMARY KEY,
        report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        mimetype TEXT,
        size BIGINT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log('  Storage: PostgreSQL (DATABASE_URL) — history survives new deploys/restarts.');
  } else {
    ensureFileDirs();
    console.log('  Storage: local JSON + disk uploads.');
    if (process.env.RENDER) {
      console.log('');
      console.log('  [!] Estas en RENDER sin DATABASE_URL.');
      console.log('      Los reportes en disco del contenedor pueden BORRARSE al reiniciar o desplegar.');
      console.log('      Solucion: Neon (gratis) -> copia connection string -> Render -> Environment ->');
      console.log('      DATABASE_URL = (pegar) -> Save -> Manual Deploy.');
      console.log('      Guia paso a paso: NEON-Y-RENDER.md  |  Atajo: CONFIGURAR-NEON-RENDER.bat');
      console.log('');
    } else {
      console.log('  Tip: define DATABASE_URL (Neon) en Render o en .env para persistencia en la nube.');
      console.log('      Ver NEON-Y-RENDER.md');
    }
  }
}

async function loadAttachmentsForReport(reportId) {
  const { rows } = await pool.query(
    `SELECT id, name, mimetype, size FROM report_files WHERE report_id = $1 ORDER BY created_at ASC`,
    [reportId]
  );
  return rows.map(f => ({
    name: f.name,
    path: '/api/attachments/' + f.id,
    size: Number(f.size),
    mimetype: f.mimetype
  }));
}

async function listReports() {
  if (USE_PG) {
    const { rows } = await pool.query(
      `SELECT id, kks, location, description, sent_to, custom_recipient, new_issue_note, created_at, updated_at
       FROM reports ORDER BY created_at DESC`
    );
    const out = [];
    for (const row of rows) {
      const attachments = await loadAttachmentsForReport(row.id);
      out.push(rowToReport({ ...row, attachments }));
    }
    return out;
  }
  return readReportsFile();
}

async function getReport(id) {
  if (USE_PG) {
    const { rows } = await pool.query(
      `SELECT id, kks, location, description, sent_to, custom_recipient, new_issue_note, created_at, updated_at
       FROM reports WHERE id = $1`,
      [id]
    );
    if (!rows.length) return null;
    const row = rows[0];
    const attachments = await loadAttachmentsForReport(row.id);
    return rowToReport({ ...row, attachments });
  }
  const reports = readReportsFile();
  return reports.find(x => x.id === id) || null;
}

async function createReport(body) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const report = {
    id,
    kks: body.kks || '',
    location: body.location || '',
    description: body.description || '',
    attachments: [],
    createdAt: now,
    updatedAt: now,
    sentTo: body.sentTo || [],
    customRecipient: body.customRecipient || '',
    newIssueNote: body.newIssueNote || ''
  };
  if (USE_PG) {
    await pool.query(
      `INSERT INTO reports (id, kks, location, description, sent_to, custom_recipient, new_issue_note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::timestamptz, $9::timestamptz)`,
      [
        id,
        report.kks,
        report.location,
        report.description,
        JSON.stringify(report.sentTo),
        report.customRecipient,
        report.newIssueNote,
        now,
        now
      ]
    );
    return report;
  }
  const reports = readReportsFile();
  reports.unshift(report);
  writeReportsFile(reports);
  return report;
}

async function updateReport(id, body) {
  if (USE_PG) {
    const existing = await getReport(id);
    if (!existing) return null;
    const kks = body.kks !== undefined ? body.kks : existing.kks;
    const loc = body.location !== undefined ? body.location : existing.location;
    const desc = body.description !== undefined ? body.description : existing.description;
    const sentTo = body.sentTo !== undefined ? body.sentTo : existing.sentTo;
    const customRecipient = body.customRecipient !== undefined ? body.customRecipient : existing.customRecipient;
    const newIssueNote = body.newIssueNote !== undefined ? body.newIssueNote : existing.newIssueNote;
    const now = new Date().toISOString();
    await pool.query(
      `UPDATE reports SET kks = $2, location = $3, description = $4, sent_to = $5::jsonb,
        custom_recipient = $6, new_issue_note = $7, updated_at = $8::timestamptz WHERE id = $1`,
      [id, kks, loc, desc, JSON.stringify(sentTo || []), customRecipient, newIssueNote, now]
    );
    return getReport(id);
  }
  const reports = readReportsFile();
  const idx = reports.findIndex(x => x.id === id);
  if (idx === -1) return null;
  const r = reports[idx];
  if (body.kks !== undefined) r.kks = body.kks;
  if (body.location !== undefined) r.location = body.location;
  if (body.description !== undefined) r.description = body.description;
  if (body.newIssueNote !== undefined) r.newIssueNote = body.newIssueNote;
  if (body.sentTo !== undefined) r.sentTo = body.sentTo;
  if (body.customRecipient !== undefined) r.customRecipient = body.customRecipient;
  r.updatedAt = new Date().toISOString();
  writeReportsFile(reports);
  return r;
}

async function deleteReport(id) {
  if (USE_PG) {
    const r = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING id', [id]);
    return (r.rowCount || 0) > 0;
  }
  const reports = readReportsFile();
  const idx = reports.findIndex(x => x.id === id);
  if (idx === -1) return false;
  reports.splice(idx, 1);
  writeReportsFile(reports);
  const reportDir = path.join(UPLOADS_DIR, id);
  if (fs.existsSync(reportDir)) {
    try {
      fs.rmSync(reportDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Could not remove upload folder:', e);
    }
  }
  return true;
}

async function addAttachments(reportId, files) {
  if (!files || !files.length) {
    return getReport(reportId);
  }
  const now = new Date().toISOString();
  if (USE_PG) {
    const exists = await pool.query('SELECT 1 FROM reports WHERE id = $1', [reportId]);
    if (!exists.rowCount) return null;
    for (const f of files) {
      const fid = uuidv4();
      await pool.query(
        `INSERT INTO report_files (id, report_id, name, mimetype, size, data) VALUES ($1, $2, $3, $4, $5, $6)`,
        [fid, reportId, f.originalname, f.mimetype || null, f.size, f.buffer]
      );
    }
    await pool.query('UPDATE reports SET updated_at = $2::timestamptz WHERE id = $1', [reportId, now]);
    return getReport(reportId);
  }
  const reports = readReportsFile();
  const r = reports.find(x => x.id === reportId);
  if (!r) return null;
  const reportDir = path.join(UPLOADS_DIR, reportId);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const mapped = [];
  for (const f of files) {
    const destName = path.basename(f.path);
    mapped.push({
      name: f.originalname,
      path: `/uploads/${reportId}/${destName}`,
      size: f.size,
      mimetype: f.mimetype
    });
  }
  r.attachments = r.attachments || [];
  r.attachments.push(...mapped);
  r.updatedAt = now;
  writeReportsFile(reports);
  return r;
}

async function getAttachmentBlob(fileId) {
  if (!USE_PG) return null;
  const { rows } = await pool.query(
    'SELECT name, mimetype, data FROM report_files WHERE id = $1',
    [fileId]
  );
  return rows[0] || null;
}

module.exports = {
  usePg: USE_PG,
  init,
  listReports,
  getReport,
  createReport,
  updateReport,
  deleteReport,
  addAttachments,
  getAttachmentBlob,
  UPLOADS_DIR
};
