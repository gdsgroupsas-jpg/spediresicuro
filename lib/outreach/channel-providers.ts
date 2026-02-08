/**
 * Channel Abstraction Layer — Sprint S3
 *
 * Interfaccia comune che wrappa i 3 provider esistenti:
 * - Email: lib/email/resend.ts (sendEmail)
 * - WhatsApp: lib/services/whatsapp.ts (sendWhatsAppText)
 * - Telegram: lib/services/telegram-queue.ts (enqueueMessage)
 *
 * Pattern: factory + validazione recipient + isConfigured check.
 */

import type { OutreachChannel, SendResult } from '@/types/outreach';
import { CHANNEL_CAPABILITIES } from '@/types/outreach';

// ============================================
// INTERFACCIA PROVIDER
// ============================================

export interface ChannelProvider {
  /** Invia messaggio al destinatario */
  send(to: string, subject: string | null, body: string): Promise<SendResult>;
  /** Verifica se il provider e' configurato (env vars presenti) */
  isConfigured(): boolean;
  /** Valida formato destinatario (email, phone E.164, chat_id numerico) */
  validateRecipient(contact: string): boolean;
  /** Nome canale */
  readonly channel: OutreachChannel;
}

// ============================================
// VALIDATORI
// ============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_E164_REGEX = /^\+?[1-9]\d{6,14}$/;
const TELEGRAM_CHAT_ID_REGEX = /^-?\d+$/;

// ============================================
// RESEND PROVIDER (Email)
// ============================================

class ResendProvider implements ChannelProvider {
  readonly channel: OutreachChannel = 'email';

  isConfigured(): boolean {
    return !!process.env.RESEND_API_KEY;
  }

  validateRecipient(contact: string): boolean {
    return EMAIL_REGEX.test(contact);
  }

  async send(to: string, subject: string | null, body: string): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { success: false, channel: 'email', error: 'RESEND_API_KEY non configurata' };
    }

    if (!this.validateRecipient(to)) {
      return { success: false, channel: 'email', error: `Email non valida: ${to}` };
    }

    try {
      // Dynamic import per evitare side-effect al modulo load
      const { sendEmail } = await import('@/lib/email/resend');
      const result = await sendEmail({
        to,
        subject: subject || 'SpedireSicuro',
        html: body,
      });
      return {
        success: result.success,
        messageId: result.success ? (result as any).id : undefined,
        channel: 'email',
        error: result.success ? undefined : (result as any).error,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'email',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================
// WHATSAPP PROVIDER (Meta Cloud API)
// ============================================

class WhatsAppProvider implements ChannelProvider {
  readonly channel: OutreachChannel = 'whatsapp';

  isConfigured(): boolean {
    return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  validateRecipient(contact: string): boolean {
    return PHONE_E164_REGEX.test(contact.replace(/[\s\-()]/g, ''));
  }

  async send(to: string, subject: string | null, body: string): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { success: false, channel: 'whatsapp', error: 'WhatsApp non configurato' };
    }

    if (!this.validateRecipient(to)) {
      return { success: false, channel: 'whatsapp', error: `Numero non valido: ${to}` };
    }

    try {
      const { sendWhatsAppText } = await import('@/lib/services/whatsapp');
      // Tronca al max supportato dal canale
      const maxLen = CHANNEL_CAPABILITIES.whatsapp.maxBodyLength;
      const truncated = body.length > maxLen ? body.slice(0, maxLen - 3) + '...' : body;
      const result = await sendWhatsAppText(to, truncated);
      return {
        success: result.success,
        messageId: result.messageId,
        channel: 'whatsapp',
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'whatsapp',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================
// TELEGRAM PROVIDER (Bot API via queue esistente)
// ============================================

class TelegramProvider implements ChannelProvider {
  readonly channel: OutreachChannel = 'telegram';

  isConfigured(): boolean {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }

  validateRecipient(contact: string): boolean {
    return TELEGRAM_CHAT_ID_REGEX.test(contact);
  }

  async send(to: string, _subject: string | null, body: string): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { success: false, channel: 'telegram', error: 'Telegram bot token non configurato' };
    }

    if (!this.validateRecipient(to)) {
      return { success: false, channel: 'telegram', error: `Chat ID non valido: ${to}` };
    }

    try {
      const { enqueueMessage } = await import('@/lib/services/telegram-queue');
      // Tronca al max supportato
      const maxLen = CHANNEL_CAPABILITIES.telegram.maxBodyLength;
      const truncated = body.length > maxLen ? body.slice(0, maxLen - 3) + '...' : body;
      const messageId = await enqueueMessage(to, truncated, { parseMode: 'HTML' });
      return {
        success: messageId !== null,
        messageId: messageId ?? undefined,
        channel: 'telegram',
        error: messageId === null ? 'Errore enqueue Telegram' : undefined,
      };
    } catch (error) {
      return {
        success: false,
        channel: 'telegram',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================
// FACTORY
// ============================================

const providers: Record<OutreachChannel, ChannelProvider> = {
  email: new ResendProvider(),
  whatsapp: new WhatsAppProvider(),
  telegram: new TelegramProvider(),
};

/** Ritorna il provider per il canale specificato */
export function getProvider(channel: OutreachChannel): ChannelProvider {
  return providers[channel];
}

/** Ritorna tutti i canali configurati (env vars presenti) */
export function getConfiguredChannels(): OutreachChannel[] {
  return (Object.keys(providers) as OutreachChannel[]).filter((ch) => providers[ch].isConfigured());
}
