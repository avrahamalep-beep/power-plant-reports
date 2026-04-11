const nodemailer = require('nodemailer');

function smtpConfigured() {
  const host = process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim();
  const user = process.env.SMTP_USER && String(process.env.SMTP_USER).trim();
  const pass = process.env.SMTP_PASS && String(process.env.SMTP_PASS).trim();
  return Boolean(host && user && pass);
}

function buildReportEmailBody(report) {
  return [
    '--- Power Plant Malfunction Report ---',
    '',
    'KKS: ' + (report.kks || '-'),
    'Location: ' + (report.location || '-'),
    'Prepared by: ' + ((report.reporterName || '').trim() || '-'),
    '',
    'Description:',
    (report.description || '-'),
    ''
  ].join('\n');
}

function safeSubjectPart(s) {
  return String(s || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\w\s\-.,()/+]/gi, '')
    .trim()
    .slice(0, 80);
}

/**
 * @param {{ to: string[], subject: string, text: string, attachments: { filename: string, contentType: string, buffer: Buffer }[] }} opts
 */
async function sendReportWithAttachments(opts) {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    ...(process.env.SMTP_TLS_REJECT_UNAUTHORIZED === '0'
      ? { tls: { rejectUnauthorized: false } }
      : {})
  });
  const from = (process.env.MAIL_FROM && String(process.env.MAIL_FROM).trim()) || process.env.SMTP_USER;
  const mailAttachments = (opts.attachments || []).map(a => ({
    filename: a.filename,
    contentType: a.contentType,
    content: a.buffer
  }));
  await transporter.sendMail({
    from,
    to: opts.to.join(', '),
    subject: opts.subject,
    text: opts.text,
    attachments: mailAttachments
  });
}

module.exports = {
  smtpConfigured,
  buildReportEmailBody,
  safeSubjectPart,
  sendReportWithAttachments
};
