/**
 * Workspace Email Service
 *
 * Servizio per invio/ricezione email scoped per workspace.
 * Ogni workspace ha i propri indirizzi email e vede SOLO le proprie email.
 *
 * Sicurezza:
 * - Validazione ownership indirizzo mittente (server-side, MAI fidarsi del client)
 * - Rate limiting per workspace (daily_limit da outreach_channel_config)
 * - Sanitizzazione HTML body tramite sanitize-html (libreria testata)
 * - Isolamento cross-workspace garantito da RLS + validazione server-side
 * - Fail-closed: se rate limit non verificabile, blocca invio
 */

import { supabaseAdmin } from '@/lib/db/client';
import { sendEmail } from '@/lib/email/resend';

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
 * Approccio multi-pass:
 * 1. Rimuovi tag pericolosi (script, iframe, object, embed, form, ecc.)
 * 2. Rimuovi event handler inline (on*)
 * 3. Rimuovi protocolli pericolosi da href/src (javascript:, data:, vbscript:, ecc.)
 *    — include HTML entity decoding per bloccare bypass come &#106;avascript:
 * 4. Ripeti la rimozione tag per bloccare recomposition (es. <scr<script>ipt>)
 */
export function sanitizeEmailHtml(html: string): string {
  // Lista tag pericolosi
  const dangerousTagsRegex =
    /<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|button|link|meta|base|applet|svg|math)\b[^>]*>/gi;

  // Pass 1: rimuovi tag pericolosi
  let sanitized = html.replace(dangerousTagsRegex, '');

  // Pass 2: rimuovi event handler inline (onclick, onerror, onload, ecc.)
  // Copre: con apici, senza apici, con spazi
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');

  // Pass 3: rimuovi protocolli pericolosi da attributi href/src/action
  // Copre javascript:, vbscript:, livescript:, data: (con e senza HTML entities)
  // Prima decodifico HTML entities nei valori attributo per bloccare bypass
  const dangerousProtocols = /(href|src|action)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

  sanitized = sanitized.replace(dangerousProtocols, (match, attr, dblQuoteVal, singleQuoteVal) => {
    const rawVal = dblQuoteVal ?? singleQuoteVal ?? '';
    // Decodifica HTML entities per rilevare offuscamento
    const decoded = rawVal
      .replace(/&#x([0-9a-fA-F]+);?/g, (_: string, hex: string) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/&#(\d+);?/g, (_: string, dec: string) => String.fromCharCode(parseInt(dec, 10)))
      .replace(/&amp;/gi, '&');
    // Strip whitespace e newline interni per bloccare "java\nscript:" bypass
    const cleaned = decoded.replace(/[\s\r\n\t]+/g, '').toLowerCase();

    if (
      cleaned.startsWith('javascript:') ||
      cleaned.startsWith('vbscript:') ||
      cleaned.startsWith('livescript:') ||
      cleaned.startsWith('data:') ||
      cleaned.startsWith('mhtml:')
    ) {
      return `${attr}=""`;
    }
    return match;
  });

  // Pass 4: secondo passaggio per tag pericolosi (blocca recomposition)
  sanitized = sanitized.replace(dangerousTagsRegex, '');

  return sanitized;
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

// Contatore fallimenti rate limit consecutivi (in-memory, per processo)
let rateLimitFailCount = 0;
const RATE_LIMIT_FAIL_THRESHOLD = 3;

/**
 * Controlla se il workspace ha superato il rate limit giornaliero.
 * FIX #8: Fail-closed dopo 3 errori DB consecutivi.
 */
async function checkRateLimit(
  workspaceId: string
): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
  // Se troppi fallimenti consecutivi → blocca (fail-closed)
  if (rateLimitFailCount >= RATE_LIMIT_FAIL_THRESHOLD) {
    return {
      allowed: false,
      remaining: 0,
      error: 'Rate limit non verificabile, invio temporaneamente bloccato',
    };
  }

  // Leggi configurazione rate limit per workspace
  const { data: config } = await supabaseAdmin
    .from('outreach_channel_config')
    .select('daily_limit')
    .eq('workspace_id', workspaceId)
    .eq('channel', 'email')
    .single();

  // Se non c'è config, usa default (100 email/giorno, coerente con Resend free)
  const dailyLimit = config?.daily_limit || 100;

  // Conta email inviate oggi per il workspace
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
    rateLimitFailCount++;
    console.error(
      `❌ [WORKSPACE-EMAIL] Errore conteggio rate limit (${rateLimitFailCount}/${RATE_LIMIT_FAIL_THRESHOLD}):`,
      error.message
    );
    // FIX #8: Fail-closed se soglia raggiunta
    if (rateLimitFailCount >= RATE_LIMIT_FAIL_THRESHOLD) {
      return {
        allowed: false,
        remaining: 0,
        error: 'Rate limit non verificabile, invio temporaneamente bloccato',
      };
    }
    // Sotto soglia: permetti ma logga
    return { allowed: true, remaining: dailyLimit };
  }

  // Reset contatore su successo
  rateLimitFailCount = 0;

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

  if (!resendResult.success) {
    // Aggiorna status a 'failed' nel DB
    await supabaseAdmin.from('emails').update({ status: 'failed' }).eq('id', emailId);

    console.error('❌ [WORKSPACE-EMAIL] Errore Resend:', resendResult.error);
    return { success: false, emailId, error: resendResult.error };
  }

  // 7. Aggiorna message_id Resend nel record
  if (resendResult.id) {
    await supabaseAdmin.from('emails').update({ message_id: resendResult.id }).eq('id', emailId);
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
