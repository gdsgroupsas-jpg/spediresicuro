/**
 * WhatsApp Business API Service
 *
 * Servizio per invio/ricezione messaggi tramite WhatsApp Cloud API (Meta).
 * Supporta: testo, template, messaggi interattivi (buttons, lists).
 *
 * Environment Variables:
 * - WHATSAPP_TOKEN: Access token (Graph API)
 * - WHATSAPP_PHONE_NUMBER_ID: Phone number ID from Meta dashboard
 * - WHATSAPP_VERIFY_TOKEN: Token per webhook verification
 * - WHATSAPP_BUSINESS_ACCOUNT_ID: Business account ID (opzionale, per template)
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// ==================== TYPES ====================

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  verifyToken: string;
  businessAccountId?: string;
}

/** Incoming webhook message from Meta */
export interface WhatsAppWebhookBody {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<WhatsAppIncomingMessage>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string }>;
        }>;
      };
      field: 'messages';
    }>;
  }>;
}

export interface WhatsAppIncomingMessage {
  from: string; // Phone number (e.g. "393401234567")
  id: string;
  timestamp: string;
  type: 'text' | 'interactive' | 'button' | 'image' | 'document' | 'location' | 'reaction';
  text?: { body: string };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { text: string; payload: string };
  context?: { from: string; id: string }; // Reply context
}

/** Outgoing message payload */
export interface WhatsAppTextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

export interface WhatsAppInteractiveMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'interactive';
  interactive: {
    type: 'button' | 'list';
    header?: { type: 'text'; text: string };
    body: { text: string };
    footer?: { text: string };
    action: WhatsAppInteractiveAction;
  };
}

type WhatsAppInteractiveAction =
  | {
      buttons: Array<{
        type: 'reply';
        reply: { id: string; title: string }; // max 20 chars
      }>;
    }
  | {
      button: string; // CTA text, max 20 chars
      sections: Array<{
        title: string;
        rows: Array<{
          id: string;
          title: string; // max 24 chars
          description?: string; // max 72 chars
        }>;
      }>;
    };

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ==================== CONFIG ====================

function getConfig(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!token || !phoneNumberId || !verifyToken) {
    return null;
  }

  return {
    token,
    phoneNumberId,
    verifyToken,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  };
}

export function isWhatsAppConfigured(): boolean {
  return getConfig() !== null;
}

export function getWhatsAppVerifyToken(): string | null {
  return process.env.WHATSAPP_VERIFY_TOKEN || null;
}

// ==================== SEND FUNCTIONS ====================

/**
 * Send a text message via WhatsApp Cloud API
 */
export async function sendWhatsAppText(to: string, text: string): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) {
    console.warn('[WHATSAPP] Not configured - skipping message');
    return { success: false, error: 'WhatsApp not configured' };
  }

  // WhatsApp text body max 4096 chars
  const truncatedText = text.length > 4096 ? text.slice(0, 4090) + '...' : text;

  const payload: WhatsAppTextMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: truncatedText, preview_url: false },
  };

  return sendMessage(config, payload);
}

/**
 * Send an interactive button message (max 3 buttons)
 */
export async function sendWhatsAppButtons(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  header?: string,
  footer?: string
): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  if (buttons.length === 0 || buttons.length > 3) {
    return { success: false, error: 'WhatsApp buttons: 1-3 required' };
  }

  const payload: WhatsAppInteractiveMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      ...(header ? { header: { type: 'text', text: header.slice(0, 60) } } : {}),
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply' as const,
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  };

  return sendMessage(config, payload);
}

/**
 * Send an interactive list message (max 10 rows per section)
 */
export async function sendWhatsAppList(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  header?: string,
  footer?: string
): Promise<WhatsAppSendResult> {
  const config = getConfig();
  if (!config) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  const payload: WhatsAppInteractiveMessage = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      ...(header ? { header: { type: 'text', text: header.slice(0, 60) } } : {}),
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        button: buttonText.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.slice(0, 10).map((r) => ({
            id: r.id,
            title: r.title.slice(0, 24),
            ...(r.description ? { description: r.description.slice(0, 72) } : {}),
          })),
        })),
      },
    },
  };

  return sendMessage(config, payload);
}

/**
 * Mark a message as read (blue ticks)
 */
export async function markAsRead(messageId: string): Promise<void> {
  const config = getConfig();
  if (!config) return;

  const url = `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  } catch {
    // Best effort, don't throw
  }
}

// ==================== INTERNAL ====================

async function sendMessage(
  config: WhatsAppConfig,
  payload: WhatsAppTextMessage | WhatsAppInteractiveMessage
): Promise<WhatsAppSendResult> {
  const url = `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.error?.message || `HTTP ${response.status}`;
      console.error('[WHATSAPP] Send error:', errorMsg);
      return { success: false, error: errorMsg };
    }

    const messageId = data?.messages?.[0]?.id;
    return { success: true, messageId };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[WHATSAPP] Send failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ==================== WEBHOOK HELPERS ====================

/**
 * Extract text content from an incoming WhatsApp message.
 * Handles text, interactive replies, and button payloads.
 */
export function extractMessageText(msg: WhatsAppIncomingMessage): string {
  switch (msg.type) {
    case 'text':
      return msg.text?.body || '';
    case 'interactive':
      return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
    case 'button':
      return msg.button?.text || msg.button?.payload || '';
    default:
      return '';
  }
}

/**
 * Parse incoming webhook body and extract messages with sender info.
 */
export function parseWebhookMessages(body: WhatsAppWebhookBody): Array<{
  from: string;
  name: string;
  messageId: string;
  text: string;
  raw: WhatsAppIncomingMessage;
}> {
  const results: Array<{
    from: string;
    name: string;
    messageId: string;
    text: string;
    raw: WhatsAppIncomingMessage;
  }> = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value?.messages) continue;

      const contactMap = new Map<string, string>();
      for (const c of value.contacts || []) {
        contactMap.set(c.wa_id, c.profile.name);
      }

      for (const msg of value.messages) {
        const text = extractMessageText(msg);
        if (!text) continue; // Skip non-text (images, etc.)

        results.push({
          from: msg.from,
          name: contactMap.get(msg.from) || msg.from,
          messageId: msg.id,
          text,
          raw: msg,
        });
      }
    }
  }

  return results;
}
