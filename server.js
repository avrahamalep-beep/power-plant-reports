const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec } = require('child_process');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

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
const REPORTS_FILE = path.join(__dirname, 'data', 'reports.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Asegurar que existan directorios
if (!fs.existsSync(path.dirname(REPORTS_FILE))) {
  fs.mkdirSync(path.dirname(REPORTS_FILE), { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configuración multer: una carpeta por reporte (por id)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const reportId = req.params.id || req.body.reportId || req.query.reportId || 'temp';
    const dir = path.join(UPLOADS_DIR, reportId);
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
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.use('/uploads', express.static(UPLOADS_DIR));

// Ruta explicita para la pagina principal (evita ERR_EMPTY_RESPONSE)
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

function readReports() {
  try {
    const data = fs.readFileSync(REPORTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeReports(reports) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf8');
}

// Lista de destinatarios GE Vernova
const RECIPIENTS = [
  { id: 'yohai', name: 'Afuta, Yohai (GE Vernova)', email: 'Yohai.Afuta@gevernova.com' },
  { id: 'matan', name: 'Ben Tanhum, Matan (GE Vernova)', email: 'matan.bentanhum@gevernova.com' },
  { id: 'ali', name: 'Bzadug, Ali (GE Vernova)', email: 'Ali.Bzadug@gevernova.com' },
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

app.get('/api/reports', (req, res) => {
  const reports = readReports();
  res.json(reports);
});

app.get('/api/reports/:id', (req, res) => {
  const reports = readReports();
  const r = reports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Reporte no encontrado' });
  res.json(r);
});

app.post('/api/reports', (req, res) => {
  const reports = readReports();
  const id = uuidv4();
  const report = {
    id,
    kks: req.body.kks || '',
    location: req.body.location || '',
    description: req.body.description || '',
    attachments: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sentTo: req.body.sentTo || [],
    customRecipient: req.body.customRecipient || '',
    newIssueNote: req.body.newIssueNote || ''
  };
  reports.unshift(report);
  writeReports(reports);
  res.status(201).json(report);
});

app.patch('/api/reports/:id', (req, res) => {
  const reports = readReports();
  const idx = reports.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Reporte no encontrado' });
  const r = reports[idx];
  if (req.body.kks !== undefined) r.kks = req.body.kks;
  if (req.body.location !== undefined) r.location = req.body.location;
  if (req.body.description !== undefined) r.description = req.body.description;
  if (req.body.newIssueNote !== undefined) r.newIssueNote = req.body.newIssueNote;
  if (req.body.sentTo !== undefined) r.sentTo = req.body.sentTo;
  if (req.body.customRecipient !== undefined) r.customRecipient = req.body.customRecipient;
  r.updatedAt = new Date().toISOString();
  writeReports(reports);
  res.json(r);
});

app.delete('/api/reports/:id', (req, res) => {
  const reports = readReports();
  const idx = reports.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Report not found' });
  reports.splice(idx, 1);
  writeReports(reports);
  const reportDir = path.join(UPLOADS_DIR, req.params.id);
  if (fs.existsSync(reportDir)) {
    try {
      fs.rmSync(reportDir, { recursive: true, force: true });
    } catch (e) {
      console.error('Could not remove upload folder:', e);
    }
  }
  res.status(204).send();
});

// Subir archivos a un reporte existente
app.post('/api/reports/:id/upload', upload.array('files', 20), (req, res) => {
  const reports = readReports();
  const r = reports.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Reporte no encontrado' });
  const reportDir = path.join(UPLOADS_DIR, req.params.id);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const files = (req.files || []).map(f => ({
    name: f.originalname,
    path: `/uploads/${req.params.id}/${path.basename(f.path)}`,
    size: f.size,
    mimetype: f.mimetype
  }));
  r.attachments = r.attachments || [];
  r.attachments.push(...files);
  r.updatedAt = new Date().toISOString();
  writeReports(reports);
  res.json({ attachments: r.attachments });
});

// Subir archivos al crear reporte (reportId en body)
app.post('/api/upload', upload.array('files', 20), (req, res) => {
  const reportId = req.body.reportId || req.params.reportId;
  if (!reportId) return res.status(400).json({ error: 'reportId requerido' });
  const dir = path.join(UPLOADS_DIR, reportId);
  const files = (req.files || []).map(f => ({
    name: f.originalname,
    path: `/uploads/${reportId}/${path.basename(f.path)}`,
    size: f.size,
    mimetype: f.mimetype
  }));
  res.json({ reportId, attachments: files });
});

// Evitar que el proceso caiga sin avisar
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Promise rechazada:', err);
});

function startServer(port) {
  app.listen(port, '0.0.0.0', () => {
    const localUrl = `http://127.0.0.1:${port}`;
    const lanIps = getLocalIPs();
    console.log('');
    console.log('  Server ready. Keep this window open.');
    console.log('');
    console.log('  On this PC, open:  ' + localUrl);
    if (lanIps.length) {
      console.log('');
      console.log('  Share this link for phones/other PCs on the same Wi-Fi:');
      lanIps.forEach(ip => console.log('    http://' + ip + ':' + port));
      console.log('');
    }
    console.log('');
    // Only open browser on your PC (Windows). On Render/Linux this would hang.
    try {
      if (process.platform === 'win32' && !process.env.RENDER) {
        exec('start "" "' + localUrl + '"', (err) => {});
      }
    } catch (e) {}
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

startServer(PORT);
