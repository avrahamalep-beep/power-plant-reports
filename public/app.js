const API = '';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => el.querySelectorAll(s);

let recipients = [];
let pendingFiles = [];
let currentReportId = null;

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

function updateRecipientSelectionUI() {
  const list = $('#recipients-list');
  if (!list) return;
  list.querySelectorAll('.recipient-chip').forEach(chip => {
    const cb = chip.querySelector('input[type="checkbox"]');
    if (cb) chip.classList.toggle('selected', cb.checked);
  });
  const countEl = $('#recipient-count');
  const total = $$('input[name="recipient"]').length;
  const n = $$('input[name="recipient"]:checked').length;
  if (countEl) {
    countEl.textContent = total
      ? (n === total ? `All ${total} contacts selected` : `${n} of ${total} selected`)
      : '';
  }
}

function filterReportsByQuery(reports, q) {
  if (!q) return reports;
  return reports.filter(r => {
    const attNames = (r.attachments || []).map(a => a.name).join(' ');
    const blob = [r.kks, r.location, r.description, attNames].join(' ').toLowerCase();
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
    return `
          <li data-id="${r.id}">
            <div class="saved-item-main" role="button" tabindex="0">
              <div class="report-kks">${r.kks || '(no KKS)'}</div>
              <div class="report-meta">${r.location || '-'} · ${date}${attCount ? ' · ' + attCount + ' attachment(s)' : ''}</div>
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
    '',
    'Description:',
    (data.description || '-'),
    '',
    '---'
  ];
  return lines.join('\n');
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
    description: $('#description').value.trim()
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

// Recipients
fetch(API + '/api/recipients')
  .then(r => r.json())
  .then(data => {
    recipients = data;
    const list = $('#recipients-list');
    list.innerHTML = recipients.map(rec => `
      <label class="recipient-chip" data-email="${escapeHtml(rec.email)}">
        <input type="checkbox" name="recipient" value="${escapeHtml(rec.email)}" />
        <span>${escapeHtml(rec.name)}</span>
      </label>
    `).join('');
    list.querySelectorAll('.recipient-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox') {
          const cb = chip.querySelector('input');
          cb.checked = !cb.checked;
          chip.classList.toggle('selected', cb.checked);
        } else {
          chip.classList.toggle('selected', e.target.checked);
        }
        updateRecipientSelectionUI();
      });
    });
    updateRecipientSelectionUI();
    const rf = $('#recipient-filter');
    if (rf && rf.dataset.bound !== '1') {
      rf.dataset.bound = '1';
      rf.addEventListener('input', () => {
        const q = rf.value.trim().toLowerCase();
        list.querySelectorAll('.recipient-chip').forEach((chip) => {
          const hay = ((chip.dataset.email || '') + ' ' + chip.textContent).toLowerCase();
          chip.style.display = !q || hay.includes(q) ? '' : 'none';
        });
      });
    }
  })
  .catch(() => {});

const btnSelectAllRecipients = $('#recipients-select-all');
const btnClearRecipients = $('#recipients-clear');
if (btnSelectAllRecipients) {
  btnSelectAllRecipients.addEventListener('click', () => {
    $$('input[name="recipient"]').forEach(cb => { cb.checked = true; });
    updateRecipientSelectionUI();
  });
}
if (btnClearRecipients) {
  btnClearRecipients.addEventListener('click', () => {
    $$('input[name="recipient"]').forEach(cb => { cb.checked = false; });
    updateRecipientSelectionUI();
  });
}

function getSelectedEmails() {
  const checked = $$('input[name="recipient"]:checked');
  const emails = Array.from(checked).map(c => c.value);
  const custom = $('#custom-recipient').value.trim();
  if (custom) emails.push(custom);
  return emails;
}

function openMailto(reportData) {
  const emails = reportData.sentTo && reportData.sentTo.length
    ? reportData.sentTo
    : (reportData.customRecipient ? [reportData.customRecipient] : getSelectedEmails());
  const body = buildReportText(reportData);
  const subject = `Malfunction Report - KKS: ${reportData.kks || 'N/A'} - ${reportData.location || 'Plant'}`;
  const mailto = 'mailto:' + (emails.length ? emails.join(',') : '') +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
  window.location.href = mailto;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    kks: $('#kks').value.trim(),
    location: $('#location').value.trim(),
    description: $('#description').value.trim(),
    sentTo: getSelectedEmails(),
    customRecipient: $('#custom-recipient').value.trim()
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
    form.reset();
    $$('input[name="recipient"]').forEach(c => { c.checked = false; });
    $$('.recipient-chip').forEach(ch => {
      ch.classList.remove('selected');
      ch.style.display = '';
    });
    updateRecipientSelectionUI();

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

$('#open-email').addEventListener('click', () => {
  openMailto({
    kks: $('#kks').value.trim(),
    location: $('#location').value.trim(),
    description: $('#description').value.trim(),
    sentTo: getSelectedEmails(),
    customRecipient: $('#custom-recipient').value.trim()
  });
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
      $('#detail-desc').value = report.description || '';
      $('#detail-attachments').value = '';
      showPanel(panelDetail);
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
  const nameEsc = escapeHtml(a.name || 'file');
  const dlAttr = String(a.name || 'file').replace(/["\r\n<>&]/g, '_');
  return `
    <div class="attachment-row">
      <span class="attachment-name">${nameEsc}</span>
      <span class="attachment-actions">
        <a href="${openHref}" target="_blank" rel="noopener noreferrer" class="btn-attachment">Open</a>
        <a href="${downloadHref}" download="${dlAttr}" class="btn-attachment btn-attachment-secondary">Download</a>
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
      <label>Description</label>
      <div class="value">${escapeHtml(report.description || '-')}</div>
    </div>
    <div class="detail-field">
      <label>Attachments</label>
      <p class="attachment-hint">Open in the browser when supported; Download keeps a copy.</p>
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

$('#open-email-detail').addEventListener('click', () => {
  const r = window._detailReport;
  if (!r) return;
  openMailto(r);
});

$('#delete-detail').addEventListener('click', () => {
  const id = currentReportId;
  if (!id) return;
  if (!confirm('Delete this report permanently? Attachments will be removed too.')) return;
  deleteReport(id);
});

$('#save-detail').addEventListener('click', async () => {
  const id = currentReportId;
  if (!id) return;
  const description = $('#detail-desc').value.trim();
  const extraFiles = Array.from($('#detail-attachments').files || []);

  try {
    if (description !== undefined) {
      await fetch(API + '/api/reports/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
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
