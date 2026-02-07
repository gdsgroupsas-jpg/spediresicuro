'use server';

/**
 * Server Actions: Reseller Prospects CRM (Livello 2)
 *
 * Gestione prospect per reseller con scoring e timeline eventi.
 * Pipeline: new -> contacted -> quote_sent -> negotiating -> won|lost
 *
 * Pattern: getWorkspaceAuth() + supabaseAdmin + return {success, data?, error?}
 *
 * @module actions/reseller-prospects
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { calculateLeadScore } from '@/lib/crm/lead-scoring';
import type {
  ResellerProspect,
  ProspectEvent,
  ProspectStatus,
  ProspectEventType,
  CreateProspectDTO,
  UpdateProspectDTO,
  ProspectFilters,
  ProspectStats,
} from '@/types/reseller-prospects';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// READ
// ============================================

/**
 * Lista prospect del workspace corrente con filtri
 */
export async function getProspects(
  filters?: ProspectFilters
): Promise<ActionResult<{ prospects: ResellerProspect[]; stats: ProspectStats }>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const workspaceId = wsAuth.workspace.id;
    let query = supabaseAdmin
      .from('reseller_prospects')
      .select('*, assignee:users!reseller_prospects_assigned_to_fkey(name:full_name, email)')
      .eq('workspace_id', workspaceId);

    // Filtri status
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query = query.in('status', filters.status);
      } else {
        query = query.eq('status', filters.status);
      }
    }

    // Filtro settore
    if (filters?.sector) {
      query = query.eq('sector', filters.sector);
    }

    // Filtro assegnamento
    if (filters?.assigned_to) {
      query = query.eq('assigned_to', filters.assigned_to);
    }

    // Filtro score minimo
    if (filters?.min_score !== undefined) {
      query = query.gte('lead_score', filters.min_score);
    }

    // Ricerca testuale
    if (filters?.search) {
      const term = `%${filters.search}%`;
      query = query.or(`company_name.ilike.${term},contact_name.ilike.${term},email.ilike.${term}`);
    }

    // Ordinamento
    const sortBy = filters?.sort_by || 'created_at';
    const sortOrder = filters?.sort_order === 'asc' ? true : false;
    query = query.order(sortBy, { ascending: sortOrder });

    // Paginazione
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters?.limit || 50) - 1);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: `Errore caricamento prospect: ${error.message}` };

    const prospects = (data || []) as ResellerProspect[];

    // Calcola statistiche
    const stats = await getProspectStatsInternal(workspaceId);

    return { success: true, data: { prospects, stats } };
  } catch (err: any) {
    console.error('[PROSPECTS] getProspects error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

/**
 * Dettaglio prospect con timeline eventi
 */
export async function getProspectById(prospectId: string): Promise<ActionResult<ResellerProspect>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const { data: prospect, error } = await supabaseAdmin
      .from('reseller_prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('workspace_id', wsAuth.workspace.id)
      .single();

    if (error || !prospect) return { success: false, error: 'Prospect non trovato' };

    // Carica eventi timeline
    const { data: events } = await supabaseAdmin
      .from('prospect_events')
      .select('*')
      .eq('prospect_id', prospectId)
      .order('created_at', { ascending: false });

    return {
      success: true,
      data: { ...prospect, events: events || [] } as ResellerProspect,
    };
  } catch (err: any) {
    console.error('[PROSPECTS] getProspectById error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

// ============================================
// CREATE
// ============================================

/**
 * Crea nuovo prospect + evento 'created' + calcola score
 */
export async function createProspect(
  input: CreateProspectDTO
): Promise<ActionResult<ResellerProspect>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const workspaceId = wsAuth.workspace.id;

    // Calcola score iniziale
    const score = calculateLeadScore({
      email: input.email,
      phone: input.phone,
      sector: input.sector,
      estimated_monthly_volume: input.estimated_monthly_volume,
      status: 'new',
      created_at: new Date().toISOString(),
    });

    // Inserisci prospect
    const { data: prospect, error } = await supabaseAdmin
      .from('reseller_prospects')
      .insert({
        workspace_id: workspaceId,
        company_name: input.company_name,
        contact_name: input.contact_name || null,
        email: input.email || null,
        phone: input.phone || null,
        sector: input.sector || null,
        estimated_monthly_volume: input.estimated_monthly_volume || null,
        estimated_monthly_value: input.estimated_monthly_value || null,
        geographic_corridors: input.geographic_corridors || [],
        shipment_types: input.shipment_types || [],
        notes: input.notes || null,
        tags: input.tags || [],
        assigned_to: input.assigned_to || wsAuth.target.id,
        lead_score: score,
        status: 'new',
      })
      .select()
      .single();

    if (error) return { success: false, error: `Errore creazione prospect: ${error.message}` };

    // Evento 'created'
    await addEventInternal(prospect.id, 'created', wsAuth.target.id, {
      company_name: input.company_name,
      initial_score: score,
    });

    return { success: true, data: prospect as ResellerProspect };
  } catch (err: any) {
    console.error('[PROSPECTS] createProspect error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

// ============================================
// UPDATE
// ============================================

/**
 * Aggiorna prospect + evento se cambio status + ricalcola score
 */
export async function updateProspect(
  prospectId: string,
  input: UpdateProspectDTO
): Promise<ActionResult<ResellerProspect>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    // Carica prospect corrente per validazione transizione
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('reseller_prospects')
      .select('*')
      .eq('id', prospectId)
      .eq('workspace_id', wsAuth.workspace.id)
      .single();

    if (fetchError || !current) return { success: false, error: 'Prospect non trovato' };

    // Validazione transizione stato
    if (input.status && input.status !== current.status) {
      const validTransitions = getValidTransitions(current.status as ProspectStatus);
      if (!validTransitions.includes(input.status)) {
        return {
          success: false,
          error: `Transizione non valida: ${current.status} → ${input.status}`,
        };
      }
    }

    // Sanitizza input: rimuovi campi che non devono essere modificabili dal client
    const safeInput = { ...input } as Record<string, unknown>;
    delete safeInput.workspace_id;
    delete safeInput.id;
    delete safeInput.created_at;
    delete safeInput.lead_score;
    delete safeInput.converted_user_id;
    delete safeInput.converted_workspace_id;
    delete safeInput.converted_at;
    delete safeInput.linked_quote_ids;

    // Aggiorna
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('reseller_prospects')
      .update(safeInput)
      .eq('id', prospectId)
      .select()
      .single();

    if (updateError)
      return { success: false, error: `Errore aggiornamento: ${updateError.message}` };

    // Evento per cambio status
    if (input.status && input.status !== current.status) {
      const eventType = input.status === 'lost' ? 'lost' : 'contacted';
      await addEventInternal(prospectId, eventType, wsAuth.target.id, {
        from_status: current.status,
        to_status: input.status,
        lost_reason: input.lost_reason,
      });
    }

    // Ricalcola score
    const newScore = calculateLeadScore({
      email: updated.email,
      phone: updated.phone,
      sector: updated.sector,
      estimated_monthly_volume: updated.estimated_monthly_volume,
      status: updated.status,
      email_open_count: updated.email_open_count,
      last_contact_at: updated.last_contact_at,
      created_at: updated.created_at,
      linked_quote_ids: updated.linked_quote_ids,
    });

    if (Math.abs(newScore - current.lead_score) >= 5) {
      await supabaseAdmin
        .from('reseller_prospects')
        .update({ lead_score: newScore })
        .eq('id', prospectId);

      if (Math.abs(newScore - current.lead_score) >= 10) {
        await addEventInternal(prospectId, 'score_changed', wsAuth.target.id, {
          old_score: current.lead_score,
          new_score: newScore,
        });
      }

      updated.lead_score = newScore;
    }

    return { success: true, data: updated as ResellerProspect };
  } catch (err: any) {
    console.error('[PROSPECTS] updateProspect error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

// ============================================
// DELETE
// ============================================

/**
 * Elimina prospect (hard delete)
 */
export async function deleteProspect(prospectId: string): Promise<ActionResult> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const { error } = await supabaseAdmin
      .from('reseller_prospects')
      .delete()
      .eq('id', prospectId)
      .eq('workspace_id', wsAuth.workspace.id);

    if (error) return { success: false, error: `Errore eliminazione: ${error.message}` };

    return { success: true };
  } catch (err: any) {
    console.error('[PROSPECTS] deleteProspect error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

// ============================================
// NOTE & EVENTI
// ============================================

/**
 * Aggiunge una nota al prospect
 */
export async function addProspectNote(prospectId: string, note: string): Promise<ActionResult> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    // Verifica appartenenza workspace
    const { data: prospect } = await supabaseAdmin
      .from('reseller_prospects')
      .select('id, notes, workspace_id')
      .eq('id', prospectId)
      .eq('workspace_id', wsAuth.workspace.id)
      .single();

    if (!prospect) return { success: false, error: 'Prospect non trovato' };

    // Append nota con timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const newNote = prospect.notes
      ? `${prospect.notes}\n\n[${timestamp}] ${note}`
      : `[${timestamp}] ${note}`;

    await supabaseAdmin
      .from('reseller_prospects')
      .update({ notes: newNote, last_contact_at: new Date().toISOString() })
      .eq('id', prospectId);

    await addEventInternal(prospectId, 'note_added', wsAuth.target.id, {
      note_preview: note.substring(0, 100),
    });

    return { success: true };
  } catch (err: any) {
    console.error('[PROSPECTS] addProspectNote error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

// ============================================
// COLLEGAMENTO PREVENTIVI
// ============================================

/**
 * Collega un preventivo commerciale al prospect
 */
export async function linkQuoteToProspect(
  prospectId: string,
  quoteId: string
): Promise<ActionResult> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const { data: prospect } = await supabaseAdmin
      .from('reseller_prospects')
      .select('id, linked_quote_ids, status, workspace_id')
      .eq('id', prospectId)
      .eq('workspace_id', wsAuth.workspace.id)
      .single();

    if (!prospect) return { success: false, error: 'Prospect non trovato' };

    // Aggiungi quote ID (evita duplicati)
    const currentIds = prospect.linked_quote_ids || [];
    if (currentIds.includes(quoteId)) {
      return { success: true }; // Gia' collegato
    }

    const updatedIds = [...currentIds, quoteId];
    const updateData: Record<string, unknown> = { linked_quote_ids: updatedIds };

    // Auto-avanza status se ancora in 'new' o 'contacted'
    if (prospect.status === 'new' || prospect.status === 'contacted') {
      updateData.status = 'quote_sent';
    }

    await supabaseAdmin.from('reseller_prospects').update(updateData).eq('id', prospectId);

    await addEventInternal(prospectId, 'quote_created', wsAuth.target.id, {
      quote_id: quoteId,
    });

    return { success: true };
  } catch (err: any) {
    console.error('[PROSPECTS] linkQuoteToProspect error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

/**
 * Cerca prospect per email o company_name (per auto-link con preventivi)
 */
export async function findProspectByContact(
  email?: string,
  companyName?: string
): Promise<ActionResult<ResellerProspect | null>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    let query = supabaseAdmin
      .from('reseller_prospects')
      .select('*')
      .eq('workspace_id', wsAuth.workspace.id)
      .not('status', 'eq', 'won'); // Escludi gia' convertiti

    if (email) {
      query = query.ilike('email', email);
    } else if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    } else {
      return { success: true, data: null };
    }

    const { data } = await query.limit(1).maybeSingle();

    return { success: true, data: (data as ResellerProspect) || null };
  } catch (err: any) {
    console.error('[PROSPECTS] findProspectByContact error:', err);
    return { success: false, error: err.message || 'Errore interno' };
  }
}

// ============================================
// HELPERS INTERNI
// ============================================

/** Inserisce evento nella timeline */
async function addEventInternal(
  prospectId: string,
  eventType: ProspectEventType,
  actorId: string,
  eventData?: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin.from('prospect_events').insert({
      prospect_id: prospectId,
      event_type: eventType,
      event_data: eventData || {},
      actor_id: actorId,
    });
  } catch (err) {
    // Non critico - logga ma non blocca
    console.error('[PROSPECTS] addEventInternal error:', err);
  }
}

/** Transizioni valide per stato */
function getValidTransitions(status: ProspectStatus): ProspectStatus[] {
  const transitions: Record<ProspectStatus, ProspectStatus[]> = {
    new: ['contacted', 'lost'],
    contacted: ['quote_sent', 'negotiating', 'lost'],
    quote_sent: ['negotiating', 'won', 'lost'],
    negotiating: ['won', 'lost'],
    won: [],
    lost: ['new'],
  };
  return transitions[status] || [];
}

// ============================================
// HELPERS ESPORTATI per integrazione commercial-quotes
// (Non usano getWorkspaceAuth - il chiamante deve aver gia' verificato)
// ============================================

/**
 * Cerca prospect per email o company (chiamata interna, senza auth check).
 * Usata da commercial-quotes per auto-link.
 */
export async function findProspectByContactInternal(
  workspaceId: string,
  email?: string,
  companyName?: string
): Promise<ResellerProspect | null> {
  try {
    let query = supabaseAdmin
      .from('reseller_prospects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .not('status', 'eq', 'won');

    if (email) {
      query = query.ilike('email', email);
    } else if (companyName) {
      query = query.ilike('company_name', `%${companyName}%`);
    } else {
      return null;
    }

    const { data } = await query.limit(1).maybeSingle();
    return (data as ResellerProspect) || null;
  } catch (err) {
    console.error('[PROSPECTS] findProspectByContactInternal error:', err);
    return null;
  }
}

/**
 * Collega quote a prospect e auto-avanza status (chiamata interna, senza auth check).
 * Usata da commercial-quotes post-creazione.
 */
export async function linkQuoteToProspectInternal(
  prospectId: string,
  quoteId: string,
  actorId: string
): Promise<void> {
  try {
    const { data: prospect } = await supabaseAdmin
      .from('reseller_prospects')
      .select('id, linked_quote_ids, status')
      .eq('id', prospectId)
      .single();

    if (!prospect) return;

    const currentIds = prospect.linked_quote_ids || [];
    if (currentIds.includes(quoteId)) return;

    const updatedIds = [...currentIds, quoteId];
    const updateData: Record<string, unknown> = { linked_quote_ids: updatedIds };

    // Auto-avanza status se ancora in 'new' o 'contacted'
    if (prospect.status === 'new' || prospect.status === 'contacted') {
      updateData.status = 'quote_sent';
    }

    await supabaseAdmin.from('reseller_prospects').update(updateData).eq('id', prospectId);

    await addEventInternal(prospectId, 'quote_created', actorId, { quote_id: quoteId });
  } catch (err) {
    console.error('[PROSPECTS] linkQuoteToProspectInternal error:', err);
  }
}

/**
 * Aggiorna prospect quando un preventivo collegato viene accettato/rifiutato.
 * Usata da commercial-quotes post-status-change.
 */
export async function updateProspectOnQuoteStatus(
  workspaceId: string,
  quoteId: string,
  quoteStatus: 'accepted' | 'rejected',
  actorId: string,
  notes?: string
): Promise<void> {
  try {
    // Cerca prospect con questo quote collegato
    const { data: prospects } = await supabaseAdmin
      .from('reseller_prospects')
      .select('id, status, linked_quote_ids')
      .eq('workspace_id', workspaceId)
      .contains('linked_quote_ids', [quoteId]);

    if (!prospects || prospects.length === 0) return;

    const prospect = prospects[0];

    if (quoteStatus === 'accepted') {
      // Preventivo accettato → prospect diventa 'won'
      await supabaseAdmin
        .from('reseller_prospects')
        .update({
          status: 'won',
          converted_at: new Date().toISOString(),
        })
        .eq('id', prospect.id);

      await addEventInternal(prospect.id, 'converted', actorId, {
        quote_id: quoteId,
        trigger: 'quote_accepted',
      });
    } else if (quoteStatus === 'rejected') {
      // Preventivo rifiutato → registra evento (non cambia status automaticamente)
      await addEventInternal(prospect.id, 'quote_rejected', actorId, {
        quote_id: quoteId,
        reason: notes || undefined,
      });

      // Se il prospect era in 'quote_sent' → torna a 'contacted'
      if (prospect.status === 'quote_sent') {
        await supabaseAdmin
          .from('reseller_prospects')
          .update({
            status: 'contacted',
            lost_reason: notes || undefined,
          })
          .eq('id', prospect.id);
      }
    }
  } catch (err) {
    console.error('[PROSPECTS] updateProspectOnQuoteStatus error:', err);
  }
}

/** Calcola statistiche prospect per workspace */
async function getProspectStatsInternal(workspaceId: string): Promise<ProspectStats> {
  const { data: all } = await supabaseAdmin
    .from('reseller_prospects')
    .select('status, estimated_monthly_value, lead_score, converted_at')
    .eq('workspace_id', workspaceId);

  const prospects = all || [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const byStatus: Record<ProspectStatus, number> = {
    new: 0,
    contacted: 0,
    quote_sent: 0,
    negotiating: 0,
    won: 0,
    lost: 0,
  };

  let pipelineValue = 0;
  let totalScore = 0;
  let wonThisMonth = 0;

  for (const p of prospects) {
    const status = p.status as ProspectStatus;
    byStatus[status] = (byStatus[status] || 0) + 1;

    // Pipeline value: solo prospect attivi (non won/lost)
    if (!['won', 'lost'].includes(status) && p.estimated_monthly_value) {
      pipelineValue += Number(p.estimated_monthly_value);
    }

    totalScore += p.lead_score || 0;

    // Vinti questo mese
    if (status === 'won' && p.converted_at && new Date(p.converted_at) >= monthStart) {
      wonThisMonth++;
    }
  }

  return {
    total: prospects.length,
    by_status: byStatus,
    won_this_month: wonThisMonth,
    pipeline_value: pipelineValue,
    average_score: prospects.length > 0 ? Math.round(totalScore / prospects.length) : 0,
  };
}
