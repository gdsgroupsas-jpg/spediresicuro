/**
 * Supervisor unico: punto di ingresso che smista ogni richiesta in un flusso.
 * Usa solo Ollama per classificare il messaggio. Non esiste "chat generale": tutto viene classificato.
 */

import { chatWithOllama } from '@/lib/ai/ollama';

export const FLOW_IDS = [
  'richiesta_preventivo',
  'crea_spedizione',
  'support',
  'crm',
  'outreach',
  'listini',
  'mentor',
  'debug',
  'explain',
] as const;

export type FlowId = (typeof FLOW_IDS)[number];

const FLOW_ID_SET = new Set<string>(FLOW_IDS);

const SYSTEM_PROMPT = `Sei un classificatore. Il tuo unico compito è assegnare il messaggio dell'utente a una e una sola categoria.

Categorie ammesse (rispondi SOLO con una di queste parole, nulla altro):
- richiesta_preventivo: l'utente chiede un preventivo, un prezzo, quanto costa una spedizione (con o senza peso/CAP già indicati)
- crea_spedizione: l'utente vuole creare/prenotare una spedizione, ha dati mittente/destinatario, vuole prenotare
- support: tracking, giacenza, rimborso, cancellazione, problema consegna, assistenza clienti
- crm: pipeline commerciale, lead, opportunità, vendite, CRM
- outreach: campagne, comunicazioni, outreach marketing
- listini: listino prezzi, clonare listino, assegnare listino, gestione listini
- mentor: domande tecniche su architettura, wallet, RLS, codice, documentazione tecnica
- debug: errore, bug, non funziona, troubleshooting, analisi errori
- explain: spiegare come funziona il business, wallet, margini, flussi operativi

Rispondi con una sola parola: la categoria scelta. Nessun altro testo.`;

function parseFlowId(content: string): FlowId {
  const raw = content.trim().toLowerCase().replace(/[\s.]/g, '');
  if (FLOW_ID_SET.has(raw)) return raw as FlowId;
  const match = content.match(
    /\b(richiesta_preventivo|crea_spedizione|support|crm|outreach|listini|mentor|debug|explain)\b/i
  );
  if (match) return match[1].toLowerCase() as FlowId;
  return 'support';
}

export interface SupervisorInput {
  message: string;
  userId?: string;
}

export interface SupervisorResult {
  flowId: FlowId;
}

/**
 * Classifica il messaggio in un unico flusso. Usa solo Ollama. Nessun fallback "chat generale".
 */
export async function supervisorRoute(input: SupervisorInput): Promise<SupervisorResult> {
  const { message } = input;
  try {
    const response = await chatWithOllama({
      messages: [{ role: 'user', content: message }],
      system: SYSTEM_PROMPT,
      temperature: 0,
      maxTokens: 64,
    });
    const flowId = parseFlowId(response.content || '');
    return { flowId };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'unknown';
    console.warn(JSON.stringify({ event: 'anne_supervisor_error', error: errMsg }));
    return { flowId: 'support' };
  }
}
