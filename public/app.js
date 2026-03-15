const API = '';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => el.querySelectorAll(s);

let recipients = [];
let pendingFiles = [];
let currentReportId = null;

const form = $('#report-form');
const panelForm = $('#panel-form');
const panelSent = $('#panel-sent');
const panelDetail = $('#panel-detail');
const sentList = $('#sent-list');
const sentEmpty = $('#sent-empty');
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
    if (tab.dataset.tab === 'sent') {
      showPanel(panelSent);
      loadSentReports();
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
      <label class="recipient-chip" data-email="${rec.email}">
        <input type="checkbox" name="recipient" value="${rec.email}" />
        <span>${rec.name}</span>
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
      });
    });
  })
  .catch(() => {});

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
    $$('.recipient-chip').forEach(ch => ch.classList.remove('selected'));

    showPanel(panelSent);
    document.querySelector('.tab[data-tab="sent"]').click();
    loadSentReports();
  } catch (err) {
    alert('Failed to save report. Make sure the server is running.');
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

function loadSentReports() {
  fetch(API + '/api/reports')
    .then(r => r.json())
    .then(reports => {
      sentEmpty.style.display = reports.length ? 'none' : 'block';
      sentEmpty.textContent = 'No reports saved.';
      sentList.innerHTML = reports.map(r => {
        const date = new Date(r.createdAt).toLocaleString();
        const attCount = (r.attachments && r.attachments.length) || 0;
        return `
          <li data-id="${r.id}">
            <div class="report-kks">${r.kks || '(no KKS)'}</div>
            <div class="report-meta">${r.location || '-'} · ${date}${attCount ? ' · ' + attCount + ' attachment(s)' : ''}</div>
          </li>
        `;
      }).join('');
      sentList.querySelectorAll('li').forEach(li => {
        li.addEventListener('click', () => openReportDetail(li.dataset.id));
      });
    })
    .catch(() => {
      sentEmpty.style.display = 'block';
      sentEmpty.textContent = 'Error loading reports.';
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
      <div class="attachments-list">
        ${(report.attachments && report.attachments.length)
          ? report.attachments.map(a => `<a href="${baseUrl}${a.path}" download="${escapeHtml(a.name)}">${escapeHtml(a.name)}</a>`).join('')
          : '<span class="value">None</span>'}
      </div>
    </div>
    <div class="detail-field">
      <label>Date</label>
      <div class="value">${new Date(report.updatedAt).toLocaleString()}</div>
    </div>
  `;
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

$('#back-to-sent').addEventListener('click', () => {
  showPanel(panelSent);
  loadSentReports();
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
