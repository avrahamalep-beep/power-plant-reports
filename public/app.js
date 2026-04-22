const API = '';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => el.querySelectorAll(s);

let pendingFiles = [];
let currentReportId = null;
let audioMediaRecorder = null;
let audioStream = null;
let audioChunks = [];
let audioTimerInterval = null;
let audioStartMs = 0;

const form = $('#report-form');
const panelForm = $('#panel-form');
const panelSaved = $('#panel-saved');
const panelDetail = $('#panel-detail');
const savedList = $('#saved-list');
const savedEmpty = $('#saved-empty');
const savedSearch = $('#saved-search');

let cachedSavedReports = [];

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s == null ? '' : String(s);
  return div.innerHTML;
}

function isImageAttachment(a) {
  if (!a) return false;
  const mime = String(a.mimetype || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = String(a.name || a.path || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name);
}

function attachmentPreviewHref(a, baseUrl, inline = false) {
  const p = a && a.path ? a.path : '';
  const href = baseUrl + p;
  if (p.indexOf('/api/attachments/') !== 0) return href;
  const hasQ = href.indexOf('?') >= 0;
  if (!inline) return href;
  return href + (hasQ ? '&' : '?') + 'view=1';
}

function truncateText(text, max = 120) {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + '…';
}

function filterReportsByQuery(reports, q) {
  if (!q) return reports;
  return reports.filter(r => {
    const attNames = (r.attachments || []).map(a => a.name).join(' ');
    const blob = [r.kks, r.location, r.description, attNames, r.reporterName, r.reporterId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return blob.includes(q);
  });
}

function renderSavedList(reports, options = {}) {
  const emptyFromFilter = options.emptyFromFilter;
  if (!reports.length) {
    savedEmpty.style.display = 'block';
    savedEmpty.textContent = emptyFromFilter ? 'No reports match your search.' : 'No reports in history yet.';
    savedList.innerHTML = '';
    return;
  }
  savedEmpty.style.display = 'none';
  savedList.innerHTML = reports.map(r => {
    const date = new Date(r.createdAt).toLocaleString();
    const attCount = (r.attachments && r.attachments.length) || 0;
    const by = (r.reporterName || '').trim();
    const byPart = by ? ` · ${escapeHtml(by)}` : '';
    const desc = truncateText(r.description || '', 140);
    const images = (r.attachments || []).filter(isImageAttachment).slice(0, 2);
    const imageHtml = images.map(a => {
      const src = attachmentPreviewHref(a, window.location.origin, true);
      return `<img src="${src}" alt="${escapeHtml(a.name || 'Attachment preview')}" class="saved-thumb" loading="lazy" />`;
    }).join('');
    return `
          <li data-id="${r.id}">
            <div class="saved-item-main" role="button" tabindex="0">
              <div class="report-kks">${r.kks || '(no KKS)'}</div>
              <div class="report-meta">${escapeHtml(r.location || '-')}${byPart} · ${date}${attCount ? ' · ' + attCount + ' attachment(s)' : ''}</div>
              ${desc ? `<div class="report-desc-preview">${escapeHtml(desc)}</div>` : ''}
              ${imageHtml ? `<div class="saved-thumbs">${imageHtml}</div>` : ''}
            </div>
            <button type="button" class="btn-saved-delete" data-id="${r.id}" aria-label="Delete report">Delete</button>
          </li>
        `;
  }).join('');
}
const detailContent = $('#detail-content');
const attachmentsInput = $('#attachments');
const fileList = $('#file-list');

function showPanel(panel) {
  $$('.panel').forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
}

function buildReportText(data) {
  const lines = [
    '--- Power Plant Malfunction Report ---',
    '',
    'KKS: ' + (data.kks || '-'),
    'Location: ' + (data.location || '-'),
    'Prepared by: ' + ((data.reporterName || '').trim() || '-'),
    '',
    'Description:',
    (data.description || '-'),
    '',
    '---'
  ];
  return lines.join('\n');
}

function buildWhatsAppText(data) {
  const desc = truncateText(data.description || '-', 180);
  const attachments = Array.isArray(data.attachments) ? data.attachments.length : 0;
  return [
    'Hello team, I added a new field report.',
    'KKS: ' + (data.kks || '-'),
    'Location: ' + (data.location || '-'),
    'Prepared by: ' + ((data.reporterName || '').trim() || '-'),
    'Summary: ' + desc,
    'Attachments: ' + attachments
  ].join('\n');
}

function reporterLabelFromFormSelect() {
  const sel = $('#reporter');
  if (!sel || !sel.value) return '';
  const opt = sel.options[sel.selectedIndex];
  return opt ? opt.textContent.trim() : '';
}

function fillReporterFormOptions() {
  const sel = $('#reporter');
  if (!sel) return;
  sel.innerHTML =
    '<option value="" disabled selected>Select who prepared this report…</option>';
  (window._reportersList || []).forEach(r => {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.name;
    sel.appendChild(o);
  });
}

function fillDetailReporterSelect(selectedId, fallbackName) {
  const sel = $('#detail-reporter');
  if (!sel) return;
  const list = window._reportersList || [];
  sel.innerHTML = '<option value="">— Not recorded —</option>';
  list.forEach(r => {
    const o = document.createElement('option');
    o.value = r.id;
    o.textContent = r.name;
    sel.appendChild(o);
  });
  if (selectedId && !list.some(r => r.id === selectedId)) {
    const o = document.createElement('option');
    o.value = selectedId;
    o.textContent = (fallbackName && String(fallbackName).trim()) || selectedId;
    sel.appendChild(o);
  }
  sel.value = selectedId || '';
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    return Promise.resolve();
  } finally {
    document.body.removeChild(ta);
  }
}

function pasteFromClipboard() {
  if (navigator.clipboard && navigator.clipboard.readText) {
    return navigator.clipboard.readText();
  }
  return Promise.resolve('');
}

function showCopyFeedback(el, msg = 'Copied') {
  if (!el) return;
  el.textContent = msg;
  el.style.visibility = 'visible';
  setTimeout(() => { el.style.visibility = 'hidden'; }, 2000);
}

let toastTimer;
function showToast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 3500);
}

async function deleteReport(id) {
  try {
    const r = await fetch(API + '/api/reports/' + id, { method: 'DELETE' });
    if (!r.ok) throw new Error();
    showToast('Report deleted.');
    if (currentReportId === id) {
      currentReportId = null;
      window._detailReport = null;
      showPanel(panelSaved);
      $$('.tab').forEach(t => t.classList.remove('active'));
      $('.tab[data-tab="saved"]').classList.add('active');
    }
    loadSavedReports();
  } catch (err) {
    alert('Could not delete report.');
  }
}

function addToPendingFiles(fileListLike) {
  if (!fileListLike || !fileListLike.length) return;
  pendingFiles = pendingFiles.concat(Array.from(fileListLike));
  fileList.innerHTML = pendingFiles.map(f => `<span>${f.name} (${(f.size / 1024).toFixed(1)} KB)</span>`).join('');
}

// Tabs
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    if (tab.dataset.tab === 'form') showPanel(panelForm);
    if (tab.dataset.tab === 'saved') {
      showPanel(panelSaved);
      loadSavedReports();
    }
  });
});

// Per-field copy
document.body.addEventListener('click', (e) => {
  const copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) {
    e.preventDefault();
    const id = copyBtn.dataset.copy;
    const el = $('#' + id);
    if (el) {
      const text = el.value || '';
      copyToClipboard(text).then(() => {
        showCopyFeedback($('#copy-feedback'), 'Copied');
      }).catch(() => {});
    }
    return;
  }
  const pasteBtn = e.target.closest('[data-paste]');
  if (pasteBtn) {
    e.preventDefault();
    const id = pasteBtn.dataset.paste;
    const el = $('#' + id);
    if (el) {
      pasteFromClipboard().then(text => {
        if (text) el.value = text;
      }).catch(() => {});
    }
  }
});

// Copy all
$('#copy-all').addEventListener('click', () => {
  const data = {
    kks: $('#kks').value.trim(),
    location: $('#location').value.trim(),
    description: $('#description').value.trim(),
    reporterName: reporterLabelFromFormSelect()
  };
  const text = buildReportText(data);
  copyToClipboard(text).then(() => {
    showCopyFeedback($('#copy-feedback'));
  }).catch(() => {
    showCopyFeedback($('#copy-feedback'), 'Could not copy');
  });
});

// File list from main file input
attachmentsInput.addEventListener('change', () => {
  addToPendingFiles(attachmentsInput.files);
  attachmentsInput.value = '';
});

// Camera photo (opens camera on mobile)
$('#btn-camera-photo').addEventListener('click', () => $('#camera-photo').click());
$('#camera-photo').addEventListener('change', function() {
  addToPendingFiles(this.files);
  this.value = '';
});

// Camera video (opens camera on mobile)
$('#btn-camera-video').addEventListener('click', () => $('#camera-video').click());
$('#camera-video').addEventListener('change', function() {
  addToPendingFiles(this.files);
  this.value = '';
});

const btnAudioRecord = $('#btn-audio-record');
const audioTimerEl = $('#audio-timer');

function formatElapsed(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function setAudioTimerIdle() {
  if (!audioTimerEl) return;
  audioTimerEl.textContent = '00:00';
  audioTimerEl.classList.remove('recording');
}

function stopAudioTimer() {
  if (audioTimerInterval) {
    clearInterval(audioTimerInterval);
    audioTimerInterval = null;
  }
}

function resetAudioButton() {
  if (!btnAudioRecord) return;
  btnAudioRecord.textContent = 'Record audio';
  btnAudioRecord.classList.remove('recording');
  btnAudioRecord.disabled = false;
  stopAudioTimer();
  setAudioTimerIdle();
}

function stopAudioStreamTracks() {
  if (!audioStream) return;
  audioStream.getTracks().forEach(t => t.stop());
  audioStream = null;
}

async function startAudioRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
    alert('Audio recording is not supported in this browser/device.');
    return;
  }
  if (!btnAudioRecord) return;
  btnAudioRecord.disabled = true;
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    audioMediaRecorder = new MediaRecorder(audioStream);
    audioMediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) audioChunks.push(ev.data);
    };
    audioMediaRecorder.onstop = () => {
      const mime = audioMediaRecorder && audioMediaRecorder.mimeType ? audioMediaRecorder.mimeType : 'audio/webm';
      const ext = mime.includes('ogg') ? 'ogg' : (mime.includes('mp4') || mime.includes('mpeg')) ? 'm4a' : 'webm';
      const blob = new Blob(audioChunks, { type: mime });
      const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: mime });
      addToPendingFiles([file]);
      audioMediaRecorder = null;
      audioChunks = [];
      stopAudioStreamTracks();
      resetAudioButton();
      showToast('Audio attached.');
    };
    audioMediaRecorder.onerror = () => {
      audioMediaRecorder = null;
      audioChunks = [];
      stopAudioStreamTracks();
      resetAudioButton();
      alert('Could not record audio.');
    };
    audioMediaRecorder.start();
    audioStartMs = Date.now();
    setAudioTimerIdle();
    if (audioTimerEl) audioTimerEl.classList.add('recording');
    stopAudioTimer();
    audioTimerInterval = setInterval(() => {
      if (audioTimerEl) audioTimerEl.textContent = formatElapsed(Date.now() - audioStartMs);
    }, 200);
    btnAudioRecord.textContent = 'Stop recording';
    btnAudioRecord.classList.add('recording');
    btnAudioRecord.disabled = false;
    showToast('Recording audio...');
  } catch (err) {
    stopAudioStreamTracks();
    resetAudioButton();
    alert('Microphone permission denied or unavailable.');
  }
}

function stopAudioRecording() {
  if (audioMediaRecorder && audioMediaRecorder.state !== 'inactive') {
    audioMediaRecorder.stop();
  } else {
    resetAudioButton();
  }
}

if (btnAudioRecord) {
  btnAudioRecord.addEventListener('click', () => {
    if (audioMediaRecorder && audioMediaRecorder.state === 'recording') {
      stopAudioRecording();
      return;
    }
    startAudioRecording();
  });
}
setAudioTimerIdle();

window._mailConfigured = false;

Promise.all([
  fetch(API + '/api/reporters').then(r => r.json()),
  fetch(API + '/api/mail/status')
    .then(r => r.json())
    .catch(() => ({ configured: false }))
])
  .then(([data, mailStatus]) => {
    window._reportersList = Array.isArray(data) ? data : [];
    window._mailConfigured = !!(mailStatus && mailStatus.configured);
    fillReporterFormOptions();
    if (panelDetail && panelDetail.classList.contains('active') && window._detailReport) {
      const dr = window._detailReport;
      fillDetailReporterSelect(dr.reporterId, dr.reporterName);
    }
  })
  .catch(() => {
    window._reportersList = [];
    window._mailConfigured = false;
    const sel = $('#reporter');
    if (sel) {
      sel.innerHTML = '<option value="" disabled selected>Could not load author list</option>';
    }
  });

function clearDetailEmailForm() {
  const ex = $('#email-extra');
  if (ex) ex.value = '';
  $$('.email-recipient-cb').forEach(c => {
    c.checked = false;
  });
}

function fillEmailRecipientListOnce() {
  const wrap = $('#email-recipient-list');
  if (!wrap) return Promise.resolve();
  if (wrap.dataset.filled === '1') return Promise.resolve();
  return fetch(API + '/api/recipients')
    .then(r => r.json())
    .then(list => {
      wrap.dataset.filled = '1';
      wrap.innerHTML = (Array.isArray(list) ? list : [])
        .map(
          rec => `
      <label class="email-recipient-item">
        <input type="checkbox" class="email-recipient-cb" value="${escapeHtml(rec.email)}" />
        <span>${escapeHtml(rec.name)}</span>
      </label>
    `
        )
        .join('');
    })
    .catch(() => {
      wrap.innerHTML =
        '<p class="empty-msg">Could not load team list. You can still type addresses below.</p>';
    });
}

function setupDetailEmailPanel() {
  const sec = $('#email-send-section');
  if (!sec) return;
  const intro = $('#email-send-intro');
  const form = $('#email-send-form');
  sec.hidden = false;
  if (window._mailConfigured) {
    if (intro) {
      intro.hidden = true;
      intro.textContent = '';
    }
    if (form) form.hidden = false;
    fillEmailRecipientListOnce().then(() => clearDetailEmailForm());
  } else {
    if (intro) {
      intro.hidden = false;
      intro.textContent =
        'Server email is not configured. To send from here with attachments, set SMTP_HOST, SMTP_USER, and SMTP_PASS on the server (see .env.example). Existing saved reports are not modified.';
    }
    if (form) form.hidden = true;
  }
}

function collectEmailRecipients() {
  const out = [];
  $$('.email-recipient-cb:checked').forEach(c => out.push(c.value));
  const extra = ($('#email-extra') && $('#email-extra').value) || '';
  extra.split(/[\s,;]+/).forEach(s => {
    const t = s.trim();
    if (t.includes('@')) out.push(t.toLowerCase());
  });
  return [...new Set(out.map(x => x.trim().toLowerCase()).filter(Boolean))];
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const repSel = $('#reporter');
  if (!repSel || !repSel.value) {
    alert('Choose who prepared this report from the list.');
    repSel && repSel.focus();
    return;
  }
  const repOpt = repSel.options[repSel.selectedIndex];
  const payload = {
    kks: $('#kks').value.trim(),
    location: $('#location').value.trim(),
    description: $('#description').value.trim(),
    reporterId: repSel.value,
    reporterName: repOpt ? repOpt.textContent.trim() : ''
  };

  try {
    const createRes = await fetch(API + '/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!createRes.ok) throw new Error('Save failed');
    const report = await createRes.json();
    currentReportId = report.id;

    if (pendingFiles.length) {
      const fd = new FormData();
      pendingFiles.forEach(f => fd.append('files', f));
      const uploadRes = await fetch(API + '/api/reports/' + report.id + '/upload', {
        method: 'POST',
        body: fd
      });
      if (uploadRes.ok) {
        const up = await uploadRes.json();
        report.attachments = up.attachments;
      }
    }

    pendingFiles = [];
    fileList.innerHTML = '';
    $('#camera-photo').value = '';
    $('#camera-video').value = '';
    if (audioMediaRecorder && audioMediaRecorder.state === 'recording') {
      stopAudioRecording();
    }
    stopAudioStreamTracks();
    resetAudioButton();
    form.reset();
    fillReporterFormOptions();

    showToast('Report saved.');
    showPanel(panelSaved);
    document.querySelector('.tab[data-tab="saved"]').click();
    loadSavedReports();
  } catch (err) {
    alert('Failed to save report. Make sure the server is running.');
  }
});

savedList.addEventListener('click', (e) => {
  const delBtn = e.target.closest('.btn-saved-delete');
  if (delBtn) {
    e.preventDefault();
    const id = delBtn.getAttribute('data-id');
    if (id && confirm('Delete this report? This cannot be undone.')) deleteReport(id);
    return;
  }
  const main = e.target.closest('.saved-item-main');
  if (main) {
    const li = main.closest('li[data-id]');
    if (li) openReportDetail(li.dataset.id);
  }
});

savedList.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const main = e.target.closest('.saved-item-main');
  if (main) {
    e.preventDefault();
    const li = main.closest('li[data-id]');
    if (li) openReportDetail(li.dataset.id);
  }
});

function loadSavedReports() {
  fetch(API + '/api/reports')
    .then(r => r.json())
    .then(reports => {
      cachedSavedReports = reports;
      const q = (savedSearch && savedSearch.value) ? savedSearch.value.trim().toLowerCase() : '';
      const filtered = filterReportsByQuery(reports, q);
      renderSavedList(filtered, { emptyFromFilter: !!(q && !filtered.length) });
    })
    .catch(() => {
      cachedSavedReports = [];
      savedEmpty.style.display = 'block';
      savedEmpty.textContent = 'Error loading reports.';
      savedList.innerHTML = '';
    });
}

if (savedSearch) {
  savedSearch.addEventListener('input', () => {
    const q = savedSearch.value.trim().toLowerCase();
    const filtered = filterReportsByQuery(cachedSavedReports, q);
    renderSavedList(filtered, { emptyFromFilter: !!(q && !filtered.length) });
  });
}

function openReportDetail(id) {
  currentReportId = id;
  fetch(API + '/api/reports/' + id)
    .then(r => r.json())
    .then(report => {
      window._detailReport = report;
      renderDetailReport(report);
      fillDetailReporterSelect(report.reporterId, report.reporterName);
      $('#detail-desc').value = report.description || '';
      $('#detail-attachments').value = '';
      showPanel(panelDetail);
      setupDetailEmailPanel();
    })
    .catch(() => alert('Could not load report.'));
}

function attachmentRowHtml(a, baseUrl) {
  const path = a.path || '';
  const href = baseUrl + path;
  const isPgApi = path.indexOf('/api/attachments/') === 0;
  const joinQ = (u, q) => u + (u.indexOf('?') >= 0 ? '&' : '?') + q;
  const openHref = isPgApi ? joinQ(href, 'view=1') : href;
  const downloadHref = isPgApi ? joinQ(href, 'download=1') : href;
  const previewHref = attachmentPreviewHref(a, baseUrl, true);
  const nameEsc = escapeHtml(a.name || 'file');
  const dlAttr = String(a.name || 'file').replace(/["\r\n<>&]/g, '_');
  const hasPreview = isImageAttachment(a);
  const aid = escapeHtml(a.id || '');
  const pathEsc = escapeHtml(path);
  return `
    <div class="attachment-row">
      <span class="attachment-main">
        ${hasPreview ? `<img src="${previewHref}" alt="${nameEsc}" class="attachment-thumb" loading="lazy" />` : ''}
        <span class="attachment-name">${nameEsc}</span>
      </span>
      <span class="attachment-actions">
        <a href="${openHref}" target="_blank" rel="noopener noreferrer" class="btn-attachment">Open</a>
        <a href="${downloadHref}" download="${dlAttr}" class="btn-attachment btn-attachment-secondary">Download</a>
        <button type="button" class="btn-attachment btn-attachment-danger btn-delete-attachment" data-attachment-id="${aid}" data-attachment-path="${pathEsc}">Delete</button>
      </span>
    </div>`;
}

function renderDetailReport(report) {
  const baseUrl = window.location.origin;
  detailContent.innerHTML = `
    <div class="detail-field">
      <label>KKS</label>
      <div class="value">${escapeHtml(report.kks || '-')}</div>
    </div>
    <div class="detail-field">
      <label>Location</label>
      <div class="value">${escapeHtml(report.location || '-')}</div>
    </div>
    <div class="detail-field">
      <label>Prepared by</label>
      <div class="value">${escapeHtml((report.reporterName || '').trim() || '—')}</div>
    </div>
    <div class="detail-field">
      <label>Description</label>
      <div class="value">${escapeHtml(report.description || '-')}</div>
    </div>
    <div class="detail-field">
      <label>Attachments</label>
      <p class="attachment-hint">Preview thumbnails for images. Open in browser when supported; Download keeps a copy.</p>
      <div class="attachments-list">
        ${(report.attachments && report.attachments.length)
          ? report.attachments.map(a => attachmentRowHtml(a, baseUrl)).join('')
          : '<span class="value">None</span>'}
      </div>
    </div>
    <div class="detail-field">
      <label>Date</label>
      <div class="value">${new Date(report.updatedAt).toLocaleString()}</div>
    </div>
  `;
}

$('#back-to-saved').addEventListener('click', () => {
  const es = $('#email-send-section');
  if (es) es.hidden = true;
  showPanel(panelSaved);
  loadSavedReports();
});

$('#back-to-form').addEventListener('click', () => {
  $$('.tab').forEach(t => t.classList.remove('active'));
  $('.tab[data-tab="form"]').classList.add('active');
  showPanel(panelForm);
});

$('#copy-detail').addEventListener('click', () => {
  const r = window._detailReport;
  if (!r) return;
  const text = buildReportText(r);
  copyToClipboard(text).then(() => {
    showCopyFeedback($('#copy-detail-feedback'));
  }).catch(() => {
    showCopyFeedback($('#copy-detail-feedback'), 'Could not copy');
  });
});

$('#delete-detail').addEventListener('click', () => {
  const id = currentReportId;
  if (!id) return;
  if (!confirm('Delete this report permanently? Attachments will be removed too.')) return;
  deleteReport(id);
});

detailContent.addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-delete-attachment');
  if (!btn) return;
  const id = currentReportId;
  if (!id) return;
  if (!confirm('Delete this attachment from the report?')) return;
  const attachmentId = btn.getAttribute('data-attachment-id') || '';
  const attachmentPath = btn.getAttribute('data-attachment-path') || '';
  btn.disabled = true;
  try {
    const res = await fetch(API + '/api/reports/' + id + '/attachments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attachmentId,
        path: attachmentPath
      })
    });
    if (!res.ok) throw new Error();
    const refresh = await fetch(API + '/api/reports/' + id);
    const updated = await refresh.json();
    window._detailReport = updated;
    renderDetailReport(updated);
    showToast('Attachment deleted.');
    loadSavedReports();
  } catch (err) {
    alert('Could not delete attachment.');
  } finally {
    btn.disabled = false;
  }
});

$('#copy-whatsapp').addEventListener('click', () => {
  const r = window._detailReport;
  if (!r) return;
  const text = buildWhatsAppText(r);
  copyToClipboard(text).then(() => {
    showCopyFeedback($('#copy-detail-feedback'), 'WhatsApp text copied');
  }).catch(() => {
    showCopyFeedback($('#copy-detail-feedback'), 'Could not copy');
  });
});

const btnSendEmail = $('#btn-send-email');
if (btnSendEmail) {
  btnSendEmail.addEventListener('click', async () => {
    const id = currentReportId;
    if (!id || !window._mailConfigured) return;
    const to = collectEmailRecipients();
    if (!to.length) {
      alert('Select at least one team member or enter an additional email address.');
      return;
    }
    btnSendEmail.disabled = true;
    const fb = $('#email-send-feedback');
    if (fb) {
      fb.style.visibility = 'visible';
      fb.textContent = 'Sending…';
    }
    try {
      const r = await fetch(API + '/api/reports/' + id + '/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || r.statusText);
      if (fb) {
        fb.textContent =
          'Sent to ' + to.length + ' address(es), ' + (j.attachmentCount || 0) + ' attachment(s).';
      }
      showToast('Email sent.');
      setTimeout(() => {
        if (fb) fb.style.visibility = 'hidden';
      }, 5000);
    } catch (e) {
      alert(e.message || 'Send failed');
      if (fb) fb.style.visibility = 'hidden';
    } finally {
      btnSendEmail.disabled = false;
    }
  });
}

$('#save-detail').addEventListener('click', async () => {
  const id = currentReportId;
  if (!id) return;
  const description = $('#detail-desc').value.trim();
  const extraFiles = Array.from($('#detail-attachments').files || []);

  try {
    const dSel = $('#detail-reporter');
    const rid = (dSel && dSel.value) || '';
    let rname = '';
    if (rid) {
      const fromList = (window._reportersList || []).find(r => r.id === rid);
      rname = fromList
        ? fromList.name
        : (dSel.options[dSel.selectedIndex] && dSel.options[dSel.selectedIndex].textContent.trim()) || '';
    }
    if (description !== undefined) {
      await fetch(API + '/api/reports/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          reporterId: rid,
          reporterName: rname
        })
      });
    }
    if (extraFiles.length) {
      const fd = new FormData();
      extraFiles.forEach(f => fd.append('files', f));
      await fetch(API + '/api/reports/' + id + '/upload', { method: 'POST', body: fd });
    }
    const res = await fetch(API + '/api/reports/' + id);
    const updated = await res.json();
    window._detailReport = updated;
    renderDetailReport(updated);
    fillDetailReporterSelect(updated.reporterId, updated.reporterName);
    $('#detail-desc').value = updated.description || '';
    $('#detail-attachments').value = '';
    showCopyFeedback($('#copy-detail-feedback'), 'Saved');
  } catch (err) {
    alert('Error saving.');
  }
});

if ('serviceWorker' in navigator) {
  const allowSw = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (allowSw) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}
