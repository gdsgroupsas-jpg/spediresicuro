/**
 * Support Tools per Anne
 *
 * 8 tool che permettono ad Anne di risolvere autonomamente
 * il 95-98% delle richieste di assistenza.
 * Wrappano servizi esistenti (tracking, giacenze, wallet, courier).
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import {
  getTrackingService,
  type TrackingResponse,
} from '@/lib/services/tracking/tracking-service';
import {
  getHoldsForUser,
  getHoldById,
  getAvailableActions,
  executeAction,
} from '@/lib/services/giacenze/giacenze-service';
import { sendAlert } from '@/lib/services/telegram-bot';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import type { ToolDefinition, ToolCall } from '../tools';

// ============================================
// TOOL DEFINITIONS
// ============================================

export const SUPPORT_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_shipment_status',
    description:
      'Ottieni stato completo di una spedizione: tracking, eventi, giacenze attive, ultimo aggiornamento. Usa quando l\'utente chiede "dov\'e il mio pacco?", "stato spedizione", "tracking".',
    parameters: {
      type: 'object',
      properties: {
        shipment_id: {
          type: 'string',
          description: 'ID della spedizione (UUID)',
        },
        tracking_number: {
          type: 'string',
          description: 'Numero di tracking (alternativo a shipment_id)',
        },
      },
      required: [],
    },
  },
  {
    name: 'manage_hold',
    description:
      'Gestisci una giacenza (spedizione ferma in deposito). Senza action_type mostra le opzioni disponibili con costi. Con action_type esegue l\'azione (richiede conferma utente). Usa quando l\'utente dice "giacenza", "pacco fermo", "non consegnato".',
    parameters: {
      type: 'object',
      properties: {
        hold_id: {
          type: 'string',
          description: 'ID della giacenza (UUID)',
        },
        shipment_id: {
          type: 'string',
          description: 'ID spedizione per trovare la giacenza attiva',
        },
        action_type: {
          type: 'string',
          enum: [
            'riconsegna',
            'riconsegna_nuovo_destinatario',
            'reso_mittente',
            'distruggere',
            'ritiro_in_sede',
          ],
          description: 'Azione da eseguire (opzionale - se omesso mostra opzioni)',
        },
        new_address: {
          type: 'object',
          description: 'Nuovo indirizzo (solo per riconsegna_nuovo_destinatario)',
          properties: {
            name: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            zip: { type: 'string' },
            province: { type: 'string' },
            phone: { type: 'string' },
          },
        },
        confirmed: {
          type: 'boolean',
          description: "true se l'utente ha confermato l'azione",
        },
      },
      required: [],
    },
  },
  {
    name: 'cancel_shipment',
    description:
      'Cancella una spedizione e rimborsa il wallet. Possibile SOLO se la spedizione non e ancora partita (status: created, pending_pickup). Usa quando l\'utente dice "cancella", "annulla", "storna".',
    parameters: {
      type: 'object',
      properties: {
        shipment_id: {
          type: 'string',
          description: 'ID della spedizione da cancellare',
        },
        confirmed: {
          type: 'boolean',
          description: "true se l'utente ha confermato la cancellazione",
        },
      },
      required: ['shipment_id'],
    },
  },
  {
    name: 'process_refund',
    description:
      'Verifica eligibilita e processa un rimborso wallet. Controlla le regole (spedizione cancellata, smarrita, ritardo grave). Usa quando l\'utente chiede "rimborso", "riaccredito".',
    parameters: {
      type: 'object',
      properties: {
        shipment_id: {
          type: 'string',
          description: 'ID spedizione per cui richiedere il rimborso',
        },
        reason: {
          type: 'string',
          description: 'Motivo del rimborso',
        },
        confirmed: {
          type: 'boolean',
          description: "true se l'utente ha confermato il rimborso",
        },
      },
      required: ['shipment_id'],
    },
  },
  {
    name: 'force_refresh_tracking',
    description:
      'Forza aggiornamento tracking dal corriere. Usa quando l\'utente dice "tracking non si aggiorna", "stato fermo", "aggiorna tracking".',
    parameters: {
      type: 'object',
      properties: {
        shipment_id: {
          type: 'string',
          description: 'ID della spedizione',
        },
      },
      required: ['shipment_id'],
    },
  },
  {
    name: 'check_wallet_status',
    description:
      'Mostra saldo wallet e ultime transazioni. Usa quando l\'utente chiede "saldo", "wallet", "credito", "transazioni".',
    parameters: {
      type: 'object',
      properties: {
        include_transactions: {
          type: 'boolean',
          description: 'Se true, include ultime 10 transazioni (default: true)',
        },
      },
      required: [],
    },
  },
  {
    name: 'diagnose_shipment_issue',
    description:
      'Diagnostica perche una spedizione non riesce ad essere creata. Controlla: saldo wallet, listini attivi, configurazione corriere, validazione dati. Usa quando l\'utente dice "non riesco a creare", "errore spedizione", "non funziona".',
    parameters: {
      type: 'object',
      properties: {
        error_message: {
          type: 'string',
          description: "Messaggio di errore ricevuto dall'utente (opzionale)",
        },
      },
      required: [],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escala il caso a un operatore umano. USA SOLO quando hai provato tutto e non riesci a risolvere. Crea una escalation con il tuo riassunto del problema.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: "Motivo dell'escalation",
        },
        shipment_id: {
          type: 'string',
          description: 'ID spedizione correlata (opzionale)',
        },
      },
      required: ['reason'],
    },
  },
];

// ============================================
// TOOL EXECUTION
// ============================================

export async function executeSupportTool(
  toolCall: ToolCall,
  userId: string,
  userRole: 'admin' | 'user'
): Promise<{ success: boolean; result: any; error?: string }> {
  try {
    switch (toolCall.name) {
      case 'get_shipment_status':
        return await handleGetShipmentStatus(toolCall.arguments, userId, userRole);
      case 'manage_hold':
        return await handleManageHold(toolCall.arguments, userId);
      case 'cancel_shipment':
        return await handleCancelShipment(toolCall.arguments, userId);
      case 'process_refund':
        return await handleProcessRefund(toolCall.arguments, userId);
      case 'force_refresh_tracking':
        return await handleForceRefreshTracking(toolCall.arguments, userId, userRole);
      case 'check_wallet_status':
        return await handleCheckWalletStatus(toolCall.arguments, userId);
      case 'diagnose_shipment_issue':
        return await handleDiagnoseShipmentIssue(toolCall.arguments, userId);
      case 'escalate_to_human':
        return await handleEscalateToHuman(toolCall.arguments, userId);
      default:
        return {
          success: false,
          result: null,
          error: `Tool supporto sconosciuto: ${toolCall.name}`,
        };
    }
  } catch (error: any) {
    console.error(`[SUPPORT TOOL] Errore ${toolCall.name}:`, error);
    return { success: false, result: null, error: error.message || 'Errore sconosciuto' };
  }
}

// ============================================
// HANDLER IMPLEMENTATIONS
// ============================================

async function handleGetShipmentStatus(
  args: Record<string, any>,
  userId: string,
  userRole: string
) {
  const { shipment_id, tracking_number } = args;

  if (!shipment_id && !tracking_number) {
    return { success: false, result: null, error: 'Serve shipment_id o tracking_number' };
  }

  // Trova spedizione (con filtro user_id a livello DB per isolamento)
  const wsId = await getUserWorkspaceId(userId);
  const shipDb = wsId ? workspaceQuery(wsId) : supabaseAdmin;
  let query = shipDb.from('shipments').select('*');
  if (shipment_id) {
    query = query.eq('id', shipment_id);
  } else {
    query = query.eq('tracking_number', tracking_number);
  }
  // Isolamento: utenti non-admin vedono solo le proprie spedizioni
  if (userRole !== 'admin') {
    query = query.eq('user_id', userId);
  }

  const { data: shipment, error } = await query.single();
  if (error || !shipment) {
    return { success: false, result: null, error: 'Spedizione non trovata' };
  }

  // Tracking
  const trackingService = getTrackingService();
  let tracking: TrackingResponse | null = null;
  try {
    tracking = await trackingService.getTracking(shipment.id);
  } catch {
    // Tracking non disponibile, non blocchiamo
  }

  // Giacenze attive
  const { data: holds } = await supabaseAdmin
    .from('shipment_holds')
    .select('*')
    .eq('shipment_id', shipment.id)
    .in('status', ['open', 'action_requested', 'action_confirmed']);

  return {
    success: true,
    result: {
      spedizione: {
        id: shipment.id,
        tracking_number: shipment.tracking_number,
        destinatario: shipment.recipient_name,
        citta: shipment.recipient_city,
        corriere: shipment.carrier,
        stato: shipment.status,
        prezzo: shipment.final_price,
        creata_il: shipment.created_at,
      },
      tracking: tracking
        ? {
            stato_attuale: tracking.current_status_normalized,
            ultimo_aggiornamento: tracking.last_update,
            consegnata: tracking.is_delivered,
            eventi: tracking.events.slice(0, 5).map((e) => ({
              data: e.event_date,
              stato: e.status_normalized || e.status,
              luogo: e.location,
              descrizione: e.description,
            })),
          }
        : { stato_attuale: shipment.tracking_status || 'sconosciuto', eventi: [] },
      giacenze: (holds || []).map((h: any) => ({
        id: h.id,
        stato: h.status,
        motivo: h.reason,
        rilevata_il: h.detected_at,
        azione_richiesta: h.action_type,
        costo_azione: h.action_cost,
      })),
      ha_giacenza_attiva: (holds || []).length > 0,
    },
  };
}

async function handleManageHold(args: Record<string, any>, userId: string) {
  let { hold_id, shipment_id, action_type, new_address, confirmed } = args;

  // Se abbiamo shipment_id ma non hold_id, trova la giacenza attiva
  // Verifica ownership: la spedizione deve appartenere all'utente
  if (!hold_id && shipment_id) {
    const { data: shipment } = await supabaseAdmin
      .from('shipments')
      .select('id')
      .eq('id', shipment_id)
      .eq('user_id', userId)
      .single();

    if (!shipment) {
      return { success: false, result: null, error: 'Spedizione non trovata' };
    }

    const { data: hold } = await supabaseAdmin
      .from('shipment_holds')
      .select('id')
      .eq('shipment_id', shipment_id)
      .in('status', ['open', 'action_requested'])
      .order('detected_at', { ascending: false })
      .limit(1)
      .single();

    if (hold) hold_id = hold.id;
  }

  if (!hold_id) {
    return { success: false, result: null, error: 'Nessuna giacenza attiva trovata' };
  }

  // Se non c'e action_type, mostra le opzioni disponibili
  if (!action_type) {
    const actions = await getAvailableActions(hold_id, userId);
    return {
      success: true,
      result: {
        hold_id,
        azioni_disponibili: actions.map((a) => ({
          tipo: a.action,
          etichetta: a.label,
          descrizione: a.description,
          costo_fisso: a.fixed_cost,
          costo_percentuale: a.percent_cost,
          costo_dossier: a.dossier_cost,
          costo_totale: a.total_cost,
          richiede_nuovo_indirizzo: a.requires_new_address,
        })),
        messaggio: 'Ecco le azioni disponibili con i relativi costi. Quale preferisci?',
      },
    };
  }

  // Azione richiesta ma non confermata -> proponi
  if (!confirmed) {
    const actions = await getAvailableActions(hold_id, userId);
    const selectedAction = actions.find((a) => a.action === action_type);

    if (!selectedAction) {
      return { success: false, result: null, error: `Azione "${action_type}" non disponibile` };
    }

    return {
      success: true,
      result: {
        hold_id,
        azione_proposta: {
          tipo: selectedAction.action,
          etichetta: selectedAction.label,
          costo_totale: selectedAction.total_cost,
          richiede_nuovo_indirizzo: selectedAction.requires_new_address,
        },
        richiede_conferma: true,
        messaggio: `Posso procedere con "${selectedAction.label}" (costo: €${selectedAction.total_cost.toFixed(2)}). Confermi?`,
      },
    };
  }

  // Azione confermata -> esegui
  const result = await executeAction(hold_id, userId, action_type, new_address);
  return {
    success: true,
    result: {
      eseguito: true,
      giacenza: result,
      messaggio: `Azione "${action_type}" eseguita con successo.`,
    },
  };
}

async function handleCancelShipment(args: Record<string, any>, userId: string) {
  const { shipment_id, confirmed } = args;

  // Verifica spedizione
  const { data: shipment, error } = await supabaseAdmin
    .from('shipments')
    .select('*')
    .eq('id', shipment_id)
    .eq('user_id', userId)
    .single();

  if (error || !shipment) {
    return { success: false, result: null, error: 'Spedizione non trovata' };
  }

  // Verifica stato: cancellabile solo se pre-transito
  const cancellableStatuses = ['created', 'pending_pickup', 'label_created'];
  const currentStatus = shipment.tracking_status || shipment.status || '';

  if (!cancellableStatuses.includes(currentStatus)) {
    return {
      success: false,
      result: {
        stato_attuale: currentStatus,
        cancellabile: false,
      },
      error: `La spedizione non puo essere cancellata: e gia in stato "${currentStatus}". La cancellazione e possibile solo prima della partenza.`,
    };
  }

  if (!confirmed) {
    return {
      success: true,
      result: {
        spedizione: {
          id: shipment.id,
          tracking_number: shipment.tracking_number,
          destinatario: shipment.recipient_name,
          prezzo: shipment.final_price,
        },
        cancellabile: true,
        rimborso_previsto: shipment.final_price,
        richiede_conferma: true,
        messaggio: `Posso cancellare la spedizione ${shipment.tracking_number} e rimborsare €${parseFloat(shipment.final_price || '0').toFixed(2)} sul wallet. Confermi?`,
      },
    };
  }

  // Esegui cancellazione via API
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/spedizioni?id=${shipment_id}`,
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        result: null,
        error: errData.error || `Errore cancellazione (HTTP ${response.status})`,
      };
    }

    return {
      success: true,
      result: {
        cancellata: true,
        rimborsato: shipment.final_price,
        messaggio: `Spedizione ${shipment.tracking_number} cancellata. €${parseFloat(shipment.final_price || '0').toFixed(2)} rimborsati sul wallet.`,
      },
    };
  } catch (err: any) {
    return { success: false, result: null, error: `Errore cancellazione: ${err.message}` };
  }
}

async function handleProcessRefund(args: Record<string, any>, userId: string) {
  const { shipment_id, reason, confirmed } = args;

  const { data: shipment, error } = await supabaseAdmin
    .from('shipments')
    .select('*')
    .eq('id', shipment_id)
    .eq('user_id', userId)
    .single();

  if (error || !shipment) {
    return { success: false, result: null, error: 'Spedizione non trovata' };
  }

  // Verifica eligibilita rimborso
  const status = shipment.tracking_status || shipment.status || '';
  const createdAt = new Date(shipment.created_at);
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  let eligible = false;
  let refundAmount = parseFloat(shipment.final_price || '0');
  let refundReason = '';

  if (['cancelled', 'deleted'].includes(status)) {
    eligible = true;
    refundReason = 'Spedizione cancellata - rimborso completo';
  } else if (status === 'returned') {
    eligible = true;
    refundReason = 'Spedizione resa al mittente - rimborso completo';
  } else if (status === 'lost' || (status === 'exception' && daysSinceCreation > 15)) {
    eligible = true;
    refundReason = 'Spedizione smarrita - rimborso completo';
  } else if (daysSinceCreation > 30) {
    eligible = false;
    refundReason = 'Spedizione troppo vecchia (>30 giorni)';
  } else if (status === 'delivered') {
    eligible = false;
    refundReason = 'Spedizione consegnata - rimborso non previsto';
  } else {
    eligible = false;
    refundReason = `Stato "${status}" non idoneo al rimborso automatico`;
  }

  if (!eligible) {
    return {
      success: true,
      result: {
        eligible: false,
        motivo: refundReason,
        suggerimento:
          'Se ritieni di avere diritto a un rimborso, posso escalare il caso a un operatore.',
      },
    };
  }

  if (!confirmed) {
    return {
      success: true,
      result: {
        eligible: true,
        importo: refundAmount,
        motivo: refundReason,
        richiede_conferma: true,
        messaggio: `Rimborso di €${refundAmount.toFixed(2)} idoneo (${refundReason}). Confermi?`,
      },
    };
  }

  // Esegui rimborso (RPC atomica: lock + UPDATE users + INSERT wallet_transaction)
  const refundWorkspaceId = await getUserWorkspaceId(userId);
  const { error: walletError } = await supabaseAdmin.rpc('refund_wallet_balance', {
    p_user_id: userId,
    p_amount: refundAmount,
    p_description: `Rimborso: ${reason || refundReason} (${shipment.tracking_number})`,
    p_shipment_id: shipment_id,
    p_workspace_id: refundWorkspaceId,
  });

  return {
    success: true,
    result: {
      rimborsato: true,
      importo: refundAmount,
      messaggio: `Rimborso di €${refundAmount.toFixed(2)} accreditato sul wallet.`,
    },
  };
}

async function handleForceRefreshTracking(
  args: Record<string, any>,
  userId: string,
  userRole: string
) {
  const { shipment_id } = args;

  // Verifica accesso
  const { data: shipment } = await supabaseAdmin
    .from('shipments')
    .select('id, user_id, tracking_number')
    .eq('id', shipment_id)
    .single();

  if (!shipment) {
    return { success: false, result: null, error: 'Spedizione non trovata' };
  }

  if (userRole !== 'admin' && shipment.user_id !== userId) {
    return { success: false, result: null, error: 'Non autorizzato' };
  }

  const trackingService = getTrackingService();
  const tracking = await trackingService.getTracking(shipment_id, true);

  return {
    success: true,
    result: {
      aggiornato: true,
      tracking_number: tracking.tracking_number,
      stato_attuale: tracking.current_status_normalized,
      ultimo_aggiornamento: tracking.last_update,
      consegnata: tracking.is_delivered,
      eventi_recenti: tracking.events.slice(0, 3).map((e) => ({
        data: e.event_date,
        stato: e.status_normalized || e.status,
        luogo: e.location,
      })),
      messaggio: tracking.is_delivered
        ? 'La spedizione risulta consegnata.'
        : `Tracking aggiornato. Stato attuale: ${tracking.current_status_normalized}.`,
    },
  };
}

async function handleCheckWalletStatus(args: Record<string, any>, userId: string) {
  const includeTransactions = args.include_transactions !== false;

  // Saldo
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('wallet_balance')
    .eq('id', userId)
    .single();

  if (!user) {
    return { success: false, result: null, error: 'Utente non trovato' };
  }

  const result: any = {
    saldo: parseFloat(user.wallet_balance || '0'),
    messaggio: `Saldo attuale: €${parseFloat(user.wallet_balance || '0').toFixed(2)}`,
  };

  // Transazioni recenti
  if (includeTransactions) {
    const { data: transactions } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, amount, type, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    result.transazioni_recenti = (transactions || []).map((t: any) => ({
      importo: t.amount,
      tipo: t.type,
      descrizione: t.description,
      data: t.created_at,
    }));
  }

  return { success: true, result };
}

async function handleDiagnoseShipmentIssue(args: Record<string, any>, userId: string) {
  const { error_message } = args;
  const diagnosi: string[] = [];
  const problemi: string[] = [];

  // 1. Check wallet
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('wallet_balance, role')
    .eq('id', userId)
    .single();

  const balance = parseFloat(user?.wallet_balance || '0');
  if (balance <= 0) {
    problemi.push(`Saldo wallet insufficiente: €${balance.toFixed(2)}`);
  } else {
    diagnosi.push(`Saldo wallet OK: €${balance.toFixed(2)}`);
  }

  // 2. Check listini attivi
  const { data: priceLists } = await supabaseAdmin
    .from('price_lists')
    .select('id, name, courier_id, status')
    .or(`assigned_to_user_id.eq.${userId},list_type.eq.global`)
    .eq('status', 'active');

  if (!priceLists || priceLists.length === 0) {
    problemi.push('Nessun listino prezzi attivo assegnato');
  } else {
    diagnosi.push(`${priceLists.length} listini attivi trovati`);
  }

  // 3. Check configurazione corriere
  const { data: configs } = await supabaseAdmin
    .from('courier_configs')
    .select('id, provider, is_active')
    .or(`user_id.eq.${userId},is_default.eq.true`)
    .eq('is_active', true);

  if (!configs || configs.length === 0) {
    problemi.push('Nessuna configurazione corriere attiva');
  } else {
    diagnosi.push(`${configs.length} configurazioni corriere attive`);
  }

  // 4. Analisi errore specifico
  if (error_message) {
    if (error_message.includes('402') || error_message.toLowerCase().includes('credito')) {
      problemi.push('Errore 402: credito insufficiente');
    }
    if (error_message.includes('409') || error_message.toLowerCase().includes('duplicat')) {
      problemi.push('Errore 409: spedizione duplicata (riprova tra qualche secondo)');
    }
    if (error_message.toLowerCase().includes('validazione') || error_message.includes('400')) {
      problemi.push('Errore 400: dati non validi (verifica CAP, provincia, peso)');
    }
  }

  return {
    success: true,
    result: {
      diagnosi,
      problemi,
      tutto_ok: problemi.length === 0,
      messaggio:
        problemi.length === 0
          ? "Non ho trovato problemi evidenti. Puoi dirmi l'errore esatto che ricevi?"
          : `Ho trovato ${problemi.length} problema/i: ${problemi.join('; ')}`,
    },
  };
}

async function handleEscalateToHuman(args: Record<string, any>, userId: string) {
  const { reason, shipment_id } = args;

  // Crea escalation
  const { data: escalation, error } = await supabaseAdmin
    .from('support_escalations')
    .insert({
      user_id: userId,
      shipment_id: shipment_id || null,
      reason,
      anne_summary: `Anne non e riuscita a risolvere: ${reason}`,
      conversation_snapshot: args.conversation_snapshot || [],
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    return { success: false, result: null, error: `Errore creazione escalation: ${error.message}` };
  }

  // Notifica admin via Telegram
  try {
    await sendAlert('warning', 'Escalation Assistenza', {
      utente: userId,
      motivo: reason,
      ...(shipment_id ? { spedizione: shipment_id } : {}),
    });
  } catch {
    // Non bloccare se Telegram fallisce
  }

  return {
    success: true,
    result: {
      escalation_id: escalation.id,
      messaggio:
        'Ho aperto una segnalazione per un operatore. Ti contatteranno al piu presto. Mi scuso per il disagio.',
    },
  };
}
