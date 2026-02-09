/**
 * Domain Management Service
 *
 * Gestione dominio email custom per workspace reseller.
 * Integra Resend Domains API per registrazione, verifica DNS e rimozione.
 *
 * Sicurezza:
 * - Tutte le chiamate Resend sono server-side only
 * - Validazione dominio con regex + blocklist
 * - UNIQUE constraint su domain_name (no cross-workspace hijacking)
 * - UNIQUE constraint su workspace_id (max 1 dominio per workspace)
 *
 * @module lib/email/domain-management-service
 */

import { supabaseAdmin } from '@/lib/db/client';
import { getResend } from '@/lib/email/resend';

// ─── TYPES ───

export interface WorkspaceCustomDomain {
  id: string;
  workspace_id: string;
  domain_name: string;
  resend_domain_id: string | null;
  status: 'pending' | 'verified' | 'failed';
  dns_records: DnsRecord[] | null;
  region: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

export interface DomainRegistrationResult {
  success: boolean;
  domain?: WorkspaceCustomDomain;
  error?: string;
}

export interface DomainVerificationResult {
  success: boolean;
  status?: 'pending' | 'verified' | 'failed';
  dns_records?: DnsRecord[];
  error?: string;
}

// ─── VALIDAZIONE ───

const DOMAIN_REGEX =
  /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/** Domini bloccati: piattaforma + provider email gratuiti */
const BLOCKED_DOMAINS = [
  'spediresicuro.it',
  'gmail.com',
  'outlook.com',
  'yahoo.com',
  'hotmail.com',
  'live.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'gmx.com',
  'gmx.net',
  'fastmail.com',
  'tutanota.com',
  'tuta.io',
  'libero.it',
  'virgilio.it',
  'tin.it',
  'alice.it',
  'tiscali.it',
  'aruba.it',
];

/** Max lunghezza dominio RFC 1035 */
const MAX_DOMAIN_LENGTH = 253;

/** Regex email basica: local@domain, local non vuota e senza caratteri pericolosi */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Caratteri consentiti nel display name (no control chars, no < > per header injection) */
const DISPLAY_NAME_REGEX = /^[a-zA-Z0-9\u00C0-\u024F\s.,'&()\-]+$/;

/** Max lunghezza display name */
const MAX_DISPLAY_NAME_LENGTH = 100;

/** Max lunghezza email address */
const MAX_EMAIL_LENGTH = 254;

/**
 * Valida formato dominio.
 * Ritorna null se valido, stringa errore se invalido.
 */
export function validateDomainName(domain: string): string | null {
  if (!domain || typeof domain !== 'string') {
    return 'Dominio obbligatorio';
  }

  const normalized = domain.trim().toLowerCase();

  if (normalized.length > MAX_DOMAIN_LENGTH) {
    return 'Dominio troppo lungo (max 253 caratteri)';
  }

  if (!DOMAIN_REGEX.test(normalized)) {
    return 'Formato dominio non valido';
  }

  if (BLOCKED_DOMAINS.includes(normalized)) {
    return 'Questo dominio non è consentito';
  }

  return null;
}

/**
 * Valida formato indirizzo email.
 * Ritorna null se valido, stringa errore se invalido.
 */
export function validateEmailAddress(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return 'Indirizzo email obbligatorio';
  }

  const normalized = email.trim().toLowerCase();

  if (normalized.length > MAX_EMAIL_LENGTH) {
    return 'Indirizzo email troppo lungo (max 254 caratteri)';
  }

  if (!EMAIL_REGEX.test(normalized)) {
    return 'Formato indirizzo email non valido';
  }

  // Verifica local part non vuota
  const localPart = normalized.split('@')[0];
  if (!localPart || localPart.length === 0) {
    return "La parte locale dell'indirizzo email non può essere vuota";
  }

  return null;
}

/**
 * Valida display name per indirizzo email.
 * Previene header injection e caratteri di controllo.
 * Ritorna null se valido, stringa errore se invalido.
 */
export function validateDisplayName(displayName: string): string | null {
  if (!displayName || typeof displayName !== 'string') {
    return 'Nome visualizzato obbligatorio';
  }

  const trimmed = displayName.trim();

  if (trimmed.length === 0) {
    return 'Nome visualizzato obbligatorio';
  }

  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return 'Nome visualizzato troppo lungo (max 100 caratteri)';
  }

  if (!DISPLAY_NAME_REGEX.test(trimmed)) {
    return 'Nome visualizzato contiene caratteri non consentiti';
  }

  return null;
}

// ─── REGISTRAZIONE ───

/**
 * Registra un dominio custom per il workspace via Resend Domains API.
 * Crea record in workspace_custom_domains con DNS records da configurare.
 */
export async function registerCustomDomain(
  workspaceId: string,
  domainName: string
): Promise<DomainRegistrationResult> {
  // Validazione dominio
  const validationError = validateDomainName(domainName);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const normalized = domainName.trim().toLowerCase();

  // Verifica che il workspace non abbia gia un dominio (double-check oltre UNIQUE)
  const { data: existing } = await supabaseAdmin
    .from('workspace_custom_domains')
    .select('id')
    .eq('workspace_id', workspaceId)
    .single();

  if (existing) {
    return { success: false, error: 'Il workspace ha già un dominio configurato' };
  }

  // Registra su Resend
  try {
    const resend = getResend();
    const { data: resendDomain, error: resendError } = await resend.domains.create({
      name: normalized,
    });

    if (resendError || !resendDomain) {
      console.error('[DOMAIN-MGMT] Errore Resend domains.create:', resendError);
      return {
        success: false,
        error: resendError?.message || 'Errore registrazione dominio su Resend',
      };
    }

    // Salva in DB
    const { data: domain, error: dbError } = await supabaseAdmin
      .from('workspace_custom_domains')
      .insert({
        workspace_id: workspaceId,
        domain_name: normalized,
        resend_domain_id: resendDomain.id,
        status: 'pending',
        dns_records: resendDomain.records || null,
        region:
          ((resendDomain as unknown as Record<string, unknown>).region as string) || 'eu-west-1',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[DOMAIN-MGMT] Errore insert DB:', dbError.message);
      // Cleanup: rimuovi da Resend se il DB insert fallisce
      try {
        await resend.domains.remove(resendDomain.id);
      } catch {
        // Dominio orfano su Resend — log strutturato per monitoring/alerting
        console.error('[DOMAIN-MGMT] ORPHAN_DOMAIN: cleanup Resend fallito', {
          resend_domain_id: resendDomain.id,
          domain_name: normalized,
          workspace_id: workspaceId,
          action: 'manual_cleanup_required',
        });
      }

      if (dbError.message.includes('uq_domain_name')) {
        return { success: false, error: 'Questo dominio è già in uso da un altro workspace' };
      }
      return { success: false, error: 'Errore salvataggio dominio' };
    }

    return { success: true, domain: domain as WorkspaceCustomDomain };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('[DOMAIN-MGMT] Exception registerCustomDomain:', message);
    return { success: false, error: 'Errore comunicazione con servizio email' };
  }
}

// ─── LETTURA ───

/**
 * Ottieni il dominio custom del workspace (se presente).
 * Solo lettura DB, nessuna chiamata Resend.
 */
export async function getWorkspaceCustomDomain(
  workspaceId: string
): Promise<WorkspaceCustomDomain | null> {
  const { data, error } = await supabaseAdmin
    .from('workspace_custom_domains')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) return null;
  return data as WorkspaceCustomDomain;
}

// ─── VERIFICA DNS ───

/**
 * Triggera verifica DNS su Resend e aggiorna status nel DB.
 * Chiama resend.domains.verify() poi resend.domains.get() per lo status aggiornato.
 */
export async function verifyCustomDomain(workspaceId: string): Promise<DomainVerificationResult> {
  const domain = await getWorkspaceCustomDomain(workspaceId);
  if (!domain) {
    return { success: false, error: 'Nessun dominio configurato per questo workspace' };
  }

  if (!domain.resend_domain_id) {
    return { success: false, error: 'Dominio non registrato su Resend' };
  }

  try {
    const resend = getResend();

    // Trigger verifica
    await resend.domains.verify(domain.resend_domain_id);

    // Leggi status aggiornato
    const { data: updatedDomain, error: getError } = await resend.domains.get(
      domain.resend_domain_id
    );

    if (getError || !updatedDomain) {
      return { success: false, error: 'Errore lettura stato dominio da Resend' };
    }

    // Mappa status Resend → nostro status
    const resendStatus = (updatedDomain as unknown as Record<string, unknown>).status as string;
    let newStatus: 'pending' | 'verified' | 'failed' = 'pending';
    if (resendStatus === 'verified' || resendStatus === 'active') {
      newStatus = 'verified';
    } else if (resendStatus === 'failed') {
      newStatus = 'failed';
    }

    // Aggiorna DB
    const updateData: Record<string, unknown> = {
      status: newStatus,
      dns_records: updatedDomain.records || domain.dns_records,
    };

    if (newStatus === 'verified' && !domain.verified_at) {
      updateData.verified_at = new Date().toISOString();
    }

    await supabaseAdmin.from('workspace_custom_domains').update(updateData).eq('id', domain.id);

    return {
      success: true,
      status: newStatus,
      dns_records: (updatedDomain.records || []) as DnsRecord[],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('[DOMAIN-MGMT] Exception verifyCustomDomain:', message);
    return { success: false, error: 'Errore verifica dominio' };
  }
}

// ─── RIMOZIONE ───

/**
 * Rimuove il dominio custom dal workspace.
 * - Rimuove da Resend
 * - Invalida indirizzi email associati (resend_domain_id)
 * - Cancella record DB
 */
export async function removeCustomDomain(
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  const domain = await getWorkspaceCustomDomain(workspaceId);
  if (!domain) {
    return { success: false, error: 'Nessun dominio configurato per questo workspace' };
  }

  try {
    // 1. Rimuovi da Resend (se ha ID)
    if (domain.resend_domain_id) {
      const resend = getResend();
      try {
        await resend.domains.remove(domain.resend_domain_id);
      } catch (err: unknown) {
        // Non bloccare se Resend fallisce (dominio potrebbe essere gia rimosso)
        console.error('[DOMAIN-MGMT] Warning: errore rimozione da Resend:', err);
      }
    }

    // 2. Invalida indirizzi email sul dominio (rimuovi associazione)
    await supabaseAdmin
      .from('workspace_email_addresses')
      .update({ resend_domain_id: null, domain_verified_at: null, is_verified: false })
      .eq('workspace_id', workspaceId)
      .not('resend_domain_id', 'is', null);

    // 3. Cancella record dominio dal DB
    const { error: deleteError } = await supabaseAdmin
      .from('workspace_custom_domains')
      .delete()
      .eq('id', domain.id);

    if (deleteError) {
      console.error('[DOMAIN-MGMT] Errore delete DB:', deleteError.message);
      return { success: false, error: 'Errore rimozione dominio dal database' };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('[DOMAIN-MGMT] Exception removeCustomDomain:', message);
    return { success: false, error: 'Errore rimozione dominio' };
  }
}

// ─── GESTIONE INDIRIZZI EMAIL ───

/**
 * Aggiunge un indirizzo email sul dominio custom verificato.
 * L'email deve corrispondere al dominio registrato (es. info@logisticamilano.it).
 */
export async function addEmailAddressOnDomain(
  workspaceId: string,
  emailAddress: string,
  displayName: string,
  isPrimary = false
): Promise<{ success: boolean; addressId?: string; error?: string }> {
  // Validazione email
  const emailError = validateEmailAddress(emailAddress);
  if (emailError) {
    return { success: false, error: emailError };
  }

  // Validazione display name (previene header injection)
  const displayNameError = validateDisplayName(displayName);
  if (displayNameError) {
    return { success: false, error: displayNameError };
  }

  // Verifica dominio custom
  const domain = await getWorkspaceCustomDomain(workspaceId);
  if (!domain) {
    return { success: false, error: 'Nessun dominio configurato per questo workspace' };
  }

  if (domain.status !== 'verified') {
    return { success: false, error: 'Il dominio non è ancora verificato' };
  }

  // Verifica che email corrisponda al dominio
  const emailDomain = emailAddress.split('@')[1]?.toLowerCase();
  if (emailDomain !== domain.domain_name) {
    return {
      success: false,
      error: `L'indirizzo email deve essere sul dominio ${domain.domain_name}`,
    };
  }

  // Se isPrimary, resetta gli altri indirizzi
  if (isPrimary) {
    await supabaseAdmin
      .from('workspace_email_addresses')
      .update({ is_primary: false })
      .eq('workspace_id', workspaceId)
      .eq('is_primary', true);
  }

  // Crea indirizzo
  const { data, error } = await supabaseAdmin
    .from('workspace_email_addresses')
    .insert({
      workspace_id: workspaceId,
      email_address: emailAddress.toLowerCase(),
      display_name: displayName,
      is_primary: isPrimary,
      is_verified: true, // Verificato tramite dominio
      resend_domain_id: domain.resend_domain_id,
      domain_verified_at: domain.verified_at,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[DOMAIN-MGMT] Errore insert email address:', error.message);
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return { success: false, error: 'Questo indirizzo email esiste già' };
    }
    return { success: false, error: 'Errore creazione indirizzo email' };
  }

  return { success: true, addressId: data.id };
}

/**
 * Rimuove un indirizzo email dal workspace.
 * Blocca se è l'ultimo indirizzo primary.
 */
export async function removeEmailAddress(
  workspaceId: string,
  addressId: string
): Promise<{ success: boolean; error?: string }> {
  // Verifica che l'indirizzo appartenga al workspace
  const { data: address, error: fetchError } = await supabaseAdmin
    .from('workspace_email_addresses')
    .select('id, is_primary, workspace_id')
    .eq('id', addressId)
    .eq('workspace_id', workspaceId)
    .single();

  if (fetchError || !address) {
    return { success: false, error: 'Indirizzo non trovato in questo workspace' };
  }

  // Se è primary, verifica che ci siano altri indirizzi primary
  if (address.is_primary) {
    const { count } = await supabaseAdmin
      .from('workspace_email_addresses')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('is_primary', true);

    if ((count || 0) <= 1) {
      return {
        success: false,
        error: "Impossibile rimuovere l'ultimo indirizzo primario",
      };
    }
  }

  const { error: deleteError } = await supabaseAdmin
    .from('workspace_email_addresses')
    .delete()
    .eq('id', addressId);

  if (deleteError) {
    console.error('[DOMAIN-MGMT] Errore delete email address:', deleteError.message);
    return { success: false, error: 'Errore rimozione indirizzo email' };
  }

  return { success: true };
}
