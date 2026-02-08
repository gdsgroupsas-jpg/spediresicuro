/**
 * CRM Write Service — Sprint S2
 *
 * Layer di scrittura CRM per Anne. Stessa architettura di crm-data-service.ts
 * ma per operazioni di modifica: aggiornamento stato, note, registrazione contatti.
 *
 * Accetta userId/role/workspaceId direttamente (no contesto HTTP/cookie).
 * Ogni operazione: valida → aggiorna → ricalcola score → crea evento timeline.
 *
 * @module lib/crm/crm-write-service
 */

import { supabaseAdmin } from '@/lib/db/client';
import { calculateLeadScore } from '@/lib/crm/lead-scoring';
import type { LeadScoreInput } from '@/lib/crm/lead-scoring';
import { LEAD_VALID_TRANSITIONS } from '@/types/leads';
import type { LeadStatus, LeadEventType } from '@/types/leads';
import { VALID_TRANSITIONS } from '@/types/reseller-prospects';
import type { ProspectStatus, ProspectEventType } from '@/types/reseller-prospects';
import type { CrmWriteResult } from '@/types/crm-intelligence';

// ============================================
// PARAMETRI INPUT
// ============================================

export interface UpdateStatusParams {
  role: 'admin' | 'user';
  entityId: string;
  newStatus: string;
  actorId: string;
  workspaceId?: string;
  lostReason?: string;
}

export interface AddNoteParams {
  role: 'admin' | 'user';
  entityId: string;
  note: string;
  actorId: string;
  workspaceId?: string;
}

export interface RecordContactParams {
  role: 'admin' | 'user';
  entityId: string;
  contactNote?: string;
  actorId: string;
  workspaceId?: string;
}

// ============================================
// HELPERS
// ============================================

/**
 * Mappa status lead a status prospect per il calcolo score
 * (la funzione di scoring usa ProspectStatus)
 */
function mapLeadStatusToProspectStatus(
  status: string
): 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost' {
  const map: Record<string, 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost'> = {
    new: 'new',
    contacted: 'contacted',
    qualified: 'contacted',
    negotiation: 'negotiating',
    won: 'won',
    lost: 'lost',
  };
  return map[status] || 'new';
}

/**
 * Costruisce input per il calcolo score da un record lead
 */
function buildScoreInputFromLead(lead: Record<string, any>): LeadScoreInput {
  return {
    email: lead.email,
    phone: lead.phone,
    sector: lead.sector,
    estimated_monthly_volume: lead.estimated_monthly_volume,
    status: mapLeadStatusToProspectStatus(lead.status || 'new'),
    email_open_count: lead.email_open_count,
    last_contact_at: lead.last_contact_at,
    created_at: lead.created_at || new Date().toISOString(),
    linked_quote_ids: lead.linked_quote_ids || [],
  };
}

/**
 * Costruisce input per il calcolo score da un record prospect
 */
function buildScoreInputFromProspect(prospect: Record<string, any>): LeadScoreInput {
  return {
    email: prospect.email,
    phone: prospect.phone,
    sector: prospect.sector,
    estimated_monthly_volume: prospect.estimated_monthly_volume,
    status: prospect.status || 'new',
    email_open_count: prospect.email_open_count,
    last_contact_at: prospect.last_contact_at,
    created_at: prospect.created_at || new Date().toISOString(),
    linked_quote_ids: prospect.linked_quote_ids || [],
  };
}

// ============================================
// UPDATE STATUS
// ============================================

/**
 * Aggiorna lo stato di un lead/prospect nella pipeline.
 * Valida la transizione, aggiorna, ricalcola score, crea evento.
 */
export async function updateEntityStatus(params: UpdateStatusParams): Promise<CrmWriteResult> {
  const { role, entityId, newStatus, actorId, workspaceId, lostReason } = params;
  const isAdmin = role === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const eventsTable = isAdmin ? 'lead_events' : 'prospect_events';
  const fkColumn = isAdmin ? 'lead_id' : 'prospect_id';

  // 1. Fetch entita' corrente
  let query = supabaseAdmin.from(table).select('*').eq('id', entityId);
  if (!isAdmin && workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }
  const { data: entity, error: fetchError } = await query.single();

  if (fetchError || !entity) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'status_update',
      details: '',
      error: 'Entita non trovata',
    };
  }

  const entityName = entity.company_name || entityId;
  const currentStatus = entity.status;

  // 2. Valida transizione
  if (isAdmin) {
    const validTargets = LEAD_VALID_TRANSITIONS[currentStatus as LeadStatus] || [];
    if (!validTargets.includes(newStatus as LeadStatus)) {
      const validList =
        validTargets.length > 0 ? validTargets.join(', ') : 'nessuna (stato finale)';
      return {
        success: false,
        entityId,
        entityName,
        action: 'status_update',
        details: '',
        error: `Transizione ${currentStatus} → ${newStatus} non valida. Transizioni valide: ${validList}`,
      };
    }
  } else {
    const validTargets = VALID_TRANSITIONS[currentStatus as ProspectStatus] || [];
    if (!validTargets.includes(newStatus as ProspectStatus)) {
      const validList =
        validTargets.length > 0 ? validTargets.join(', ') : 'nessuna (stato finale)';
      return {
        success: false,
        entityId,
        entityName,
        action: 'status_update',
        details: '',
        error: `Transizione ${currentStatus} → ${newStatus} non valida. Transizioni valide: ${validList}`,
      };
    }
  }

  // 3. Prepara dati update
  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === 'lost' && lostReason) {
    updateData.lost_reason = lostReason;
  }

  // 4. Ricalcola score
  const merged = { ...entity, ...updateData };
  const scoreInput = isAdmin
    ? buildScoreInputFromLead(merged)
    : buildScoreInputFromProspect(merged);
  const newScore = calculateLeadScore(scoreInput);
  updateData.lead_score = newScore;

  // 5. Esegui update
  const { error: updateError } = await supabaseAdmin
    .from(table)
    .update(updateData)
    .eq('id', entityId);

  if (updateError) {
    return {
      success: false,
      entityId,
      entityName,
      action: 'status_update',
      details: '',
      error: `Errore aggiornamento: ${updateError.message}`,
    };
  }

  // 6. Crea evento timeline
  const eventType = getStatusChangeEventType(newStatus, isAdmin);
  await supabaseAdmin.from(eventsTable).insert({
    [fkColumn]: entityId,
    event_type: eventType,
    event_data: {
      from_status: currentStatus,
      to_status: newStatus,
      lost_reason: newStatus === 'lost' ? lostReason : undefined,
    },
    actor_id: actorId,
  });

  // Evento score changed se delta significativo
  const oldScore = entity.lead_score || 0;
  if (Math.abs(newScore - oldScore) >= 10) {
    await supabaseAdmin.from(eventsTable).insert({
      [fkColumn]: entityId,
      event_type: 'score_changed',
      event_data: { old_score: oldScore, new_score: newScore },
      actor_id: actorId,
    });
  }

  return {
    success: true,
    entityId,
    entityName,
    action: 'status_update',
    details: `Stato aggiornato da ${currentStatus} a ${newStatus}`,
    newScore,
  };
}

/**
 * Determina il tipo di evento in base al nuovo stato
 */
function getStatusChangeEventType(newStatus: string, isAdmin: boolean): string {
  if (isAdmin) {
    const eventMap: Record<string, LeadEventType> = {
      contacted: 'contacted',
      qualified: 'qualified',
      negotiation: 'negotiation_started',
      won: 'converted',
      lost: 'lost',
      new: 'reactivated',
    };
    return eventMap[newStatus] || 'contacted';
  } else {
    const eventMap: Record<string, ProspectEventType> = {
      contacted: 'contacted',
      quote_sent: 'quote_sent',
      negotiating: 'contacted',
      won: 'converted',
      lost: 'lost',
      new: 'reactivated',
    };
    return eventMap[newStatus] || 'contacted';
  }
}

// ============================================
// ADD NOTE
// ============================================

/**
 * Aggiunge una nota a un lead/prospect.
 * Appendi con timestamp, crea evento note_added.
 */
export async function addEntityNote(params: AddNoteParams): Promise<CrmWriteResult> {
  const { role, entityId, note, actorId, workspaceId } = params;
  const isAdmin = role === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const eventsTable = isAdmin ? 'lead_events' : 'prospect_events';
  const fkColumn = isAdmin ? 'lead_id' : 'prospect_id';

  // 1. Fetch entita' corrente
  let query = supabaseAdmin.from(table).select('id, company_name, notes').eq('id', entityId);
  if (!isAdmin && workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }
  const { data: entity, error: fetchError } = await query.single();

  if (fetchError || !entity) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'note_added',
      details: '',
      error: 'Entita non trovata',
    };
  }

  const entityName = entity.company_name || entityId;

  // 2. Appendi nota con timestamp
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const existingNotes = entity.notes || '';
  const updatedNotes = existingNotes
    ? `${existingNotes}\n\n[${timestamp}] ${note}`
    : `[${timestamp}] ${note}`;

  // 3. Esegui update
  const { error: updateError } = await supabaseAdmin
    .from(table)
    .update({ notes: updatedNotes })
    .eq('id', entityId);

  if (updateError) {
    return {
      success: false,
      entityId,
      entityName,
      action: 'note_added',
      details: '',
      error: `Errore aggiornamento: ${updateError.message}`,
    };
  }

  // 4. Crea evento
  await supabaseAdmin.from(eventsTable).insert({
    [fkColumn]: entityId,
    event_type: 'note_added',
    event_data: { note_preview: note.slice(0, 100) },
    actor_id: actorId,
  });

  return {
    success: true,
    entityId,
    entityName,
    action: 'note_added',
    details: `Nota aggiunta: "${note.slice(0, 80)}${note.length > 80 ? '...' : ''}"`,
  };
}

// ============================================
// RECORD CONTACT
// ============================================

/**
 * Registra un contatto avvenuto con lead/prospect.
 * Aggiorna last_contact_at, auto-avanza da new a contacted, aggiunge nota opzionale.
 */
export async function recordEntityContact(params: RecordContactParams): Promise<CrmWriteResult> {
  const { role, entityId, contactNote, actorId, workspaceId } = params;
  const isAdmin = role === 'admin';
  const table = isAdmin ? 'leads' : 'reseller_prospects';
  const eventsTable = isAdmin ? 'lead_events' : 'prospect_events';
  const fkColumn = isAdmin ? 'lead_id' : 'prospect_id';

  // 1. Fetch entita' corrente
  let query = supabaseAdmin
    .from(table)
    .select(
      'id, company_name, notes, status, lead_score, email, phone, sector, estimated_monthly_volume, email_open_count, last_contact_at, created_at, linked_quote_ids'
    )
    .eq('id', entityId);
  if (!isAdmin && workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }
  const { data: entity, error: fetchError } = await query.single();

  if (fetchError || !entity) {
    return {
      success: false,
      entityId,
      entityName: '',
      action: 'contact_recorded',
      details: '',
      error: 'Entita non trovata',
    };
  }

  const entityName = entity.company_name || entityId;
  const now = new Date().toISOString();

  // 2. Prepara update
  const updateData: Record<string, unknown> = {
    last_contact_at: now,
  };

  // Auto-avanza da new a contacted
  let statusAdvanced = false;
  if (entity.status === 'new') {
    updateData.status = 'contacted';
    statusAdvanced = true;
  }

  // Aggiunge nota contatto se fornita
  if (contactNote) {
    const timestamp = now.slice(0, 16).replace('T', ' ');
    const existingNotes = entity.notes || '';
    updateData.notes = existingNotes
      ? `${existingNotes}\n\n[${timestamp}] Contatto: ${contactNote}`
      : `[${timestamp}] Contatto: ${contactNote}`;
  }

  // Ricalcola score
  const merged = { ...entity, ...updateData };
  const scoreInput = isAdmin
    ? buildScoreInputFromLead(merged)
    : buildScoreInputFromProspect(merged);
  const newScore = calculateLeadScore(scoreInput);
  updateData.lead_score = newScore;

  // 3. Esegui update
  const { error: updateError } = await supabaseAdmin
    .from(table)
    .update(updateData)
    .eq('id', entityId);

  if (updateError) {
    return {
      success: false,
      entityId,
      entityName,
      action: 'contact_recorded',
      details: '',
      error: `Errore aggiornamento: ${updateError.message}`,
    };
  }

  // 4. Crea evento contacted
  await supabaseAdmin.from(eventsTable).insert({
    [fkColumn]: entityId,
    event_type: 'contacted',
    event_data: {
      contact_note: contactNote?.slice(0, 200),
      status_advanced: statusAdvanced,
    },
    actor_id: actorId,
  });

  // Se nota contatto presente, crea anche evento note_added
  if (contactNote) {
    await supabaseAdmin.from(eventsTable).insert({
      [fkColumn]: entityId,
      event_type: 'note_added',
      event_data: { note_preview: contactNote.slice(0, 100) },
      actor_id: actorId,
    });
  }

  const details = statusAdvanced
    ? `Contatto registrato. Stato avanzato da new a contacted.`
    : `Contatto registrato. Ultimo contatto: adesso.`;

  return {
    success: true,
    entityId,
    entityName,
    action: 'contact_recorded',
    details,
    newScore,
  };
}
