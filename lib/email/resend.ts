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
export function getResend() {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY || '');
  return _resend;
}

const FROM_EMAIL = 'SpedireSicuro <noreply@spediresicuro.it>';

// ─── TYPES ───

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string; // Mittente custom (default: SpedireSicuro noreply)
  replyTo?: string;
  attachments?: EmailAttachment[];
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

export async function sendEmail({
  to,
  subject,
  html,
  from,
  replyTo,
  attachments,
}: SendEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ [EMAIL] RESEND_API_KEY not configured, skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: from || FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      replyTo,
      ...(attachments?.length ? { attachments } : {}),
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

// ─── TOP-UP REQUEST REJECTED ───

interface TopUpRejectedParams {
  to: string;
  userName: string;
  amount: number;
  reason: string;
}

export async function sendTopUpRejectedEmail(params: TopUpRejectedParams) {
  const { to, userName, amount, reason } = params;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Ricarica Non Approvata</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">Ciao ${userName || 'utente'},</p>
        <p style="color: #334155; font-size: 16px;">La tua richiesta di ricarica wallet non è stata approvata.</p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Importo richiesto</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right; font-size: 16px;">&euro;${amount.toFixed(2)}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Motivo</td>
              <td style="padding: 8px 0; color: #991b1b; text-align: right; font-size: 14px;">${reason}</td>
            </tr>
          </table>
        </div>

        <p style="color: #64748b; font-size: 14px;">
          Puoi riprovare caricando una nuova ricevuta dalla tua <a href="https://spediresicuro.it/dashboard/wallet" style="color: #3b82f6;">pagina wallet</a>.
          Per qualsiasi dubbio, contattaci rispondendo a questa email.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro &mdash; Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Richiesta ricarica non approvata`,
    html,
  });
}

// ─── ADMIN NOTIFICATION: NEW TOP-UP REQUEST ───

interface AdminTopUpNotificationParams {
  adminEmails: string[];
  userName: string;
  userEmail: string;
  amount: number;
  requestId: string;
}

export async function sendAdminTopUpNotificationEmail(params: AdminTopUpNotificationParams) {
  const { adminEmails, userName, userEmail, amount, requestId } = params;

  if (adminEmails.length === 0) return { success: false, error: 'Nessun admin da notificare' };

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Nuova Richiesta Ricarica</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">
          Un utente ha caricato una ricevuta di bonifico e richiede l'accredito wallet.
        </p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Utente</td>
              <td style="padding: 8px 0; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${userName || userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email</td>
              <td style="padding: 8px 0; color: #1e293b; text-align: right; font-size: 14px;">${userEmail}</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 12px 0 8px; color: #64748b; font-size: 14px; font-weight: 600;">Importo dichiarato</td>
              <td style="padding: 12px 0 8px; color: #d97706; font-weight: 700; text-align: right; font-size: 18px;">&euro;${amount.toFixed(2)}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://spediresicuro.it/dashboard/admin/bonifici" style="display: inline-block; background: linear-gradient(135deg, #d97706, #f59e0b); color: white; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Approva / Rifiuta &rarr;
          </a>
        </div>

        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          ID richiesta: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${requestId}</code>
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro &mdash; Notifica automatica per admin
      </div>
    </div>
  `;

  return sendEmail({
    to: adminEmails,
    subject: `Nuova richiesta ricarica €${amount.toFixed(2)} — ${userName || userEmail}`,
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

// ─── PREMIUM WELCOME EMAIL (Ferrari-level onboarding) ───

interface PremiumWelcomeEmailParams {
  to: string;
  userName?: string;
  credentials?: { email: string; password: string }; // solo per client creati da reseller
  resellerName?: string; // nome persona del reseller
  resellerCompany?: string; // nome azienda reseller (branding)
  loginUrl?: string;
}

/**
 * Email di benvenuto PREMIUM — Design Stripe/Linear/Vercel inspired.
 *
 * Due varianti:
 * 1. Self-registration: NO credenziali, CTA → "Completa il tuo profilo"
 * 2. Reseller crea client: CON credenziali + branding reseller, CTA → "Accedi al tuo account"
 *
 * Se resellerCompany è presente → "Benvenuto su [NomeAzienda] powered by SpedireSicuro"
 */
export async function sendPremiumWelcomeEmail(params: PremiumWelcomeEmailParams) {
  const {
    to,
    userName,
    credentials,
    resellerName,
    resellerCompany,
    loginUrl = 'https://spediresicuro.it/dashboard',
  } = params;

  // Sanitizzazione base (anti-XSS nei parametri stringa)
  const esc = (s: string | undefined) =>
    (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const safeName = esc(userName) || 'utente';
  const safeResellerName = esc(resellerName);
  const safeResellerCompany = esc(resellerCompany);
  const safeEmail = esc(credentials?.email);
  const safePassword = esc(credentials?.password);

  // Branding
  const brandName = safeResellerCompany || 'SpedireSicuro';
  const headerTitle = safeResellerCompany
    ? `Benvenuto su ${safeResellerCompany}`
    : 'Benvenuto su SpedireSicuro';
  const headerSubtitle = safeResellerCompany
    ? 'powered by SpedireSicuro'
    : 'La tua piattaforma di spedizioni';

  // Subject line
  const subject = safeResellerCompany
    ? `Benvenuto su ${safeResellerCompany} — Il tuo account è pronto`
    : 'Benvenuto su SpedireSicuro — Il tuo account è pronto';

  // CTA
  const ctaText = credentials ? 'Accedi al tuo account' : 'Completa il tuo profilo';
  // Sanitizzazione URL: solo http/https, no javascript:, data:, etc.
  const ctaUrl =
    loginUrl && /^https?:\/\//i.test(loginUrl) ? loginUrl : 'https://spediresicuro.it/dashboard';

  // Credenziali box (solo per reseller-created)
  const credentialsSection = credentials
    ? `
        <div style="background: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 0 12px 12px 0; padding: 20px; margin: 24px 0;">
          <p style="color: #92400e; font-size: 13px; font-weight: 600; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Le tue credenziali di accesso</p>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #78716c; font-size: 13px; width: 80px;">Email</td>
              <td style="padding: 6px 0; color: #1c1917; font-weight: 600; font-size: 14px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;">${safeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #78716c; font-size: 13px;">Password</td>
              <td style="padding: 6px 0; color: #1c1917; font-weight: 600; font-size: 14px; font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;">${safePassword}</td>
            </tr>
          </table>
          <p style="color: #b45309; font-size: 12px; margin: 12px 0 0 0;">Cambia la password al primo accesso per maggiore sicurezza.</p>
        </div>
    `
    : '';

  // Creato da (solo per reseller-created)
  const createdBySection =
    credentials && safeResellerName
      ? `<p style="color: #64748b; font-size: 14px; margin: 0 0 24px 0;">Il tuo account è stato creato da <strong style="color: #334155;">${safeResellerName}</strong>.</p>`
      : '';

  const html = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- LOGO + HEADER -->
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 24px; color: white; font-weight: 700; text-align: center;">S</div>
    </div>

    <!-- MAIN CARD -->
    <div style="background: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06); overflow: hidden;">

      <!-- GRADIENT ACCENT BAR -->
      <div style="height: 4px; background: linear-gradient(90deg, #f97316, #ea580c, #f97316);"></div>

      <!-- CONTENT -->
      <div style="padding: 40px 36px;">

        <!-- TITLE -->
        <h1 style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 26px; font-weight: 700; margin: 0 0 4px 0; line-height: 1.3;">
          ${headerTitle}
        </h1>
        <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #94a3b8; font-size: 14px; margin: 0 0 28px 0; font-weight: 400;">
          ${headerSubtitle}
        </p>

        <!-- GREETING -->
        <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 8px 0;">
          Ciao <strong style="color: #0f172a;">${safeName}</strong>,
        </p>
        <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          Il tuo account è pronto. Da oggi spedire è semplice, veloce e sotto il tuo controllo.
        </p>

        ${createdBySection}

        ${credentialsSection}

        <!-- 3 STEP ONBOARDING -->
        <div style="margin: 28px 0;">
          <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">
            Inizia in 3 semplici passi
          </p>

          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse: separate; border-spacing: 10px 0;">
            <tr>
              <!-- Step 1 -->
              <td style="width: 33%; vertical-align: top; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 12px; text-align: center;">
                <div style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); width: 32px; height: 32px; border-radius: 50%; line-height: 32px; color: white; font-size: 14px; font-weight: 700; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; text-align: center;">1</div>
                <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 14px; font-weight: 600; margin: 10px 0 4px 0;">Profilo</p>
                <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #94a3b8; font-size: 12px; margin: 0;">Completa i tuoi dati — 2 minuti</p>
              </td>

              <!-- Step 2 -->
              <td style="width: 33%; vertical-align: top; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 12px; text-align: center;">
                <div style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); width: 32px; height: 32px; border-radius: 50%; line-height: 32px; color: white; font-size: 14px; font-weight: 700; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; text-align: center;">2</div>
                <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 14px; font-weight: 600; margin: 10px 0 4px 0;">Wallet</p>
                <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #94a3b8; font-size: 12px; margin: 0;">Ricarica il saldo per spedire</p>
              </td>

              <!-- Step 3 -->
              <td style="width: 33%; vertical-align: top; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px 12px; text-align: center;">
                <div style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); width: 32px; height: 32px; border-radius: 50%; line-height: 32px; color: white; font-size: 14px; font-weight: 700; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; text-align: center;">3</div>
                <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; font-size: 14px; font-weight: 600; margin: 10px 0 4px 0;">Spedisci</p>
                <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #94a3b8; font-size: 12px; margin: 0;">Crea la tua prima spedizione</p>
              </td>
            </tr>
          </table>
        </div>

        <!-- CTA BUTTON -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${ctaUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316, #ea580c); color: #ffffff; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 600; font-size: 16px; padding: 16px 40px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 16px rgba(249, 115, 22, 0.3); letter-spacing: 0.2px;">
            ${ctaText} &rarr;
          </a>
        </div>

        <!-- SOCIAL PROOF -->
        <div style="text-align: center; margin: 24px 0 0 0; padding-top: 24px; border-top: 1px solid #f1f5f9;">
          <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #94a3b8; font-size: 13px; font-style: italic; margin: 0;">
            &ldquo;Ogni giorno oltre <strong style="color: #64748b;">500 aziende italiane</strong> spediscono con SpedireSicuro&rdquo;
          </p>
        </div>
      </div>
    </div>

    <!-- FOOTER -->
    <div style="text-align: center; padding: 28px 0 0 0;">
      <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #94a3b8; font-size: 13px; margin: 0 0 4px 0;">
        Hai bisogno di aiuto? <a href="mailto:assistenza@spediresicuro.it" style="color: #f97316; text-decoration: none; font-weight: 500;">assistenza@spediresicuro.it</a>
      </p>
      <p style="font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #cbd5e1; font-size: 12px; margin: 0;">
        ${brandName} &mdash; Spedizioni semplici e sicure &copy; ${new Date().getFullYear()}
      </p>
    </div>

  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject,
    html,
  });
}

// ─── WELCOME EMAIL (Legacy — usata come fallback) ───

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

// ─── WORKSPACE INVITATION EMAIL ───

interface WorkspaceInvitationEmailParams {
  to: string;
  inviterName: string;
  workspaceName: string;
  organizationName: string;
  role: 'admin' | 'operator' | 'viewer';
  inviteUrl: string;
  expiresAt: Date;
  message?: string;
}

export async function sendWorkspaceInvitationEmail(params: WorkspaceInvitationEmailParams) {
  const { to, inviterName, workspaceName, organizationName, role, inviteUrl, expiresAt, message } =
    params;

  const roleLabels: Record<string, string> = {
    admin: 'Amministratore',
    operator: 'Operatore',
    viewer: 'Visualizzatore',
  };

  const roleDescriptions: Record<string, string> = {
    admin: 'Gestione completa del workspace, membri e impostazioni',
    operator: 'Creazione spedizioni e gestione contatti',
    viewer: 'Solo visualizzazione dati',
  };

  const formattedExpiry = expiresAt.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const messageSection = message
    ? `
      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin: 16px 0;">
        <p style="color: #166534; font-size: 13px; margin: 0; font-style: italic;">
          "${message}"
        </p>
        <p style="color: #15803d; font-size: 12px; margin: 8px 0 0 0; font-weight: 500;">
          — ${inviterName}
        </p>
      </div>
    `
    : '';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #FF9500, #FF6B35); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">👋 Sei stato invitato!</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">
          <strong>${inviterName}</strong> ti ha invitato a unirti al workspace <strong>${workspaceName}</strong> di <strong>${organizationName}</strong>.
        </p>

        ${messageSection}

        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px;">Organizzazione</td>
              <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${organizationName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-top: 1px solid #f1f5f9;">Workspace</td>
              <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${workspaceName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-top: 1px solid #f1f5f9;">Ruolo assegnato</td>
              <td style="padding: 10px 0; text-align: right;">
                <span style="background: linear-gradient(135deg, #FF9500, #FF6B35); color: white; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">
                  ${roleLabels[role] || role}
                </span>
              </td>
            </tr>
          </table>
          <p style="color: #64748b; font-size: 12px; margin: 12px 0 0 0; padding-top: 12px; border-top: 1px solid #f1f5f9;">
            ${roleDescriptions[role] || ''}
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF9500, #FF6B35); color: white; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px; box-shadow: 0 4px 12px rgba(255, 149, 0, 0.3);">
            Accetta Invito →
          </a>
        </div>

        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="color: #92400e; font-size: 13px; margin: 0;">
            ⏱️ Questo invito scade il <strong>${formattedExpiry}</strong>
          </p>
        </div>

        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          Se non conosci ${inviterName} o non ti aspettavi questo invito, puoi ignorare questa email.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `👋 ${inviterName} ti ha invitato su ${workspaceName} — SpedireSicuro`,
    html,
  });
}

// ─── INVITATION ACCEPTED NOTIFICATION EMAIL ───

interface InvitationAcceptedEmailParams {
  to: string; // Email dell'invitante
  inviterName: string;
  acceptedByName: string;
  acceptedByEmail: string;
  workspaceName: string;
  role: 'admin' | 'operator' | 'viewer';
}

export async function sendInvitationAcceptedEmail(params: InvitationAcceptedEmailParams) {
  const { to, inviterName, acceptedByName, acceptedByEmail, workspaceName, role } = params;

  const roleLabels: Record<string, string> = {
    admin: 'Amministratore',
    operator: 'Operatore',
    viewer: 'Visualizzatore',
  };

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">✅ Invito Accettato!</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">
          Ciao <strong>${inviterName}</strong>,
        </p>
        <p style="color: #334155; font-size: 16px;">
          Buone notizie! Il tuo invito è stato accettato.
        </p>

        <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #FF9500, #FF6B35); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 18px;">
              ${acceptedByName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 16px;">${acceptedByName}</p>
              <p style="margin: 0; color: #64748b; font-size: 14px;">${acceptedByEmail}</p>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-top: 1px solid #f1f5f9;">Workspace</td>
              <td style="padding: 10px 0; color: #1e293b; font-weight: 600; text-align: right; font-size: 14px;">${workspaceName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 14px; border-top: 1px solid #f1f5f9;">Ruolo</td>
              <td style="padding: 10px 0; text-align: right;">
                <span style="background: linear-gradient(135deg, #FF9500, #FF6B35); color: white; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px;">
                  ${roleLabels[role] || role}
                </span>
              </td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="https://spediresicuro.it/dashboard/workspace/team" style="display: inline-block; background: linear-gradient(135deg, #FF9500, #FF6B35); color: white; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px;">
            Vedi Team →
          </a>
        </div>

        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          Il nuovo membro può ora accedere al workspace con i permessi assegnati.
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `✅ ${acceptedByName} ha accettato l'invito su ${workspaceName}`,
    html,
  });
}

// ─── COMMERCIAL QUOTE TO PROSPECT ───

interface QuoteToProspectEmailParams {
  to: string;
  prospectName: string;
  resellerCompanyName: string;
  quoteValidityDays: number;
  pdfBuffer: Buffer;
}

export async function sendQuoteToProspectEmail(params: QuoteToProspectEmailParams) {
  const { to, prospectName, resellerCompanyName, quoteValidityDays, pdfBuffer } = params;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1e40af, #3b82f6); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Preventivo Spedizioni</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">Gentile <strong>${prospectName}</strong>,</p>
        <p style="color: #334155; font-size: 16px;">
          In allegato trova il preventivo spedizioni preparato da <strong>${resellerCompanyName}</strong>.
        </p>

        <div style="background: white; border-radius: 8px; padding: 16px; margin: 20px 0; border: 1px solid #e2e8f0; text-align: center;">
          <p style="color: #64748b; font-size: 14px; margin: 0 0 8px 0;">Validit&agrave; preventivo</p>
          <p style="color: #1e40af; font-size: 24px; font-weight: 700; margin: 0;">${quoteValidityDays} giorni</p>
        </div>

        <p style="color: #334155; font-size: 14px;">
          Il preventivo include le tariffe per le principali zone di destinazione e fasce di peso.
          Per qualsiasi domanda, non esiti a contattarci.
        </p>

        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="color: #0369a1; font-size: 13px; margin: 0;">
            Il file PDF &egrave; in allegato a questa email.
          </p>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        ${resellerCompanyName} &mdash; Powered by SpedireSicuro
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Preventivo spedizioni — ${resellerCompanyName}`,
    html,
    attachments: [
      {
        filename: 'preventivo.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}

// ─── QUOTE EXPIRY REMINDER (TO RESELLER) ───

interface QuoteExpiryReminderEmailParams {
  to: string;
  resellerName: string;
  prospectCompany: string;
  expiresAt: string; // ISO string
  dashboardUrl?: string;
}

export async function sendQuoteExpiryReminderEmail(params: QuoteExpiryReminderEmailParams) {
  const {
    to,
    resellerName,
    prospectCompany,
    expiresAt,
    dashboardUrl = 'https://spediresicuro.it/dashboard/reseller/preventivo',
  } = params;

  const expiryDate = new Date(expiresAt).toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">Preventivo in Scadenza</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; margin-top: 0;">Ciao <strong>${resellerName}</strong>,</p>
        <p style="color: #334155; font-size: 16px;">
          Il preventivo per <strong>${prospectCompany}</strong> &egrave; in scadenza.
        </p>

        <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
          <p style="color: #92400e; font-size: 14px; margin: 0 0 8px 0;">Scade il</p>
          <p style="color: #d97706; font-size: 22px; font-weight: 700; margin: 0;">${expiryDate}</p>
        </div>

        <p style="color: #334155; font-size: 14px;">
          Ti consigliamo di contattare il prospect per un follow-up, oppure di creare una nuova revisione
          con condizioni aggiornate prima della scadenza.
        </p>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #d97706, #f59e0b); color: white; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Vai al Preventivatore &rarr;
          </a>
        </div>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro &mdash; Spedizioni semplici e sicure
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject: `Preventivo in scadenza — ${prospectCompany}`,
    html,
  });
}
