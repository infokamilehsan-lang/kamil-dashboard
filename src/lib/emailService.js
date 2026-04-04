const SETTINGS_KEY = 'email_notification_settings';
const EMAIL_LOG_KEY = 'email_sent_log';
const CONTACTS_KEY = 'email_saved_contacts';

export function getEmailSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { enabled: true, ownerEmail: 'infokamilstoreitalia@gmail.com' };
  } catch {
    return { enabled: true, ownerEmail: 'infokamilstoreitalia@gmail.com' };
  }
}

export function saveEmailSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getEmailLog() {
  try {
    const raw = localStorage.getItem(EMAIL_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendEmailLog(entry) {
  const log = getEmailLog();
  log.unshift({ ...entry, id: `em-${Date.now()}`, sentAt: new Date().toISOString() });
  // keep last 200
  localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify(log.slice(0, 200)));
}

export function clearEmailLog() {
  localStorage.setItem(EMAIL_LOG_KEY, JSON.stringify([]));
}

// ── Saved Contacts ──────────────────────────────────────────────
export function getSavedContacts() {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveContact(contact) {
  const contacts = getSavedContacts();
  const existing = contacts.findIndex(c => c.email === contact.email);
  if (existing >= 0) {
    contacts[existing] = { ...contacts[existing], ...contact };
  } else {
    contacts.unshift({ ...contact, id: `c-${Date.now()}` });
  }
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts.slice(0, 500)));
}

export function deleteContact(id) {
  const contacts = getSavedContacts().filter(c => c.id !== id);
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

/**
 * Send a notification email to a client.
 */
export async function sendClientEmail({ to, toName, subject, message, shopName, emailCfg }) {
  const settings = emailCfg || getEmailSettings();
  const base = { to, toName: toName || 'Customer', subject, message, shopName };

  if (!to || !to.includes('@')) {
    appendEmailLog({ ...base, status: 'failed', error: 'Invalid email address.' });
    return { success: false, error: 'Invalid email address.' };
  }
  if (settings.enabled === false) {
    appendEmailLog({ ...base, status: 'failed', error: 'Email notifications are disabled. Enable in Settings → Email.' });
    return { success: false, error: 'Email notifications are disabled.', disabled: true };
  }
  const hasBrevo = !!(settings.brevoApiKey && settings.brevoSenderEmail);
  if (!hasBrevo) {
    appendEmailLog({ ...base, status: 'failed', error: 'Email not configured. Add Brevo API key in Settings → Email.' });
    return { success: false, error: 'Email settings not configured.' };
  }

  try {
    const initial = (shopName || 'S').charAt(0).toUpperCase();
    const logoUrl = settings.shopLogoUrl || '';
    const htmlContent = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px;text-align:center;border-bottom:2px solid #f3f4f6;">\n
            ${logoUrl
        ? `<img src="${logoUrl}" alt="${shopName}" style="height:80px;width:auto;border-radius:12px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />`
        : `<div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:#f3f4f6;line-height:64px;text-align:center;font-size:28px;font-weight:bold;color:#374151;margin-bottom:12px;">${initial}</div>`
      }
            <h1 style="margin:0;color:#1f2937;font-size:20px;font-weight:700;">${shopName || 'Our Shop'}</h1>
            <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${settings.brevoSenderEmail || ''}</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">${message.replace(/\n/g, '<br>')}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">${shopName || 'Our Shop'} &nbsp;·&nbsp; ${settings.brevoSenderEmail || ''}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const brevoBody = {
      sender: { name: shopName || 'Our Shop', email: settings.brevoSenderEmail },
      to: [{ email: to, name: toName || 'Customer' }],
      subject,
      htmlContent,
    };
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': settings.brevoApiKey },
      body: JSON.stringify(brevoBody),
    });
    const resData = await res.json();
    if (!res.ok) throw new Error(resData?.message || `Brevo error ${res.status}`);
    appendEmailLog({ ...base, status: 'sent' });
    return { success: true };
  } catch (err) {
    console.error('Brevo send error:', err);
    const error = err?.text || err?.message || JSON.stringify(err) || 'Failed to send email.';
    appendEmailLog({ ...base, status: 'failed', error });
    return { success: false, error };
  }
}

