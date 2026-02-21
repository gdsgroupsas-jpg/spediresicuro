import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';
import { generateCommercialQuotePDF } from '@/lib/commercial-quotes/pdf-generator';
import { sendQuoteToProspectEmail } from '@/lib/email/resend';
import { updateProspectOnQuoteStatus } from '@/actions/reseller-prospects';
import type { CommercialQuote, CommercialQuoteStatus } from '@/types/commercial-quotes';
import {
  loadOrgFooterInfo,
  toAuditContext,
  VALID_TRANSITIONS,
  type ActionResult,
} from './commercial-quotes.helpers';

/**
 * Invia un preventivo: genera PDF, salva in Storage, aggiorna status.
 */
export async function sendCommercialQuoteActionImpl(
  quoteId: string
): Promise<ActionResult<{ pdfUrl: string }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    if (quote.status !== 'draft' && quote.status !== 'negotiating') {
      return { success: false, error: `Impossibile inviare preventivo in stato "${quote.status}"` };
    }

    const branding = wsAuth.workspace.branding || null;
    const orgInfo = await loadOrgFooterInfo(wsAuth.workspace.organization_id);
    const volumetricDivisor = (quote as CommercialQuote).price_matrix?.volumetric_divisor;
    const pdfBuffer = await generateCommercialQuotePDF(
      quote as CommercialQuote,
      branding,
      orgInfo,
      null,
      volumetricDivisor
    );

    const storagePath = `${workspaceId}/${quoteId}/preventivo_rev${quote.revision}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('commercial-quotes')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      if (uploadError.message?.includes('not found') || uploadError.message?.includes('Bucket')) {
        await supabaseAdmin.storage.createBucket('commercial-quotes', { public: false });
        const { error: retryError } = await supabaseAdmin.storage
          .from('commercial-quotes')
          .upload(storagePath, pdfBuffer, {
            contentType: 'application/pdf',
            upsert: true,
          });
        if (retryError) {
          return { success: false, error: `Errore upload PDF: ${retryError.message}` };
        }
      } else {
        return { success: false, error: `Errore upload PDF: ${uploadError.message}` };
      }
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('commercial_quotes')
      .update({
        status: 'sent',
        sent_at: now,
        pdf_storage_path: storagePath,
      })
      .eq('id', quoteId);

    if (updateError) {
      return { success: false, error: `Errore aggiornamento stato: ${updateError.message}` };
    }

    await workspaceQuery(workspaceId)
      .from('commercial_quote_events')
      .insert({
        quote_id: quoteId,
        event_type: 'sent',
        event_data: { pdf_storage_path: storagePath },
        actor_id: userId,
      });

    await writeAuditLog({
      context: toAuditContext(wsAuth),
      action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_SENT,
      resourceType: 'commercial_quote',
      resourceId: quoteId,
      metadata: {
        prospect_company: quote.prospect_company,
        revision: quote.revision,
      },
    });

    if (quote.prospect_email) {
      try {
        await sendQuoteToProspectEmail({
          to: quote.prospect_email,
          prospectName: quote.prospect_contact_name || quote.prospect_company,
          resellerCompanyName: wsAuth.workspace.organization_name || 'SpedireSicuro',
          quoteValidityDays: quote.validity_days,
          pdfBuffer,
        });
      } catch (emailError: any) {
        console.error('Errore invio email prospect:', emailError.message);
      }
    }

    return { success: true, data: { pdfUrl: storagePath } };
  } catch (error: any) {
    console.error('Errore sendCommercialQuoteAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Aggiorna stato preventivo (negotiating, accepted, rejected).
 */
export async function updateQuoteStatusActionImpl(
  quoteId: string,
  newStatus: CommercialQuoteStatus,
  notes?: string
): Promise<ActionResult> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const userId = wsAuth.target.id;
    const workspaceId = wsAuth.workspace.id;

    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, status, prospect_company')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    const currentStatus = quote.status as CommercialQuoteStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      return {
        success: false,
        error: `Transizione non valida: ${currentStatus} -> ${newStatus}`,
      };
    }

    const updatePayload: Record<string, any> = { status: newStatus };

    if (newStatus === 'accepted' || newStatus === 'rejected') {
      updatePayload.responded_at = new Date().toISOString();
    }
    if (notes) {
      updatePayload.response_notes = notes;
    }

    const { error: updateError } = await supabaseAdmin
      .from('commercial_quotes')
      .update(updatePayload)
      .eq('id', quoteId);

    if (updateError) {
      return { success: false, error: `Errore aggiornamento: ${updateError.message}` };
    }

    await workspaceQuery(workspaceId)
      .from('commercial_quote_events')
      .insert({
        quote_id: quoteId,
        event_type: newStatus,
        event_data: { previous_status: currentStatus, notes },
        actor_id: userId,
      });

    if (newStatus === 'accepted') {
      await writeAuditLog({
        context: toAuditContext(wsAuth),
        action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_ACCEPTED,
        resourceType: 'commercial_quote',
        resourceId: quoteId,
        metadata: { prospect_company: quote.prospect_company },
      });
    } else if (newStatus === 'rejected') {
      await writeAuditLog({
        context: toAuditContext(wsAuth),
        action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_REJECTED,
        resourceType: 'commercial_quote',
        resourceId: quoteId,
        metadata: { prospect_company: quote.prospect_company, notes },
      });
    }

    if (newStatus === 'accepted' || newStatus === 'rejected') {
      try {
        await updateProspectOnQuoteStatus(workspaceId, quoteId, newStatus, userId, notes);
      } catch (prospectErr) {
        console.error('[CRM] updateProspectOnQuoteStatus error:', prospectErr);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('Errore updateQuoteStatusAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Elimina un preventivo in bozza.
 */
export async function deleteCommercialQuoteDraftActionImpl(quoteId: string): Promise<ActionResult> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, status')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    if (quote.status !== 'draft') {
      return { success: false, error: 'Solo bozze possono essere eliminate' };
    }

    const { error: deleteError } = await supabaseAdmin
      .from('commercial_quotes')
      .delete()
      .eq('id', quoteId);

    if (deleteError) {
      return { success: false, error: `Errore eliminazione: ${deleteError.message}` };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Errore deleteCommercialQuoteDraftAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}

/**
 * Genera PDF on-the-fly per anteprima bozze.
 * Ritorna base64 del PDF.
 */
export async function generateQuotePdfActionImpl(
  quoteId: string
): Promise<ActionResult<{ pdfBase64: string }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autenticato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: quote, error: loadError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('*')
      .eq('id', quoteId)
      .eq('workspace_id', workspaceId)
      .single();

    if (loadError || !quote) {
      return { success: false, error: 'Preventivo non trovato' };
    }

    const branding = wsAuth.workspace.branding || null;
    const orgInfo = await loadOrgFooterInfo(wsAuth.workspace.organization_id);
    const volumetricDivisor = (quote as CommercialQuote).price_matrix?.volumetric_divisor;
    const pdfBuffer = await generateCommercialQuotePDF(
      quote as CommercialQuote,
      branding,
      orgInfo,
      null,
      volumetricDivisor
    );
    const pdfBase64 = pdfBuffer.toString('base64');

    return { success: true, data: { pdfBase64 } };
  } catch (error: any) {
    console.error('Errore generateQuotePdfAction:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
