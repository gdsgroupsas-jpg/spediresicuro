/**
 * Email Service — Resend
 *
 * Servizio centralizzato per invio email transazionali.
 * Resend Free tier: 100 email/giorno, 3000/mese.
 *
 * Usage:
 *   import { sendEmail, sendShipmentConfirmation, sendWalletTopUp } from '@/lib/email/resend';
 */

import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

const FROM_EMAIL = 'SpedireSicuro <noreply@spediresicuro.it>';

// ─── TYPES ───

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

interface ShipmentConfirmationParams {
  to: string;
  recipientName: string;
  trackingNumber: string;
  carrier: string;
  senderCity: string;
  recipientCity: string;
  cost: number;
}

interface WalletTopUpParams {
  to: string;
  userName: string;
  amount: number;
  method: 'stripe' | 'bank_transfer';
  newBalance?: number;
}

interface ShipmentTrackingUpdateParams {
  to: string;
  trackingNumber: string;
  carrier: string;
  status: string;
  statusLabel: string;
  recipientName: string;
}

// ─── CORE SEND ───

export async function sendEmail({ to, subject, html, replyTo }: SendEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ [EMAIL] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      replyTo,
    });

    if (error) {
      console.error('❌ [EMAIL] Send failed:', error);
      return { success: false, error: error.message };
    }

    console.log(
      `✅ [EMAIL] Sent to ${Array.isArray(to) ? to.join(', ') : to}: "${subject}" (id: ${data?.id})`
    );
    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('❌ [EMAIL] Exception:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── SHIPMENT CONFIRMATION ───

export async function sendShipmentConfirmation(params: ShipmentConfirmationParams) {
  const { to, recipientName, trackingNumber, carrier, senderCity, recipientCity, cost } = params;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">📦 Spedizione Confermata</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">La tua spedizione è stata creata con successo!</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tracking</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${trackingNumber}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Corriere</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right; font-size: 14px;">${carrier.toUpperCase()}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tratta</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right; font-size: 14px;">${senderCity} → ${recipientCity}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Destinatario</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right; font-size: 14px;">${recipientName}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0 8px; color: #64748b; font-size: 14px; font-weight: 600;">Costo</td>
              <td style="padding: 12px 0 8px; color: #1e40af; font-weight: 700; text-align: right; font-size: 16px;">€${cost.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          Puoi monitorare la spedizione dalla tua <a href="https://spediresicuro.it/dashboard" style="color: #3b82f6;">dashboard</a>.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `📦 Spedizione confermata — ${trackingNumber}`,
    html,
  });
}

// ─── WALLET TOP-UP CONFIRMATION ───

export async function sendWalletTopUp(params: WalletTopUpParams) {
  const { to, userName, amount, method, newBalance } = params;

  const methodLabel = method === 'stripe' ? 'Carta di credito (Stripe)' : 'Bonifico bancario';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">💰 Ricarica Confermata</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">Ciao ${userName || 'utente'},</p>
        <p style="color: #334155; font-size: 16px;">La tua ricarica wallet è stata accreditata con successo.</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Importo</td>
              <td style="padding: 8px 0; color: #059669; font-weight: 700; text-align: right; font-size: 18px;">+€${amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Metodo</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right; font-size: 14px;">${methodLabel}</td>
            </tr>
            ${
              newBalance !== undefined
                ? `
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0 8px; color: #64748b; font-size: 14px;">Nuovo saldo</td>
              <td style="padding: 12px 0 8px; color: #1e293b; font-weight: 600; text-align: right; font-size: 16px;">€${newBalance.toFixed(2)}</td>
            </tr>
            `
                : ''
            }
          </table>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `💰 Ricarica €${amount.toFixed(2)} confermata`,
    html,
  });
}

// ─── TRACKING UPDATE ───

export async function sendTrackingUpdate(params: ShipmentTrackingUpdateParams) {
  const { to, trackingNumber, carrier, status, statusLabel, recipientName } = params;

  const statusColors: Record<string, string> = {
    delivered: '#059669',
    in_transit: '#3b82f6',
    out_for_delivery: '#f59e0b',
    exception: '#ef4444',
    returned: '#6b7280',
  };

  const color = statusColors[status] || '#3b82f6';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${color}; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🚚 Aggiornamento Spedizione</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #64748b; font-size: 13px; margin: 0;">Stato</p>
          <p style="color: ${color}; font-size: 20px; font-weight: 700; margin: 8px 0;">${statusLabel}</p>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">${carrier.toUpperCase()} — ${trackingNumber}</p>
        </div>
        <p style="color: #64748b; font-size: 13px;">Destinatario: ${recipientName}</p>
        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          <a href="https://spediresicuro.it/dashboard" style="color: #3b82f6;">Vedi dettagli nella dashboard</a>
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `🚚 ${statusLabel} — ${trackingNumber}`,
    html,
  });
}

// ─── WELCOME EMAIL (Nuovo Account) ───

interface WelcomeEmailParams {
  to: string;
  userName: string;
  password: string;
  loginUrl?: string;
  createdBy?: string; // Nome del reseller/admin che ha creato l'account
  companyName?: string; // Nome azienda del reseller (per branding)
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const {
    to,
    userName,
    password,
    loginUrl = 'https://spediresicuro.it/login',
    createdBy,
    companyName,
  } = params;

  const brandName = companyName || 'SpedireSicuro';
  const createdByText = createdBy
    ? `<p style="color: #64748b; font-size: 14px;">Il tuo account è stato creato da <strong>${createdBy}</strong>.</p>`
    : '';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Benvenuto su ${brandName}!</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">Ciao <strong>${userName}</strong>,</p>
        <p style="color: #334155; font-size: 16px;">Il tuo account è stato creato con successo. Ecco le tue credenziali di accesso:</p>

        ${createdByText}

        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 12px 0; color: #64748b; font-size: 14px; width: 100px;">Email</td>
              <td style="padding: 12px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${to}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #64748b; font-size: 14px; border-top: 1px solid #e2e8f0;">Password</td>
              <td style="padding: 12px 0; color: #1e293b; font-weight: 600; font-size: 14px; font-family: monospace; background: #f1f5f9; padding-left: 8px; border-radius: 4px; border-top: 1px solid #e2e8f0;">${password}</td>
            </tr>
          </table>
        </div>

        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="color: #92400e; font-size: 13px; margin: 0;">
            <strong>⚠️ Importante:</strong> Ti consigliamo di cambiare la password al primo accesso per maggiore sicurezza.
          </p>
        </div>

        <div style="text-align: center; margin-top: 24px;">
          <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #f97316); color: white; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Accedi al tuo account →
          </a>
        </div>

        <p style="color: #64748b; font-size: 13px; margin-top: 24px; margin-bottom: 0;">
          Se hai problemi ad accedere, contatta il supporto rispondendo a questa email.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        ${brandName} — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `🎉 Benvenuto su ${brandName} — Le tue credenziali di accesso`,
    html,
  });
}

// ─── PASSWORD RESET EMAIL ───

interface PasswordResetEmailParams {
  to: string;
  userName: string;
  resetUrl: string;
  expiresIn?: string; // es. "1 ora"
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams) {
  const { to, userName, resetUrl, expiresIn = '1 ora' } = params;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #7c3aed, #a855f7); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔐 Reset Password</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">Ciao <strong>${userName}</strong>,</p>
        <p style="color: #334155; font-size: 16px;">Abbiamo ricevuto una richiesta per reimpostare la password del tuo account.</p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #a855f7); color: white; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Reimposta Password →
          </a>
        </div>

        <div style="background: #f1f5f9; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="color: #64748b; font-size: 13px; margin: 0;">
            ⏱️ Questo link scadrà tra <strong>${expiresIn}</strong>.
          </p>
        </div>

        <p style="color: #64748b; font-size: 13px;">
          Se non hai richiesto tu il reset della password, puoi ignorare questa email. La tua password rimarrà invariata.
        </p>

        <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="color: #991b1b; font-size: 13px; margin: 0;">
            <strong>🔒 Sicurezza:</strong> Non condividere mai questo link con nessuno. SpedireSicuro non ti chiederà mai la password via email.
          </p>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: '🔐 Reimposta la tua password — SpedireSicuro',
    html,
  });
}

// ─── PASSWORD CHANGED CONFIRMATION ───

interface PasswordChangedEmailParams {
  to: string;
  userName: string;
  changedAt?: Date;
}

export async function sendPasswordChangedEmail(params: PasswordChangedEmailParams) {
  const { to, userName, changedAt = new Date() } = params;

  const formattedDate = changedAt.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">✅ Password Modificata</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">Ciao <strong>${userName}</strong>,</p>
        <p style="color: #334155; font-size: 16px;">La password del tuo account SpedireSicuro è stata modificata con successo.</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Data modifica</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 500; text-align: right; font-size: 14px;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Account</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right; font-size: 14px;">${to}</td>
            </tr>
          </table>
        </div>

        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="color: #92400e; font-size: 13px; margin: 0;">
            <strong>⚠️ Non sei stato tu?</strong> Se non hai modificato tu la password, contattaci immediatamente rispondendo a questa email.
          </p>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: '✅ Password modificata — SpedireSicuro',
    html,
  });
}
