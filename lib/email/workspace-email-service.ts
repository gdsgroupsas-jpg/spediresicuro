/**
 * Workspace Email Service
 *
 * Servizio per invio/ricezione email scoped per workspace.
 * Ogni workspace ha i propri indirizzi email e vede SOLO le proprie email.
 *
 * Sicurezza:
 * - Validazione ownership indirizzo mittente (server-side, MAI fidarsi del client)
 * - Rate limiting per workspace (daily_limit da outreach_channel_config)
 * - Sanitizzazione HTML body tramite sanitize-html (parser, no regex)
 * - Isolamento cross-workspace garantito da RLS + validazione server-side
 * - Fail-closed: se rate limit non verificabile, blocca invio
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { sendEmail } from '@/lib/email/resend';
import { rateLimit } from '@/lib/security/rate-limit';
import sanitizeHtml from 'sanitize-html';

// ─── TYPES ───

export interface WorkspaceEmailAddress {
  id: string;
  workspace_id: string;
  email_address: string;
  display_name: string;
  is_primary: boolean;
  is_verified: boolean;
  resend_domain_id: string | null;
  domain_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendWorkspaceEmailParams {
  workspaceId: string;
  fromAddressId: string; // ID da workspace_email_addresses
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  replyToEmailId?: string;
  isDraft?: boolean;
}

export interface WorkspaceEmailResult {
  success: boolean;
  emailId?: string;
  resendId?: string;
  error?: string;
}

// ─── SANITIZZAZIONE HTML ───

/**
 * Sanitizza HTML body email rimuovendo tag e attributi pericolosi.
 *
 * Usa sanitize-html — sanitizer server-side basato su htmlparser2 (parser reale,
 * non regex). Immune a mutation XSS, recomposition attacks, e encoding bypass.
 * Nessuna dipendenza DOM (no jsdom), leggero per server-side.
 *
 * Configurazione: allowlist di tag e attributi sicuri per contesto email.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';

  return sanitizeHtml(html, {
    // Tag sicuri per email HTML
    allowedTags: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'hr',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'del',
      'a',
      'img',
      'ul',
      'ol',
      'li',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'blockquote',
      'pre',
      'code',
      'sup',
      'sub',
      'small',
    ],
    // Attributi sicuri per email (per tag)
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'title', 'class', 'id', 'style'],
      img: ['src', 'alt', 'title', 'width', 'height', 'class', 'id', 'style'],
      table: ['border', 'cellpadding', 'cellspacing', 'align', 'width', 'class', 'id', 'style'],
      td: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height', 'class', 'id', 'style'],
      th: ['colspan', 'rowspan', 'align', 'valign', 'width', 'height', 'class', 'id', 'style'],
      tr: ['align', 'valign', 'class', 'id', 'style'],
      div: ['class', 'id', 'style', 'align'],
      span: ['class', 'id', 'style'],
      p: ['class', 'id', 'style', 'align'],
      h1: ['class', 'id', 'style'],
      h2: ['class', 'id', 'style'],
      h3: ['class', 'id', 'style'],
      h4: ['class', 'id', 'style'],
      h5: ['class', 'id', 'style'],
      h6: ['class', 'id', 'style'],
      blockquote: ['class', 'id', 'style'],
      hr: ['class', 'id', 'style'],
    },
    // Protocolli sicuri (blocca javascript:, vbscript:, data:, ecc.)
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https'],
      a: ['http', 'https', 'mailto'],
    },
    // Rimuovi tag non permessi (non mostrare come testo)
    disallowedTagsMode: 'discard',
    // Nessun attributo data-* permesso
    allowedClasses: {},
  });
}

// ─── VALIDAZIONE ───

/**
 * Verifica che un indirizzo email appartenga al workspace.
 * SEMPRE chiamare server-side prima di inviare.
 */
export async function validateSenderAddress(
  workspaceId: string,
  fromAddressId: string
): Promise<{ valid: boolean; address?: WorkspaceEmailAddress; error?: string }> {
  const { data, error } = await supabaseAdmin
    .from('workspace_email_addresses')
    .select('*')
    .eq('id', fromAddressId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Indirizzo mittente non trovato o non appartiene al workspace' };
  }

  if (!data.is_verified) {
    return { valid: false, error: 'Indirizzo mittente non verificato' };
  }

  return { valid: true, address: data as WorkspaceEmailAddress };
}

// ─── RATE LIMITING ───

/**
 * Controlla rate limit per invio email workspace.
 *
 * Due livelli:
 * 1. Rate limit distribuito (Upstash Redis) — anti-burst, funziona su serverless
 * 2. Daily limit da DB (outreach_channel_config) — business rule esatta
 */
async function checkRateLimit(
  workspaceId: string
): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
  // Livello 1: Rate limit distribuito anti-burst (10 email/minuto per workspace)
  const rl = await rateLimit('workspace-email-send', `ws:${workspaceId}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return {
      allowed: false,
      remaining: 0,
      error: 'Troppe email inviate, riprova tra poco',
    };
  }

  // Livello 2: Daily limit da configurazione workspace
  const { data: config } = await supabaseAdmin
    .from('outreach_channel_config')
    .select('daily_limit')
    .eq('workspace_id', workspaceId)
    .eq('channel', 'email')
    .single();

  const dailyLimit = config?.daily_limit || 100;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabaseAdmin
    .from('emails')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('direction', 'outbound')
    .neq('status', 'draft')
    .gte('created_at', today.toISOString());

  if (error) {
    console.error('❌ [WORKSPACE-EMAIL] Errore conteggio rate limit:', error.message);
    // Fail-closed: se non possiamo verificare il limite, blocchiamo
    return {
      allowed: false,
      remaining: 0,
      error: 'Rate limit non verificabile, invio temporaneamente bloccato',
    };
  }

  const sent = count || 0;
  const remaining = dailyLimit - sent;

  if (remaining <= 0) {
    return {
      allowed: false,
      remaining: 0,
      error: `Limite giornaliero raggiunto (${dailyLimit} email/giorno)`,
    };
  }

  return { allowed: true, remaining };
}

// ─── INVIO EMAIL ───

/**
 * Invia email dal workspace.
 * Flusso:
 * 1. Valida ownership indirizzo mittente
 * 2. Controlla rate limit
 * 3. Sanitizza HTML
 * 4. Inserisce record nel DB (via RPC atomica)
 * 5. Invia via Resend con FROM del workspace (solo se non bozza)
 * 6. Aggiorna record con message_id Resend
 */
export async function sendWorkspaceEmail(
  params: SendWorkspaceEmailParams
): Promise<WorkspaceEmailResult> {
  const {
    workspaceId,
    fromAddressId,
    to,
    cc = [],
    subject,
    bodyHtml,
    bodyText,
    replyToEmailId,
    isDraft = false,
  } = params;

  // 1. Valida indirizzo mittente
  const validation = await validateSenderAddress(workspaceId, fromAddressId);
  if (!validation.valid || !validation.address) {
    return { success: false, error: validation.error };
  }

  const senderAddress = validation.address;

  // 2. Rate limit (solo per invii reali, non bozze)
  if (!isDraft) {
    const rateCheck = await checkRateLimit(workspaceId);
    if (!rateCheck.allowed) {
      return { success: false, error: rateCheck.error };
    }
  }

  // 3. Sanitizza HTML body
  const safeHtml = sanitizeEmailHtml(bodyHtml);

  // 4. Inserisci record nel DB via RPC atomica
  const { data: emailId, error: rpcError } = await supabaseAdmin.rpc('send_workspace_email', {
    p_workspace_id: workspaceId,
    p_from_address_id: fromAddressId,
    p_to_addresses: to,
    p_cc: cc,
    p_subject: subject,
    p_body_html: safeHtml,
    p_body_text: bodyText || null,
    p_reply_to_email_id: replyToEmailId || null,
    p_is_draft: isDraft,
  });

  if (rpcError) {
    console.error('❌ [WORKSPACE-EMAIL] Errore RPC send_workspace_email:', rpcError.message);

    // FIX #10: Restituisci messaggi specifici per errori noti, generico per il resto
    if (rpcError.message.includes('SENDER_NOT_OWNED')) {
      return { success: false, error: 'Indirizzo mittente non appartiene al workspace' };
    }
    if (rpcError.message.includes('REPLY_NOT_OWNED')) {
      return { success: false, error: 'Email di risposta non appartiene al workspace' };
    }
    if (rpcError.message.includes('UNAUTHORIZED')) {
      return { success: false, error: 'Non autorizzato per questo workspace' };
    }

    return { success: false, error: "Errore interno durante l'invio email" };
  }

  // 5. Se è una bozza, non inviamo via Resend
  if (isDraft) {
    return { success: true, emailId };
  }

  // 6. FIX #9: Invia via Resend con FROM del workspace (non il default noreply)
  const fromFormatted = `${senderAddress.display_name} <${senderAddress.email_address}>`;

  const resendResult = await sendEmail({
    to,
    subject,
    html: safeHtml,
    from: fromFormatted,
    replyTo: senderAddress.email_address,
  });

  const wq = workspaceQuery(workspaceId);

  if (!resendResult.success) {
    // Aggiorna status a 'failed' nel DB
    await wq.from('emails').update({ status: 'failed' }).eq('id', emailId);

    console.error('❌ [WORKSPACE-EMAIL] Errore Resend:', resendResult.error);
    return { success: false, emailId, error: resendResult.error };
  }

  // 7. Aggiorna message_id Resend nel record
  if (resendResult.id) {
    await wq.from('emails').update({ message_id: resendResult.id }).eq('id', emailId);
  }

  console.log(
    `✅ [WORKSPACE-EMAIL] Email inviata: workspace=${workspaceId}, to=${to.join(',')}, subject="${subject}"`
  );

  return { success: true, emailId, resendId: resendResult.id };
}

// ─── QUERY HELPERS ───

/**
 * Ottieni indirizzi email del workspace.
 * NOTA: Usa supabaseAdmin (bypassa RLS). Il chiamante DEVE verificare
 * l'autorizzazione dell'utente prima di invocare questa funzione.
 */
export async function getWorkspaceEmailAddresses(
  workspaceId: string
): Promise<WorkspaceEmailAddress[]> {
  const { data, error } = await supabaseAdmin
    .from('workspace_email_addresses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('is_primary', { ascending: false });

  if (error) {
    console.error('❌ [WORKSPACE-EMAIL] Errore fetch indirizzi:', error.message);
    return [];
  }

  return (data || []) as WorkspaceEmailAddress[];
}

/**
 * Lookup workspace_id da indirizzo email destinatario (per routing inbound).
 * Usa la funzione PostgreSQL lookup_workspace_by_email().
 * NOTA: Solo per uso server-side (webhook). Non esporre al client.
 */
export async function lookupWorkspaceByEmail(emailAddress: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('lookup_workspace_by_email', {
    p_email_address: emailAddress,
  });

  if (error) {
    console.error('❌ [WORKSPACE-EMAIL] Errore lookup workspace:', error.message);
    return null;
  }

  return data || null;
}
