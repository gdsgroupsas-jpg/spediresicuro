/**
 * Support Worker
 *
 * Worker per assistenza clienti AI-native.
 * Anne gestisce autonomamente il 95-98% delle richieste di supporto:
 * - Tracking e stato spedizioni
 * - Gestione giacenze (riconsegna, reso, ritiro)
 * - Cancellazioni e rimborsi
 * - Diagnostica problemi
 * - Escalation a operatore umano (solo 2-5% dei casi)
 *
 * NON passa dal pricing graph. Viene gestito direttamente dal supervisor-router.
 */

import { executeTool, ToolCall } from '@/lib/ai/tools';
import { findMatchingRule, SupportContext, shouldConfirm } from '@/lib/ai/support-rules';
import {
  findSimilarPatterns,
  recordPatternUsage,
  learnFromResolvedCase,
  extractKeywords,
  type CaseContext,
} from '@/lib/ai/case-learning';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { defaultLogger, type ILogger } from '../logger';

// ═══════════════════════════════════════════════════════════════════════════
// INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════════════

const SUPPORT_PATTERNS = [
  // Tracking
  /\b(traccia|tracking|tracciamento|dov[\'']?[eè]|dove si trova|stato spedizione|pacco)\b/i,
  // Giacenza
  /\b(giacenza|in giacenza|fermo|bloccato|deposito|non consegnato|tentativo di consegna)\b/i,
  // Cancellazione
  /\b(cancella|annulla|annullare|cancellare|storna|stornare|disdici)\b/i,
  // Rimborso
  /\b(rimborso|rimbors|rimborsa|riaccredito|riaccreditare|indietro i soldi)\b/i,
  // Problemi
  /\b(problema|errore|non funziona|non riesco|aiuto|assistenza|supporto|reclamo)\b/i,
  // Corriere
  /\b(corriere|gls|brt|bartolini|poste|sda|ups|dhl|tnt|fedex)\b.*\b(problema|errore|ritardo|perso|smarrit|danneggiat)\b/i,
  // Consegna fallita
  /\b(consegna fallita|non consegnato|destinatario assente|indirizzo errato|sbagliato)\b/i,
  // Contrassegno
  /\b(contrassegno|cod|pagamento alla consegna)\b.*\b(problema|non pagat|rifiutat)\b/i,
];

/**
 * Rileva se il messaggio ha intent di supporto/assistenza.
 */
export function detectSupportIntent(message: string): boolean {
  return SUPPORT_PATTERNS.some((pattern) => pattern.test(message));
}

// ═══════════════════════════════════════════════════════════════════════════
// PENDING ACTIONS (per confirmation flow)
// ═══════════════════════════════════════════════════════════════════════════

export interface PendingAction {
  id: string;
  type: string;
  description: string;
  cost?: number;
  params: Record<string, any>;
  expiresAt: string; // ISO timestamp
}

// Pending actions persistite in DB (serverless-safe)
// Usa support_notifications con type 'pending_action' come storage temporaneo

export async function storePendingAction(userId: string, action: PendingAction): Promise<void> {
  await supabaseAdmin.from('support_notifications').insert({
    user_id: userId,
    type: 'escalation_update', // Riusa tipo esistente come carrier
    message: action.description,
    metadata: {
      pending_action: true,
      action_id: action.id,
      action_type: action.type,
      action_cost: action.cost,
      action_params: action.params,
      expires_at: action.expiresAt,
    },
    channels_delivered: ['in_app'],
  });
}

export async function getLatestPendingAction(userId: string): Promise<PendingAction | null> {
  const { data } = await supabaseAdmin
    .from('support_notifications')
    .select('metadata')
    .eq('user_id', userId)
    .eq('read', false)
    .filter('metadata->>pending_action', 'eq', 'true')
    .gt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()) // Max 10 min
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!data?.metadata) return null;
  const m = data.metadata as any;

  // Verifica scadenza
  if (m.expires_at && new Date(m.expires_at) < new Date()) return null;

  return {
    id: m.action_id,
    type: m.action_type,
    description: '', // Non serve, abbiamo gia risposto
    cost: m.action_cost,
    params: m.action_params || {},
    expiresAt: m.expires_at,
  };
}

export async function clearPendingActions(userId: string): Promise<void> {
  await supabaseAdmin
    .from('support_notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .filter('metadata->>pending_action', 'eq', 'true');
}

/**
 * Controlla se il messaggio utente e una conferma a un'azione pending.
 */
// Conferma: il messaggio deve INIZIARE con parola di conferma (coerente con approval.ts)
const CONFIRM_PATTERNS =
  /^\s*(si|sì|ok|conferma|confermo|procedi|vai|fallo|certo|assolutamente)[\s,.!]*(.*)$/i;
// Cancellazione: piu' permissiva (non richiede inizio riga) perche' e' l'azione sicura
const CANCEL_PATTERNS = /\b(no|annulla|cancella|stop|ferma|non voglio|lascia stare|niente)\b/i;

export function detectConfirmation(message: string): 'confirm' | 'cancel' | null {
  // Cancel ha priorita': "no, ok lascia stare" non deve confermare
  if (CANCEL_PATTERNS.test(message)) return 'cancel';
  if (CONFIRM_PATTERNS.test(message)) return 'confirm';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORT WORKER
// ═══════════════════════════════════════════════════════════════════════════

export interface SupportWorkerInput {
  message: string;
  userId: string;
  userRole: 'admin' | 'user' | 'reseller';
  workspaceId?: string;
}

export interface SupportWorkerResult {
  response: string;
  pendingAction?: PendingAction;
  toolsUsed: string[];
  /** ID del pattern usato (per tracking apprendimento) */
  usedPatternId?: string;
}

/**
 * Esegue il support worker.
 *
 * Flusso:
 * 1. Controlla se c'e un'azione pending (confirmation flow)
 * 2. Cerca spedizione/i dell'utente rilevanti
 * 3. Diagnostica il problema usando i tool
 * 4. Applica regole decision engine
 * 5. Esegue azione o chiede conferma
 */
export async function supportWorker(
  input: SupportWorkerInput,
  logger: ILogger = defaultLogger
): Promise<SupportWorkerResult> {
  try {
    return await _supportWorkerInternal(input, logger);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Errore sconosciuto';
    console.error(`[Support Worker] Errore non gestito: ${msg}`, error);
    return {
      response:
        'Mi dispiace, si è verificato un problema tecnico temporaneo. Riprova tra qualche istante oppure scrivi "aiuto" per riprovare.',
      toolsUsed: [],
    };
  }
}

async function _supportWorkerInternal(
  input: SupportWorkerInput,
  logger: ILogger
): Promise<SupportWorkerResult> {
  const { message, userId, userRole, workspaceId } = input;
  const toolsUsed: string[] = [];

  logger.log('🎧 [Support Worker] Avvio gestione supporto');

  // Step 1: Check pending action confirmation
  const confirmation = detectConfirmation(message);
  if (confirmation) {
    const pendingAction = await getLatestPendingAction(userId);
    if (pendingAction) {
      if (confirmation === 'confirm') {
        logger.log(`🎧 [Support Worker] Esecuzione azione confermata: ${pendingAction.type}`);
        await clearPendingActions(userId);
        const result = await executeTool(
          { name: pendingAction.type, arguments: { ...pendingAction.params, confirmed: true } },
          userId,
          userRole,
          workspaceId
        );
        toolsUsed.push(pendingAction.type);

        if (result.success) {
          // Apprendimento: registra caso risolto con successo
          learnFromResolvedCase(
            {
              category:
                pendingAction.type === 'manage_hold'
                  ? 'giacenza'
                  : pendingAction.type === 'cancel_shipment'
                    ? 'cancellazione'
                    : 'generico',
              carrier: pendingAction.params.carrier,
              holdReason: pendingAction.params.hold_reason,
              shipmentStatus: pendingAction.params.shipment_status,
              userMessage: message,
              keywords: extractKeywords(message),
            },
            {
              action: pendingAction.type,
              params: pendingAction.params,
              message: result.result?.message,
            }
          ).catch(() => {}); // Fire and forget

          return {
            response: `Fatto! ${result.result?.message || 'Azione completata con successo.'}`,
            toolsUsed,
          };
        } else {
          return {
            response: `Mi dispiace, c'è stato un problema: ${result.error}. Vuoi che riprovi o preferisci che lo passi al team?`,
            toolsUsed,
          };
        }
      } else {
        await clearPendingActions(userId);
        return {
          response: "Ok, azione annullata. C'è altro in cui posso aiutarti?",
          toolsUsed,
        };
      }
    }
  }

  // Step 2: Trova spedizioni dell'utente (ultime 5 attive, workspace-scoped)
  interface RecentShipment {
    id: string;
    tracking_number: string | null;
    status: string;
    carrier: string | null;
    created_at: string;
    recipient_name: string | null;
  }
  // Fail-closed: senza workspaceId non cerchiamo spedizioni (isolamento multi-tenant)
  let recentShipments: RecentShipment[] | null = null;
  if (workspaceId) {
    const shipDb = workspaceQuery(workspaceId);
    const { data } = (await shipDb
      .from('shipments')
      .select('id, tracking_number, status, carrier, created_at, recipient_name')
      .eq('user_id', userId)
      .neq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(5)) as { data: RecentShipment[] | null };
    recentShipments = data;
  }

  // Step 3: Estrai tracking number dal messaggio se presente
  // Valida prima che il tracking appartenga all'utente (pre-check per UX migliore)
  const trackingMatch = message.match(/\b([A-Z0-9]{8,30})\b/);
  let targetShipment = null;

  if (trackingMatch && workspaceId) {
    // Pre-verifica: il tracking appartiene all'utente? (workspace-scoped, fail-closed)
    const trackingDb = workspaceQuery(workspaceId);
    const { data: ownedShipment } = await trackingDb
      .from('shipments')
      .select('id')
      .eq('tracking_number', trackingMatch[1])
      .eq('user_id', userId)
      .single();

    if (ownedShipment) {
      const trackResult = await executeTool(
        { name: 'get_shipment_status', arguments: { shipment_id: ownedShipment.id } },
        userId,
        userRole,
        workspaceId
      );
      toolsUsed.push('get_shipment_status');

      if (trackResult.success) {
        targetShipment = trackResult.result;
      }
    }
    // Se ownedShipment e null, il tracking non appartiene all'utente: prosegui senza
  }

  if (!targetShipment && recentShipments && recentShipments.length === 1) {
    // Se ha una sola spedizione attiva, usa quella
    const trackResult = await executeTool(
      { name: 'get_shipment_status', arguments: { shipment_id: recentShipments[0].id } },
      userId,
      userRole,
      workspaceId
    );
    toolsUsed.push('get_shipment_status');

    if (trackResult.success) {
      targetShipment = trackResult.result;
    }
  } else if (!targetShipment && recentShipments && recentShipments.length > 1) {
    // Multiple spedizioni: chiedi quale
    const list = recentShipments
      .map(
        (s, i) =>
          `${i + 1}. ${s.tracking_number || 'In lavorazione'} → ${s.recipient_name} (${s.status})`
      )
      .join('\n');

    return {
      response: `Ho trovato ${recentShipments.length} spedizioni attive:\n\n${list}\n\nA quale ti riferisci? Puoi indicarmi il numero di tracking o il numero dell'elenco.`,
      toolsUsed,
    };
  }

  // Se non abbiamo trovato nessuna spedizione e il messaggio sembra generico
  if (!targetShipment && !recentShipments?.length) {
    // Prova diagnosi generica
    const diagResult = await executeTool(
      { name: 'diagnose_shipment_issue', arguments: { description: message } },
      userId,
      userRole,
      workspaceId
    );
    toolsUsed.push('diagnose_shipment_issue');

    if (diagResult.success && diagResult.result?.diagnosis) {
      return {
        response: diagResult.result.diagnosis,
        toolsUsed,
      };
    }

    return {
      response:
        'Non ho trovato spedizioni attive associate al tuo account. Puoi indicarmi il numero di tracking della spedizione per cui hai bisogno di assistenza?',
      toolsUsed,
    };
  }

  // Step 4: Cerca pattern appresi + Applica decision engine
  if (targetShipment) {
    const ctx: SupportContext = {
      shipmentStatus: targetShipment.shipment?.status,
      carrier: targetShipment.shipment?.carrier,
      trackingNumber: targetShipment.shipment?.tracking_number,
      isDelivered: targetShipment.tracking?.is_delivered,
      daysSinceLastEvent: targetShipment.tracking?.days_since_last_event,
      holdReason: targetShipment.hold?.reason,
      holdStatus: targetShipment.hold?.status,
      holdDaysRemaining: targetShipment.hold?.days_remaining,
      availableActions: targetShipment.hold?.available_actions?.map((a: any) => a.action_type),
      actionCost: undefined, // Calcolato dopo
      userMessage: message,
    };

    // Step 4a: Cerca pattern appresi da casi precedenti
    const caseCtx: CaseContext = {
      category: ctx.holdReason
        ? 'giacenza'
        : ctx.shipmentStatus === 'cancelled'
          ? 'cancellazione'
          : 'generico',
      carrier: ctx.carrier,
      holdReason: ctx.holdReason,
      shipmentStatus: ctx.shipmentStatus,
      daysSinceLastEvent: ctx.daysSinceLastEvent,
      userMessage: message,
      keywords: extractKeywords(message),
    };

    const learnedPatterns = await findSimilarPatterns(caseCtx);
    if (learnedPatterns.length > 0) {
      const bestPattern = learnedPatterns[0];
      logger.log(
        `🧠 [Support Worker] Pattern appreso trovato: ${bestPattern.pattern.id} ` +
          `(confidence: ${bestPattern.pattern.confidence_score}, match: ${bestPattern.matchScore.toFixed(2)})`
      );

      // Se il pattern ha un messaggio di successo e alta confidence, usalo
      if (
        bestPattern.pattern.successful_message &&
        bestPattern.pattern.confidence_score >= 0.8 &&
        bestPattern.matchScore >= 0.7
      ) {
        // Registra usage
        recordPatternUsage(bestPattern.pattern.id, userId, 'success', {
          shipmentId: targetShipment.shipment?.id,
          userMessage: message,
        }).catch(() => {}); // Fire and forget

        return {
          response: bestPattern.pattern.successful_message,
          toolsUsed,
          usedPatternId: bestPattern.pattern.id,
        };
      }
    }

    // Step 4b: Decision engine (regole statiche)

    // Verifica wallet
    const walletResult = await executeTool(
      { name: 'check_wallet_status', arguments: {} },
      userId,
      userRole,
      workspaceId
    );
    if (walletResult.success) {
      ctx.walletBalance = walletResult.result?.saldo;
      toolsUsed.push('check_wallet_status');
    }

    const match = findMatchingRule(ctx);

    if (match) {
      const { rule, message: ruleMessage } = match;

      // Determina se chiedere conferma
      if (shouldConfirm(rule.confirmLevel, ctx)) {
        // Crea pending action
        const actionId = crypto.randomUUID();
        const pendingAction: PendingAction = {
          id: actionId,
          type:
            rule.suggestedAction === 'hold_action'
              ? 'manage_hold'
              : rule.suggestedAction === 'cancel_shipment'
                ? 'cancel_shipment'
                : rule.suggestedAction === 'refund'
                  ? 'process_refund'
                  : rule.suggestedAction === 'refresh_tracking'
                    ? 'force_refresh_tracking'
                    : 'escalate_to_human',
          description: ruleMessage,
          cost: ctx.actionCost,
          params: {
            ...(rule.suggestedParams || {}),
            shipment_id: targetShipment.shipment?.id,
            tracking_number: ctx.trackingNumber,
          },
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
        };

        storePendingAction(userId, pendingAction);

        return {
          response: ruleMessage,
          pendingAction,
          toolsUsed,
        };
      } else {
        // Auto-execute
        if (rule.suggestedAction === 'info_only') {
          return { response: ruleMessage, toolsUsed };
        }

        if (rule.suggestedAction === 'refresh_tracking') {
          const refreshResult = await executeTool(
            {
              name: 'force_refresh_tracking',
              arguments: { shipment_id: targetShipment.shipment?.id },
            },
            userId,
            userRole,
            workspaceId
          );
          toolsUsed.push('force_refresh_tracking');

          return {
            response: refreshResult.success
              ? `${ruleMessage}\n\n${refreshResult.result?.message || 'Aggiornamento completato.'}`
              : ruleMessage,
            toolsUsed,
          };
        }

        if (rule.suggestedAction === 'escalate') {
          const escResult = await executeTool(
            {
              name: 'escalate_to_human',
              arguments: {
                reason: rule.description,
                anne_summary: `Utente: "${message}". Regola: ${rule.id}. Spedizione: ${ctx.trackingNumber}`,
                shipment_id: targetShipment.shipment?.id,
                conversation_snapshot: [
                  { role: 'user', content: message },
                  {
                    role: 'anne',
                    content: `Regola applicata: ${rule.id} - ${rule.description}`,
                    tools: toolsUsed,
                  },
                ],
              },
            },
            userId,
            userRole,
            workspaceId
          );
          toolsUsed.push('escalate_to_human');

          return {
            response: escResult.success
              ? ruleMessage
              : `${ruleMessage} (Non sono riuscita ad aprire la segnalazione automaticamente, ma il team è stato avvisato.)`,
            toolsUsed,
          };
        }

        return { response: ruleMessage, toolsUsed };
      }
    }

    // Nessuna regola trovata: rispondi con lo stato e offri aiuto
    const statusSummary = buildStatusSummary(targetShipment);
    return {
      response: statusSummary,
      toolsUsed,
    };
  }

  return {
    response: 'Come posso aiutarti con la tua spedizione?',
    toolsUsed,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function buildStatusSummary(data: any): string {
  const s = data.shipment;
  const t = data.tracking;
  const h = data.hold;

  let summary = `Ecco lo stato della spedizione **${s?.tracking_number || 'N/A'}**:\n\n`;
  summary += `- **Stato:** ${s?.status || 'sconosciuto'}\n`;
  summary += `- **Corriere:** ${s?.carrier || 'N/A'}\n`;
  summary += `- **Destinatario:** ${s?.recipient_name || 'N/A'}\n`;

  if (t?.current_status_normalized) {
    summary += `- **Ultimo aggiornamento:** ${t.current_status_normalized}\n`;
  }

  if (t?.is_delivered) {
    summary += `- **Consegnata** ✓\n`;
  }

  if (h) {
    summary += `\n⚠️ **In giacenza:** ${h.reason || 'motivo non specificato'}\n`;
    if (h.days_remaining !== undefined) {
      summary += `- Giorni rimanenti: ${h.days_remaining}\n`;
    }
    if (h.available_actions?.length) {
      summary += `- Azioni disponibili: ${h.available_actions.map((a: any) => a.label || a.action_type).join(', ')}\n`;
    }
  }

  summary += '\nCome vuoi procedere? Posso aiutarti con qualsiasi azione sulla spedizione.';

  return summary;
}
