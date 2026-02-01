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
