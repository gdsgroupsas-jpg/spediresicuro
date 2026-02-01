/**
 * Decision Engine per il supporto Anne
 *
 * Regole che determinano come Anne gestisce ogni tipo di problema.
 * Struttura: condizione → azione → livello di conferma.
 *
 * confirmLevel:
 * - 'auto': Anne esegue senza chiedere (azioni gratuite e sicure)
 * - 'confirm': Anne chiede sempre conferma all'utente
 * - 'anne_decides': Anne decide in base al contesto (costo, rischio, etc.)
 */

import { HoldReason, HoldActionType } from '@/types/giacenze';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type SupportActionType =
  | 'hold_action' // Azione su giacenza
  | 'cancel_shipment' // Cancella spedizione
  | 'refund' // Rimborso wallet
  | 'refresh_tracking' // Aggiorna tracking
  | 'escalate' // Escalation a operatore
  | 'info_only'; // Solo informativa, nessuna azione

export type ConfirmLevel = 'auto' | 'confirm' | 'anne_decides';

export interface SupportRule {
  id: string;
  description: string;
  // Filtri
  carrier?: string; // '*' = tutti, oppure 'GLS' | 'BRT' | 'POSTE' etc.
  category: 'giacenza' | 'cancellazione' | 'rimborso' | 'tracking' | 'generico';
  // Condizione
  condition: (ctx: SupportContext) => boolean;
  // Azione suggerita
  suggestedAction: SupportActionType;
  suggestedParams?: Record<string, any>;
  // Livello conferma
  confirmLevel: ConfirmLevel;
  // Priorita (piu alto = piu specifico)
  priority: number;
  // Messaggio template per Anne
  messageTemplate: string;
}

export interface SupportContext {
  // Spedizione
  shipmentStatus?: string;
  carrier?: string;
  trackingNumber?: string;
  daysInTransit?: number;
  daysSinceLastEvent?: number;
  isDelivered?: boolean;
  // Giacenza
  holdReason?: HoldReason;
  holdStatus?: string;
  holdDaysRemaining?: number;
  availableActions?: HoldActionType[];
  // Costi
  actionCost?: number;
  walletBalance?: number;
  shipmentValue?: number;
  // Utente
  userMessage: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// REGOLE GIACENZA
// ═══════════════════════════════════════════════════════════════════════════

const HOLD_RULES: SupportRule[] = [
  // --- Destinatario assente ---
  {
    id: 'hold_absent_redelivery',
    description: 'Giacenza per destinatario assente: proponi riconsegna',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) => ctx.holdReason === 'destinatario_assente',
    suggestedAction: 'hold_action',
    suggestedParams: { action_type: 'riconsegna' },
    confirmLevel: 'anne_decides',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è in giacenza perché il destinatario era assente. Posso richiedere una riconsegna{cost_info}.',
  },
  // --- Indirizzo errato ---
  {
    id: 'hold_wrong_address',
    description: 'Giacenza per indirizzo errato: chiedi nuovo indirizzo',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) => ctx.holdReason === 'indirizzo_errato',
    suggestedAction: 'hold_action',
    suggestedParams: { action_type: 'riconsegna_nuovo_destinatario' },
    confirmLevel: 'confirm',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è in giacenza per indirizzo errato o incompleto. Per la riconsegna ho bisogno del nuovo indirizzo completo{cost_info}.',
  },
  // --- Rifiutata ---
  {
    id: 'hold_refused',
    description: 'Giacenza per rifiuto: proponi reso mittente',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) => ctx.holdReason === 'rifiutata',
    suggestedAction: 'hold_action',
    suggestedParams: { action_type: 'reso_mittente' },
    confirmLevel: 'confirm',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è stata rifiutata dal destinatario. Posso richiedere il reso al mittente{cost_info}. Vuoi procedere?',
  },
  // --- Contrassegno non pagato ---
  {
    id: 'hold_cod_unpaid',
    description: 'Giacenza per contrassegno non pagato: riconsegna o reso',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) => ctx.holdReason === 'contrassegno_non_pagato',
    suggestedAction: 'hold_action',
    suggestedParams: { action_type: 'riconsegna' },
    confirmLevel: 'confirm',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è in giacenza perché il contrassegno non è stato pagato. Posso tentare una riconsegna oppure organizzare il reso al mittente{cost_info}.',
  },
  // --- Zona non accessibile ---
  {
    id: 'hold_inaccessible',
    description: 'Giacenza per zona non accessibile: ritiro in sede o nuovo indirizzo',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) => ctx.holdReason === 'zona_non_accessibile',
    suggestedAction: 'hold_action',
    suggestedParams: { action_type: 'ritiro_in_sede' },
    confirmLevel: 'confirm',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è in giacenza perché la zona non è accessibile dal corriere. Il destinatario può ritirarla in sede oppure posso richiedere la consegna a un indirizzo diverso{cost_info}.',
  },
  // --- Documenti mancanti ---
  {
    id: 'hold_missing_docs',
    description: 'Giacenza per documenti mancanti: escalation',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) => ctx.holdReason === 'documenti_mancanti',
    suggestedAction: 'escalate',
    confirmLevel: 'auto',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è in giacenza per documenti mancanti. Questo caso richiede intervento specifico — lo sto passando al team.',
  },
  // --- Giacenza in scadenza (< 3 giorni) ---
  {
    id: 'hold_expiring',
    description: 'Giacenza in scadenza: urgenza nella comunicazione',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) =>
      ctx.holdStatus === 'open' &&
      ctx.holdDaysRemaining !== undefined &&
      ctx.holdDaysRemaining <= 3,
    suggestedAction: 'hold_action',
    confirmLevel: 'confirm',
    priority: 20, // Priorita alta: override la regola base
    messageTemplate:
      '⚠️ URGENTE: La giacenza per {tracking} scade tra {days_remaining} giorni. Se non agiamo, il pacco verrà restituito o distrutto. Cosa preferisci fare?',
  },
  // --- Giacenza generica / motivo "altro" ---
  {
    id: 'hold_generic',
    description: 'Giacenza con motivo generico: mostra opzioni disponibili',
    category: 'giacenza',
    carrier: '*',
    condition: (ctx) => ctx.holdReason === 'altro' || !ctx.holdReason,
    suggestedAction: 'hold_action',
    confirmLevel: 'confirm',
    priority: 1,
    messageTemplate:
      'La spedizione {tracking} è in giacenza. Ecco le azioni disponibili: {available_actions}. Cosa preferisci?',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REGOLE CANCELLAZIONE
// ═══════════════════════════════════════════════════════════════════════════

const CANCELLATION_RULES: SupportRule[] = [
  {
    id: 'cancel_pre_transit',
    description: 'Cancellazione prima del ritiro: possibile',
    category: 'cancellazione',
    carrier: '*',
    condition: (ctx) => ctx.shipmentStatus === 'pending' || ctx.shipmentStatus === 'label_created',
    suggestedAction: 'cancel_shipment',
    confirmLevel: 'confirm',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} non è ancora stata ritirata dal corriere. Posso cancellarla e il credito verrà restituito al tuo wallet. Confermi?',
  },
  {
    id: 'cancel_in_transit',
    description: 'Cancellazione in transito: non possibile, proponi alternative',
    category: 'cancellazione',
    carrier: '*',
    condition: (ctx) => ctx.shipmentStatus === 'in_transit' || ctx.shipmentStatus === 'picked_up',
    suggestedAction: 'info_only',
    confirmLevel: 'auto',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è già in transito e non può essere cancellata. Posso richiedere un reso al mittente quando viene consegnata, oppure se va in giacenza possiamo gestirla da lì.',
  },
  {
    id: 'cancel_delivered',
    description: 'Cancellazione dopo consegna: non possibile',
    category: 'cancellazione',
    carrier: '*',
    condition: (ctx) => ctx.isDelivered === true,
    suggestedAction: 'info_only',
    confirmLevel: 'auto',
    priority: 20,
    messageTemplate:
      'La spedizione {tracking} risulta già consegnata, quindi non è possibile cancellarla. Se ci sono problemi con la consegna, dimmi di più e vediamo come posso aiutarti.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REGOLE RIMBORSO
// ═══════════════════════════════════════════════════════════════════════════

const REFUND_RULES: SupportRule[] = [
  {
    id: 'refund_cancelled',
    description: 'Rimborso per spedizione cancellata: automatico',
    category: 'rimborso',
    carrier: '*',
    condition: (ctx) => ctx.shipmentStatus === 'cancelled',
    suggestedAction: 'refund',
    confirmLevel: 'anne_decides',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} è stata cancellata. Il rimborso di €{amount} verrà accreditato sul tuo wallet.',
  },
  {
    id: 'refund_lost',
    description: 'Rimborso per spedizione smarrita: escalation per verifica',
    category: 'rimborso',
    carrier: '*',
    condition: (ctx) =>
      ctx.daysSinceLastEvent !== undefined && ctx.daysSinceLastEvent > 14 && !ctx.isDelivered,
    suggestedAction: 'escalate',
    confirmLevel: 'auto',
    priority: 15,
    messageTemplate:
      'La spedizione {tracking} non ha aggiornamenti da {days} giorni e potrebbe essere smarrita. Sto aprendo una segnalazione per verificare con il corriere e procedere al rimborso.',
  },
  {
    id: 'refund_severe_delay',
    description: 'Ritardo grave (>7 giorni senza aggiornamenti): proponi azione',
    category: 'rimborso',
    carrier: '*',
    condition: (ctx) =>
      ctx.daysSinceLastEvent !== undefined &&
      ctx.daysSinceLastEvent > 7 &&
      ctx.daysSinceLastEvent <= 14 &&
      !ctx.isDelivered,
    suggestedAction: 'refresh_tracking',
    confirmLevel: 'auto',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} non ha aggiornamenti da {days} giorni. Sto forzando un aggiornamento del tracking per verificare la situazione.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REGOLE TRACKING
// ═══════════════════════════════════════════════════════════════════════════

const TRACKING_RULES: SupportRule[] = [
  {
    id: 'tracking_stale_48h',
    description: 'Tracking non aggiornato da 48h+: forza refresh',
    category: 'tracking',
    carrier: '*',
    condition: (ctx) =>
      ctx.daysSinceLastEvent !== undefined && ctx.daysSinceLastEvent >= 2 && !ctx.isDelivered,
    suggestedAction: 'refresh_tracking',
    confirmLevel: 'auto',
    priority: 5,
    messageTemplate:
      'Il tracking di {tracking} non si aggiorna da {days} giorni. Sto verificando lo stato aggiornato con il corriere.',
  },
  {
    id: 'tracking_delivered',
    description: 'Spedizione consegnata: conferma',
    category: 'tracking',
    carrier: '*',
    condition: (ctx) => ctx.isDelivered === true,
    suggestedAction: 'info_only',
    confirmLevel: 'auto',
    priority: 10,
    messageTemplate:
      'La spedizione {tracking} risulta consegnata. Se il pacco non è stato effettivamente ricevuto, fammi sapere e apro una verifica.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/** Tutte le regole, ordinate per priorita decrescente */
const ALL_RULES: SupportRule[] = [
  ...HOLD_RULES,
  ...CANCELLATION_RULES,
  ...REFUND_RULES,
  ...TRACKING_RULES,
].sort((a, b) => b.priority - a.priority);

export interface RuleMatch {
  rule: SupportRule;
  message: string;
}

/**
 * Trova la regola migliore per il contesto dato.
 * Ritorna la prima regola che matcha (gia ordinate per priorita).
 */
export function findMatchingRule(ctx: SupportContext): RuleMatch | null {
  for (const rule of ALL_RULES) {
    // Filtro carrier
    if (rule.carrier && rule.carrier !== '*' && rule.carrier !== ctx.carrier) {
      continue;
    }

    // Valuta condizione
    try {
      if (rule.condition(ctx)) {
        const message = interpolateMessage(rule.messageTemplate, ctx);
        return { rule, message };
      }
    } catch {
      // Condizione fallita, skip
      continue;
    }
  }

  return null;
}

/**
 * Trova TUTTE le regole che matchano (per casi complessi con piu azioni possibili).
 */
export function findAllMatchingRules(ctx: SupportContext): RuleMatch[] {
  const matches: RuleMatch[] = [];

  for (const rule of ALL_RULES) {
    if (rule.carrier && rule.carrier !== '*' && rule.carrier !== ctx.carrier) {
      continue;
    }

    try {
      if (rule.condition(ctx)) {
        const message = interpolateMessage(rule.messageTemplate, ctx);
        matches.push({ rule, message });
      }
    } catch {
      continue;
    }
  }

  return matches;
}

/**
 * Determina se Anne deve chiedere conferma per un'azione.
 * Per 'anne_decides': chiede se costo > 0 o azione irreversibile.
 */
export function shouldConfirm(confirmLevel: ConfirmLevel, ctx: SupportContext): boolean {
  if (confirmLevel === 'auto') return false;
  if (confirmLevel === 'confirm') return true;

  // anne_decides: conferma se c'e un costo o saldo insufficiente
  if (ctx.actionCost && ctx.actionCost > 0) return true;
  if (
    ctx.walletBalance !== undefined &&
    ctx.actionCost !== undefined &&
    ctx.walletBalance < ctx.actionCost
  ) {
    return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function interpolateMessage(template: string, ctx: SupportContext): string {
  return template
    .replace('{tracking}', ctx.trackingNumber || 'N/A')
    .replace('{days}', String(ctx.daysSinceLastEvent ?? '?'))
    .replace('{days_remaining}', String(ctx.holdDaysRemaining ?? '?'))
    .replace('{amount}', ctx.shipmentValue?.toFixed(2) ?? '?')
    .replace(
      '{cost_info}',
      ctx.actionCost && ctx.actionCost > 0 ? ` (costo: €${ctx.actionCost.toFixed(2)})` : ''
    )
    .replace('{available_actions}', ctx.availableActions?.join(', ') ?? 'nessuna');
}
