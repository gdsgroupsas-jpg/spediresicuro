/**
 * Server Actions per Sistema di Assistenza
 * 
 * Server Actions sicure per gestione ticket, messaggi e knowledge base
 * con validazione Zod e RLS (Row Level Security)
 */

'use server';

import { revalidatePath } from 'next/cache';
import { createServerActionClient } from '@/lib/supabase-server';
import { getSafeAuth } from '@/lib/safe-auth';
import {
  createTicketSchema,
  updateTicketSchema,
  createMessageSchema,
  submitRatingSchema,
  giacenzaActionSchema,
  type CreateTicketSchema,
  type UpdateTicketSchema,
  type CreateMessageSchema,
  type SubmitRatingSchema,
  type GiacenzaActionSchema,
} from '@/lib/validations/support';
import type {
  SupportTicket,
  SupportTicketWithRelations,
  SupportMessage,
  SupportStats,
  TicketListParams,
} from '@/types/support';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Log azione su ticket per audit trail
 */
async function logSupportAction(
  supabase: any,
  data: {
    ticket_id: string;
    user_id: string;
    action_type: string;
    action_data: Record<string, any>;
    success?: boolean;
    error_message?: string;
  }
) {
  const { error } = await supabase
    .from('support_actions')
    .insert({
      ticket_id: data.ticket_id,
      user_id: data.user_id,
      action_type: data.action_type,
      action_data: data.action_data,
      success: data.success ?? true,
      error_message: data.error_message,
    });
  
  if (error) {
    console.error('Errore log action:', error);
  }
}

/**
 * Invia notifica Telegram per nuovo ticket (placeholder)
 */
async function notifyNewTicket(ticket: SupportTicket) {
  // TODO: Integrazione con sistema Telegram esistente
  console.log('Notifica nuovo ticket:', ticket.ticket_number);
}

/**
 * Invia notifica per nuovo messaggio (placeholder)
 */
async function notifyNewMessage(ticket: SupportTicket, message: SupportMessage) {
  // TODO: Integrazione con sistema Telegram esistente
  console.log('Notifica nuovo messaggio su ticket:', ticket.ticket_number);
}

// ============================================
// TICKET ACTIONS
// ============================================

/**
 * Crea un nuovo ticket di assistenza
 */
export async function createTicket(input: CreateTicketSchema) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    // Validazione input
    const validated = createTicketSchema.parse(input);
    
    const supabase = await createServerActionClient();
    
    // Ottieni reseller_id dell'utente (se esiste)
    const { data: userData } = await supabase
      .from('auth.users')
      .select('reseller_id')
      .eq('id', auth.user.id)
      .single();
    
    // Inserimento ticket
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: auth.user.id,
        reseller_id: userData?.reseller_id || null,
        category: validated.category,
        priority: validated.priority,
        subject: validated.subject,
        description: validated.description,
        shipment_id: validated.shipment_id,
        invoice_id: validated.invoice_id,
        wallet_transaction_id: validated.wallet_transaction_id,
        tags: validated.tags,
        metadata: {},
      })
      .select()
      .single();
    
    if (error) {
      console.error('Errore creazione ticket:', error);
      return { success: false, error: 'Errore durante la creazione del ticket' };
    }
    
    // Log azione
    await logSupportAction(supabase, {
      ticket_id: ticket.id,
      user_id: auth.user.id,
      action_type: 'created',
      action_data: {
        ticket_number: ticket.ticket_number,
        category: ticket.category,
        priority: ticket.priority,
      },
    });
    
    // Notifica (async, non blocca)
    notifyNewTicket(ticket).catch(console.error);
    
    revalidatePath('/dashboard/assistenza');
    
    return {
      success: true,
      data: ticket,
    };
  } catch (error) {
    console.error('Errore createTicket:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

/**
 * Aggiorna un ticket esistente
 */
export async function updateTicket(ticketId: string, input: UpdateTicketSchema) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const validated = updateTicketSchema.parse(input);
    
    const supabase = await createServerActionClient();
    
    // Verifica accesso al ticket (RLS lo fa automaticamente)
    const { data: existingTicket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();
    
    if (!existingTicket) {
      return { success: false, error: 'Ticket non trovato' };
    }
    
    // Aggiornamento
    const updateData: any = {
      ...validated,
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };
    
    // Se viene assegnato, imposta assigned_at
    if (validated.assigned_to !== undefined) {
      updateData.assigned_at = validated.assigned_to ? new Date().toISOString() : null;
    }
    
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updateData)
      .eq('id', ticketId)
      .select()
      .single();
    
    if (error) {
      console.error('Errore aggiornamento ticket:', error);
      return { success: false, error: 'Errore durante l\'aggiornamento del ticket' };
    }
    
    // Log azioni specifiche
    if (validated.status) {
      await logSupportAction(supabase, {
        ticket_id: ticketId,
        user_id: auth.user.id,
        action_type: 'status_change',
        action_data: {
          old_status: existingTicket.status,
          new_status: validated.status,
        },
      });
    }
    
    if (validated.priority) {
      await logSupportAction(supabase, {
        ticket_id: ticketId,
        user_id: auth.user.id,
        action_type: 'priority_change',
        action_data: {
          old_priority: existingTicket.priority,
          new_priority: validated.priority,
        },
      });
    }
    
    if (validated.assigned_to !== undefined) {
      await logSupportAction(supabase, {
        ticket_id: ticketId,
        user_id: auth.user.id,
        action_type: 'assignment',
        action_data: {
          old_assignee: existingTicket.assigned_to,
          new_assignee: validated.assigned_to,
        },
      });
    }
    
    revalidatePath('/dashboard/assistenza');
    revalidatePath(`/dashboard/assistenza/${ticketId}`);
    
    return {
      success: true,
      data: ticket,
    };
  } catch (error) {
    console.error('Errore updateTicket:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

/**
 * Ottieni lista ticket con filtri
 */
export async function getTickets(params?: TicketListParams) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const supabase = await createServerActionClient();
    
    const {
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
      status,
      category,
      priority,
      assigned_to,
      search,
    } = params || {};
    
    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        user:auth.users!user_id(id, email, name),
        assigned_to_user:auth.users!assigned_to(id, name),
        messages:support_messages(count),
        attachments:support_attachments(count)
      `, { count: 'exact' });
    
    // Filtri
    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }
    
    if (category) {
      if (Array.isArray(category)) {
        query = query.in('category', category);
      } else {
        query = query.eq('category', category);
      }
    }
    
    if (priority) {
      if (Array.isArray(priority)) {
        query = query.in('priority', priority);
      } else {
        query = query.eq('priority', priority);
      }
    }
    
    if (assigned_to !== undefined) {
      if (assigned_to === null) {
        query = query.is('assigned_to', null);
      } else {
        query = query.eq('assigned_to', assigned_to);
      }
    }
    
    if (search) {
      query = query.or(`subject.ilike.%${search}%,description.ilike.%${search}%,ticket_number.ilike.%${search}%`);
    }
    
    // Ordinamento
    query = query.order(sort_by, { ascending: sort_order === 'asc' });
    
    // Paginazione
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);
    
    const { data: tickets, error, count } = await query;
    
    if (error) {
      console.error('Errore getTickets:', error);
      return { success: false, error: 'Errore durante il recupero dei ticket' };
    }
    
    return {
      success: true,
      data: {
        tickets: tickets || [],
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
    };
  } catch (error) {
    console.error('Errore getTickets:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

/**
 * Ottieni dettaglio ticket con messaggi e allegati
 */
export async function getTicketDetail(ticketId: string) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const supabase = await createServerActionClient();
    
    // Ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        *,
        user:auth.users!user_id(id, email, name),
        assigned_to_user:auth.users!assigned_to(id, name),
        shipment:shipments(id, tracking_number)
      `)
      .eq('id', ticketId)
      .single();
    
    if (ticketError || !ticket) {
      return { success: false, error: 'Ticket non trovato' };
    }
    
    // Messaggi
    const { data: messages } = await supabase
      .from('support_messages')
      .select(`
        *,
        user:auth.users!user_id(id, email, name)
      `)
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    
    // Allegati
    const { data: attachments } = await supabase
      .from('support_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });
    
    // Azioni (solo per operatori)
    let actions = [];
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', auth.user.id)
      .single();
    
    if (userRole && ['admin', 'operator', 'superadmin'].includes(userRole.role)) {
      const { data: actionsData } = await supabase
        .from('support_actions')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });
      
      actions = actionsData || [];
    }
    
    return {
      success: true,
      data: {
        ticket,
        messages: messages || [],
        attachments: attachments || [],
        actions,
      },
    };
  } catch (error) {
    console.error('Errore getTicketDetail:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

// ============================================
// MESSAGE ACTIONS
// ============================================

/**
 * Aggiungi messaggio a un ticket
 */
export async function addMessage(input: CreateMessageSchema) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const validated = createMessageSchema.parse(input);
    
    const supabase = await createServerActionClient();
    
    // Verifica accesso al ticket
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', validated.ticket_id)
      .single();
    
    if (!ticket) {
      return { success: false, error: 'Ticket non trovato' };
    }
    
    // Ottieni ruolo utente
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', auth.user.id)
      .single();
    
    const role = userRole?.role || 'customer';
    
    // Inserimento messaggio
    const { data: message, error } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: validated.ticket_id,
        user_id: auth.user.id,
        user_role: role,
        message: validated.message,
        is_internal: validated.is_internal,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Errore addMessage:', error);
      return { success: false, error: 'Errore durante l\'invio del messaggio' };
    }
    
    // Aggiorna first_response_at se è la prima risposta di un operatore
    if (['operator', 'admin', 'superadmin'].includes(role) && !ticket.first_response_at) {
      await supabase
        .from('support_tickets')
        .update({
          first_response_at: new Date().toISOString(),
          first_response_by: auth.user.id,
          status: 'in_lavorazione',
        })
        .eq('id', validated.ticket_id);
    }
    
    // Notifica
    notifyNewMessage(ticket, message).catch(console.error);
    
    revalidatePath(`/dashboard/assistenza/${validated.ticket_id}`);
    
    return {
      success: true,
      data: message,
    };
  } catch (error) {
    console.error('Errore addMessage:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

// ============================================
// RATING ACTIONS
// ============================================

/**
 * Invia valutazione per un ticket
 */
export async function submitRating(input: SubmitRatingSchema) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const validated = submitRatingSchema.parse(input);
    
    const supabase = await createServerActionClient();
    
    // Aggiorna ticket con rating
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update({
        rating: validated.rating,
        feedback: validated.feedback,
      })
      .eq('id', validated.ticket_id)
      .eq('user_id', auth.user.id) // Solo il proprietario può valutare
      .select()
      .single();
    
    if (error || !ticket) {
      return { success: false, error: 'Errore durante l\'invio della valutazione' };
    }
    
    // Log azione
    await logSupportAction(supabase, {
      ticket_id: validated.ticket_id,
      user_id: auth.user.id,
      action_type: 'rating_submitted',
      action_data: {
        rating: validated.rating,
        has_feedback: !!validated.feedback,
      },
    });
    
    revalidatePath(`/dashboard/assistenza/${validated.ticket_id}`);
    
    return {
      success: true,
      data: ticket,
    };
  } catch (error) {
    console.error('Errore submitRating:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

// ============================================
// STATISTICS ACTIONS
// ============================================

/**
 * Ottieni statistiche ticket
 */
export async function getSupportStats(userId?: string) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const supabase = await createServerActionClient();
    
    const { data, error } = await supabase
      .rpc('get_support_stats', { p_user_id: userId || null });
    
    if (error) {
      console.error('Errore getSupportStats:', error);
      return { success: false, error: 'Errore durante il recupero delle statistiche' };
    }
    
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Errore getSupportStats:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

/**
 * Ottieni metriche SLA
 */
export async function getSLAMetrics(days: number = 7) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const supabase = await createServerActionClient();
    
    const { data, error } = await supabase
      .rpc('get_support_sla_metrics', { p_days: days });
    
    if (error) {
      console.error('Errore getSLAMetrics:', error);
      return { success: false, error: 'Errore durante il recupero delle metriche SLA' };
    }
    
    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Errore getSLAMetrics:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}

// ============================================
// GIACENZA ACTIONS (esempio integrazione)
// ============================================

/**
 * Richiedi riconsegna giacenza
 */
export async function requestGiacenzaRiconsegna(input: GiacenzaActionSchema) {
  try {
    const auth = await getSafeAuth();
    if (!auth.user) {
      return { success: false, error: 'Non autenticato' };
    }
    
    const validated = giacenzaActionSchema.parse(input);
    
    // Verifica ruolo operatore
    const supabase = await createServerActionClient();
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', auth.user.id)
      .single();
    
    if (!userRole || !['operator', 'admin', 'superadmin'].includes(userRole.role)) {
      return { success: false, error: 'Non autorizzato' };
    }
    
    // TODO: Implementare logica riconsegna
    // - Verifica saldo wallet
    // - Addebito costo riconsegna
    // - Chiamata API corriere
    
    // Log azione
    await logSupportAction(supabase, {
      ticket_id: validated.ticket_id,
      user_id: auth.user.id,
      action_type: 'giacenza_action',
      action_data: {
        action: validated.action,
        shipment_id: validated.shipment_id,
      },
    });
    
    revalidatePath(`/dashboard/assistenza/${validated.ticket_id}`);
    
    return {
      success: true,
      message: 'Riconsegna richiesta con successo',
    };
  } catch (error) {
    console.error('Errore requestGiacenzaRiconsegna:', error);
    
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    
    return { success: false, error: 'Errore sconosciuto' };
  }
}
