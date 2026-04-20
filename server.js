require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const multer = require('multer');
const reportStore = require('./lib/reportStore');
const mail = require('./lib/mail');

function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

const app = express();
const PORT = process.env.PORT || 3000;

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const reportId = req.params.id || req.body.reportId || req.query.reportId || 'temp';
    const dir = path.join(reportStore.UPLOADS_DIR, reportId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const name = path.parse(safe).name.replace(/\s+/g, '_');
    const ext = path.extname(safe) || '';
    cb(null, `${name}_${Date.now()}${ext}`);
  }
});

const uploadLimits = { fileSize: 100 * 1024 * 1024 };
const uploadDisk = multer({ storage: diskStorage, limits: uploadLimits });
const uploadMem = multer({ storage: multer.memoryStorage(), limits: uploadLimits });

function uploadArray() {
  return reportStore.usePg ? uploadMem.array('files', 20) : uploadDisk.array('files', 20);
}

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
app.use(
  express.static(publicDir, {
    setHeaders(res, filePath) {
      if (path.basename(filePath) === 'manifest.webmanifest') {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      }
    }
  })
);
app.use('/uploads', express.static(reportStore.UPLOADS_DIR));

app.get('/api/attachments/:fileId', async (req, res) => {
  if (!reportStore.usePg) {
    return res.status(404).send('Not found');
  }
  try {
    const blob = await reportStore.getAttachmentBlob(req.params.fileId);
    if (!blob) return res.status(404).send('Not found');
    res.setHeader('Content-Type', blob.mimetype || 'application/octet-stream');
    const safeName = String(blob.name || 'file').replace(/[\r\n"]/g, '_');
    const enc = encodeURIComponent(blob.name || 'file');
    const asInline = req.query.view === '1' || req.query.inline === '1';
    const disp = asInline ? 'inline' : 'attachment';
    res.setHeader(
      'Content-Disposition',
      `${disp}; filename="${safeName}"; filename*=UTF-8''${enc}`
    );
    res.send(blob.data);
  } catch (e) {
    console.error(e);
    res.status(500).send('Error loading file');
  }
});

app.get('/', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error enviando index.html:', err);
        res.status(500).send('<h1>Error cargando la app</h1><p>Revisa la consola del servidor.</p>');
      }
    });
  } else {
    res.status(500).send('<h1>Carpeta public no encontrada</h1><p>Ejecuta desde la carpeta del proyecto.</p>');
  }
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

const RECIPIENTS = [
  { id: 'yohai', name: 'Afuta, Yohai (GE Vernova)', email: 'Yohai.Afuta@gevernova.com' },
  { id: 'matan', name: 'Ben Tanhum, Matan (GE Vernova)', email: 'matan.bentanhum@gevernova.com' },
  { id: 'ali', name: 'Bzadug, Ali (GE Vernova)', email: 'Ali.Bzadug@gevernova.com' },
  { id: 'avraham', name: 'Carasco, Avraham (GE Vernova)', email: 'avraham.carasco@gevernova.com' },
  { id: 'genya', name: 'Furman, Genya (GE Vernova)', email: 'Genya.Furman@gevernova.com' },
  { id: 'omer', name: 'Haron, Omer (GE Vernova)', email: 'Omer.Haron@gevernova.com' },
  { id: 'pavel', name: 'Kigel, Pavel (GE Vernova)', email: 'pavel.kigel@gevernova.com' },
  { id: 'maria', name: 'Melnyk, Maria (GE Vernova)', email: 'Maria.Melnyk@gevernova.com' },
  { id: 'katrin', name: 'Ostrov, Katrin (GE Vernova)', email: 'Katrin.Ostrov@gevernova.com' },
  { id: 'emil', name: 'Yonaev, Emil (GE Vernova)', email: 'Emil.yonaev@gevernova.com' },
  { id: 'yahav', name: 'Zarfati, Yahav (GE Vernova)', email: 'Yahav.Zarfati@gevernova.com' }
];

app.get('/api/recipients', (req, res) => {
  res.json(RECIPIENTS);
});

app.get('/api/reporters', (req, res) => {
  res.json(RECIPIENTS.map(r => ({ id: r.id, name: r.name })));
});

app.get('/api/mail/status', (req, res) => {
  res.json({ configured: mail.smtpConfigured() });
});

function isValidEmail(s) {
  const t = String(s || '').trim();
  if (t.length > 254 || t.length < 3) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

app.post('/api/reports/:id/email', async (req, res) => {
  if (!mail.smtpConfigured()) {
    return res.status(503).json({ error: 'SMTP not configured on server (set SMTP_HOST, SMTP_USER, SMTP_PASS).' });
  }
  const rawTo = req.body && req.body.to;
  const list = Array.isArray(rawTo) ? rawTo : typeof rawTo === 'string' ? [rawTo] : [];
  const to = [...new Set(list.map(e => String(e).trim().toLowerCase()).filter(Boolean))];
  if (!to.length) {
    return res.status(400).json({ error: 'Provide at least one recipient address in "to".' });
  }
  if (to.length > 25) {
    return res.status(400).json({ error: 'Too many recipients (max 25).' });
  }
  for (const addr of to) {
    if (!isValidEmail(addr)) {
      return res.status(400).json({ error: 'Invalid email: ' + addr });
    }
  }
  try {
    const report = await reportStore.getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    let parts;
    try {
      parts = await reportStore.getAttachmentBuffersForReport(req.params.id);
    } catch (readErr) {
      console.error(readErr);
      return res.status(500).json({ error: 'Could not read attachments from storage.' });
    }

    const maxBytes = Number(process.env.MAIL_MAX_ATTACHMENT_BYTES || 24 * 1024 * 1024);
    const total = parts.reduce((sum, p) => sum + (p.buffer ? p.buffer.length : 0), 0);
    if (total > maxBytes) {
      return res.status(400).json({
        error: `Attachments are about ${Math.ceil(total / 1024 / 1024)} MB; limit is ${Math.ceil(maxBytes / 1024 / 1024)} MB (MAIL_MAX_ATTACHMENT_BYTES).`
      });
    }

    const kksPart = mail.safeSubjectPart(report.kks) || 'report';
    const subject = `[Field report] ${kksPart}`;
    const text = mail.buildReportEmailBody(report);

    await mail.sendReportWithAttachments({
      to,
      subject,
      text,
      attachments: parts
    });

    res.json({ ok: true, recipients: to.length, attachmentCount: parts.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({
      error: 'Email send failed. Check SMTP settings and logs.',
      detail: process.env.NODE_ENV === 'development' ? String(e.message) : undefined
    });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const reports = await reportStore.listReports();
    res.json(reports);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not list reports' });
  }
});

app.get('/api/reports/:id', async (req, res) => {
  try {
    const r = await reportStore.getReport(req.params.id);
    if (!r) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load report' });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const report = await reportStore.createReport(req.body);
    res.status(201).json(report);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create report' });
  }
});

app.patch('/api/reports/:id', async (req, res) => {
  try {
    const r = await reportStore.updateReport(req.params.id, req.body);
    if (!r) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json(r);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not update report' });
  }
});

app.delete('/api/reports/:id', async (req, res) => {
  try {
    const ok = await reportStore.deleteReport(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Report not found' });
    res.status(204).send();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not delete report' });
  }
});

app.delete('/api/reports/:id/attachments', async (req, res) => {
  try {
    const updated = await reportStore.deleteAttachment(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Report not found' });
    res.json({ attachments: updated.attachments || [] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not delete attachment' });
  }
});

app.post('/api/reports/:id/upload', uploadArray(), async (req, res) => {
  try {
    if (reportStore.usePg) {
      for (const f of req.files || []) {
        if (!f.buffer) {
          return res.status(500).json({ error: 'Upload misconfigured' });
        }
      }
    }
    const updated = await reportStore.addAttachments(req.params.id, req.files || []);
    if (!updated) return res.status(404).json({ error: 'Reporte no encontrado' });
    res.json({ attachments: updated.attachments });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.post('/api/upload', uploadArray(), async (req, res) => {
  const reportId = req.body.reportId || req.params.reportId;
  if (!reportId) return res.status(400).json({ error: 'reportId requerido' });
  try {
    if (reportStore.usePg) {
      const updated = await reportStore.addAttachments(reportId, req.files || []);
      if (!updated) return res.status(404).json({ error: 'Reporte no encontrado' });
      return res.json({ reportId, attachments: updated.attachments });
    }
    const files = (req.files || []).map(f => ({
      name: f.originalname,
      path: `/uploads/${reportId}/${path.basename(f.path)}`,
      size: f.size,
      mimetype: f.mimetype
    }));
    res.json({ reportId, attachments: files });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Promise rechazada:', err);
});

function startServer(port) {
  app.listen(port, '0.0.0.0', () => {
    const localUrl = `http://127.0.0.1:${port}`;
    console.log('');
    console.log('  Server ready.');
    if (mail.smtpConfigured()) {
      console.log('  Outbound email: SMTP enabled (report detail → Send by email).');
    } else {
      console.log('  Outbound email: off (set SMTP_HOST, SMTP_USER, SMTP_PASS to enable).');
    }
    if (process.env.RENDER) {
      console.log('  (Render: use your service URL from the dashboard, not 127.0.0.1.)');
    } else {
      console.log('  Keep this window open.');
      console.log('');
      console.log('  On this PC, open:  ' + localUrl);
      const lanIps = getLocalIPs();
      if (lanIps.length) {
        console.log('');
        console.log('  Share this link for phones/other PCs on the same Wi-Fi:');
        lanIps.forEach(ip => console.log('    http://' + ip + ':' + port));
      }
      try {
        if (process.platform === 'win32') {
          exec('start "" "' + localUrl + '"', (err) => {});
        }
      } catch (e) {}
    }
    console.log('');
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('  Port ' + port + ' in use. Trying ' + (port + 1) + '...');
      startServer(port + 1);
    } else {
      console.error('  Error starting server:', err.message);
      process.exit(1);
    }
  });
}

reportStore
  .init()
  .then(() => {
    startServer(PORT);
  })
  .catch((err) => {
    console.error('  Failed to initialize storage:', err.message);
    process.exit(1);
  });
