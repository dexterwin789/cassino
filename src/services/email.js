const fetch = require('node-fetch');

const DEFAULT_FROM = 'VemNaBet <no-reply@vemnabet.bet>';

function isEmailConfigured() {
  return process.env.EMAIL_ENABLED !== '0' && !!process.env.RESEND_API_KEY;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function textFromHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderEmail({ title, preview, bodyHtml, ctaText, ctaUrl }) {
  const safeTitle = escapeHtml(title);
  const safePreview = escapeHtml(preview || title);
  const button = ctaText && ctaUrl ? `
    <p style="margin:28px 0 10px">
      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#10b981;color:#07140f;text-decoration:none;font-weight:800;border-radius:10px;padding:13px 22px">${escapeHtml(ctaText)}</a>
    </p>` : '';

  return `<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#0d1b2a;color:#f6f6f6;font-family:Inter,Arial,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">${safePreview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d1b2a;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#13283f;border:1px solid #1f3a5a;border-radius:16px;overflow:hidden">
          <tr><td style="padding:28px 28px 20px">
            <div style="font-size:22px;font-weight:900;color:#34d399;margin-bottom:18px">VemNaBet</div>
            <h1 style="font-size:22px;line-height:1.25;margin:0 0 14px;color:#ffffff">${safeTitle}</h1>
            <div style="font-size:15px;line-height:1.65;color:#c9d8e7">${bodyHtml}</div>
            ${button}
          </td></tr>
          <tr><td style="padding:16px 28px 24px;border-top:1px solid #1f3a5a;color:#7892aa;font-size:12px;line-height:1.5">
            Este e-mail foi enviado pela VemNaBet. Se você não reconhece esta mensagem, ignore com segurança.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendEmail({ to, subject, html, text }) {
  const email = String(to || '').trim();
  if (!isValidEmail(email)) return { ok: false, skipped: true, reason: 'invalid_recipient' };
  if (!isEmailConfigured()) return { ok: false, skipped: true, reason: 'resend_not_configured' };

  const payload = {
    from: process.env.MAIL_FROM || process.env.EMAIL_FROM || DEFAULT_FROM,
    to: [email],
    subject,
    html,
    text: text || textFromHtml(html)
  };
  if (process.env.MAIL_REPLY_TO) payload.reply_to = process.env.MAIL_REPLY_TO;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      timeout: 12000
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, skipped: false, status: response.status, error: data.message || data.error || 'resend_error' };
    }
    return { ok: true, id: data.id || null };
  } catch (err) {
    return { ok: false, skipped: false, error: err.message || 'email_send_failed' };
  }
}

async function sendPasswordResetEmail({ to, username, link, expiresMinutes = 30 }) {
  const html = renderEmail({
    title: 'Redefinição de senha',
    preview: 'Use o link seguro para criar uma nova senha.',
    bodyHtml: `
      <p style="margin:0 0 12px">Olá${username ? ', ' + escapeHtml(username) : ''}.</p>
      <p style="margin:0 0 12px">Recebemos uma solicitação para redefinir a senha da sua conta.</p>
      <p style="margin:0">O link abaixo expira em ${escapeHtml(expiresMinutes)} minutos e só pode ser usado uma vez.</p>`,
    ctaText: 'Redefinir senha',
    ctaUrl: link
  });
  return sendEmail({ to, subject: 'Redefinir sua senha na VemNaBet', html });
}

async function sendNotificationEmail(user, notification) {
  const title = notification.title || notification.titulo || 'Nova notificação';
  const message = notification.message || notification.mensagem || '';
  const link = notification.link || '';
  const html = renderEmail({
    title,
    preview: message || title,
    bodyHtml: `
      <p style="margin:0 0 12px">Olá${user?.username ? ', ' + escapeHtml(user.username) : ''}.</p>
      <p style="margin:0">${escapeHtml(message || title).replace(/\n/g, '<br>')}</p>`,
    ctaText: link ? 'Abrir na VemNaBet' : '',
    ctaUrl: link
  });
  return sendEmail({ to: user?.email, subject: `VemNaBet: ${title}`, html });
}

async function sendNotificationEmails(users, notification) {
  const summary = { attempted: 0, sent: 0, skipped: 0, failed: 0 };
  for (const user of users || []) {
    summary.attempted++;
    const result = await sendNotificationEmail(user, notification);
    if (result.ok) summary.sent++;
    else if (result.skipped) summary.skipped++;
    else summary.failed++;
  }
  return summary;
}

module.exports = {
  isEmailConfigured,
  sendEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  sendNotificationEmails
};
