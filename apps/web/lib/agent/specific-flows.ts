/**
 * Flussi specifici: ogni azione ha un flowId dedicato.
 * Mappa macro (support, crm, ...) -> elenco di flowId specifici.
 */

import type { FlowId } from './supervisor';

export const SPECIFIC_FLOW_IDS = [
  // support
  'support_tracking',
  'support_giacenza',
  'support_rimborso',
  'support_cancellazione',
  'support_problema_consegna',
  'support_assistenza',
  // crm
  'crm_pipeline',
  'crm_lead',
  'crm_opportunita',
  'crm_vendite',
  // outreach
  'outreach_campagne',
  'outreach_comunicazioni',
  'outreach_marketing',
  // listini
  'listini_visualizza',
  'listini_clona',
  'listini_assegna',
  'listini_gestione',
  // mentor
  'mentor_architettura',
  'mentor_wallet',
  'mentor_rls',
  'mentor_codice',
  'mentor_documentazione',
  // debug
  'debug_errore',
  'debug_bug',
  'debug_troubleshooting',
  'debug_analisi',
  // explain
  'explain_business',
  'explain_wallet',
  'explain_margini',
  'explain_flussi',
] as const;

export type SpecificFlowId = (typeof SPECIFIC_FLOW_IDS)[number];

const SPECIFIC_SET = new Set<string>(SPECIFIC_FLOW_IDS);

export function isSpecificFlowId(s: string): s is SpecificFlowId {
  return SPECIFIC_SET.has(s);
}

/** Macro per cui esiste un livello di flussi specifici (Supervisor -> Intermediary -> specifico) */
export const MACROS_WITH_SPECIFICS: FlowId[] = [
  'support',
  'crm',
  'outreach',
  'listini',
  'mentor',
  'debug',
  'explain',
];

export function isMacroWithSpecifics(flowId: FlowId): boolean {
  return MACROS_WITH_SPECIFICS.includes(flowId);
}

/** Per ogni macro, elenco di flowId specifici ammessi */
export const MACRO_TO_SPECIFICS: Record<FlowId, SpecificFlowId[]> = {
  richiesta_preventivo: [],
  crea_spedizione: [],
  support: [
    'support_tracking',
    'support_giacenza',
    'support_rimborso',
    'support_cancellazione',
    'support_problema_consegna',
    'support_assistenza',
  ],
  crm: ['crm_pipeline', 'crm_lead', 'crm_opportunita', 'crm_vendite'],
  outreach: ['outreach_campagne', 'outreach_comunicazioni', 'outreach_marketing'],
  listini: ['listini_visualizza', 'listini_clona', 'listini_assegna', 'listini_gestione'],
  mentor: [
    'mentor_architettura',
    'mentor_wallet',
    'mentor_rls',
    'mentor_codice',
    'mentor_documentazione',
  ],
  debug: ['debug_errore', 'debug_bug', 'debug_troubleshooting', 'debug_analisi'],
  explain: ['explain_business', 'explain_wallet', 'explain_margini', 'explain_flussi'],
};

export function getSpecificFlowIdsForMacro(macro: FlowId): SpecificFlowId[] {
  return MACRO_TO_SPECIFICS[macro] ?? [];
}
