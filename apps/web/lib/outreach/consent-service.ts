/**
 * Consent Service — Sprint S3d
 *
 * Gestisce il consenso GDPR per l'invio di messaggi outreach.
 * Pattern: check pre-invio, grant/revoke esplicito, audit trail.
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { OutreachChannel, GdprLegalBasis, ConsentSource } from '@/types/outreach';

// ============================================
// CHECK CONSENSO
// ============================================

/**
 * Verifica se un'entita' ha dato consenso per un canale specifico.
 * Usato dal sequence-executor come gate pre-invio.
 */
export async function checkConsent(
  entityType: 'lead' | 'prospect',
  entityId: string,
  channel: OutreachChannel
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('outreach_consent')
    .select('consented')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('channel', channel)
    .eq('consented', true)
    .maybeSingle();

  return data !== null;
}

// ============================================
// GRANT / REVOKE
// ============================================

/**
 * Concede consenso per un canale a un'entita'.
 */
export async function grantConsent(params: {
  entityType: 'lead' | 'prospect';
  entityId: string;
  channel: OutreachChannel;
  source: ConsentSource;
  legalBasis: GdprLegalBasis;
  collectedBy?: string;
  provenanceDetail?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { entityType, entityId, channel, source, legalBasis, collectedBy, provenanceDetail } =
    params;

  const { error } = await supabaseAdmin.from('outreach_consent').upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      channel,
      consented: true,
      consented_at: new Date().toISOString(),
      revoked_at: null,
      source,
      legal_basis: legalBasis,
      ...(collectedBy ? { collected_by: collectedBy } : {}),
      ...(provenanceDetail ? { provenance_detail: provenanceDetail } : {}),
    },
    { onConflict: 'entity_type,entity_id,channel' }
  );

  if (error) {
    console.error('[consent-service] grantConsent error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Revoca consenso per un canale.
 */
export async function revokeConsent(
  entityType: 'lead' | 'prospect',
  entityId: string,
  channel: OutreachChannel
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('outreach_consent')
    .update({
      consented: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('channel', channel);

  if (error) {
    console.error('[consent-service] revokeConsent error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ============================================
// QUERY
// ============================================

/**
 * Ritorna lo stato consenso di un'entita' su tutti i canali.
 */
export async function getConsentStatus(
  entityType: 'lead' | 'prospect',
  entityId: string
): Promise<Record<OutreachChannel, boolean>> {
  const { data, error } = await supabaseAdmin
    .from('outreach_consent')
    .select('channel, consented')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  const result: Record<OutreachChannel, boolean> = {
    email: false,
    whatsapp: false,
    telegram: false,
  };

  if (error || !data) return result;

  for (const row of data) {
    if (row.channel in result) {
      result[row.channel as OutreachChannel] = row.consented;
    }
  }

  return result;
}
