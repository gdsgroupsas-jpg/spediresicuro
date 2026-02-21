/**
 * Intent Detector
 *
 * Rileva se il messaggio dell'utente è una richiesta di preventivo.
 * Usa pattern matching semplice + LLM opzionale per maggiore accuratezza.
 */

import { HumanMessage } from '@langchain/core/messages';
import { defaultLogger } from './logger';

/**
 * Pattern chiave per rilevare richieste di preventivo
 */
const PRICING_KEYWORDS = [
  'preventivo',
  'prezzo',
  'costo',
  'quanto costa',
  'quanto viene',
  'tariffa',
  'listino',
  'preventiv',
  'quotazione',
  'quote',
  'spedire',
  'spedizione',
  'spedisci',
  'cap',
  'peso',
  'kg',
  'chili',
];

/**
 * Pattern per escludere (non sono richieste di preventivo)
 */
const EXCLUDE_KEYWORDS = [
  'fattura',
  'fatturato',
  'margine',
  'ricavo',
  'guadagno',
  'profitto',
  'analisi',
  'report',
  'statistiche',
];

/**
 * Rileva intento preventivo con pattern matching semplice
 * SAFE: Richiede keyword + almeno 1 dato (CAP o peso)
 */
export function detectPricingIntentSimple(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Escludi se contiene keyword di esclusione
  if (EXCLUDE_KEYWORDS.some((keyword) => lowerMessage.includes(keyword))) {
    return false;
  }

  // Controlla se contiene keyword di preventivo
  const hasPricingKeyword = PRICING_KEYWORDS.some((keyword) => lowerMessage.includes(keyword));

  if (!hasPricingKeyword) {
    return false;
  }

  // SAFE: Richiede keyword + almeno 1 dato (CAP o peso)
  const hasData =
    /\b\d{5}\b/.test(message) || // CAP (5 cifre)
    /\b\d+(?:[.,]\d+)?\s*(?:kg|chili|peso)/i.test(message); // Peso

  return hasPricingKeyword && hasData;
}

/**
 * Rileva intento preventivo con LLM (più accurato ma più lento)
 */
export async function detectPricingIntentLLM(message: string): Promise<boolean> {
  const llm = createGraphLLM({ maxOutputTokens: llmConfig.INTENT_DETECTOR_MAX_OUTPUT_TOKENS });

  if (!llm) {
    // Fallback a pattern matching se LLM non disponibile
    return detectPricingIntentSimple(message);
  }

  try {
    const prompt = `Analizza questo messaggio e determina se l'utente sta chiedendo un PREVENTIVO o QUOTAZIONE per una spedizione.

Messaggio: "${message}"

Rispondi ESCLUSIVAMENTE con JSON:
{
  "is_pricing_request": boolean,
  "confidence": number,  // 0-100
  "reason": "breve spiegazione"
}`;

    const result = await llm.invoke([new HumanMessage(prompt)]);
    const jsonText = result.content
      .toString()
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const parsed = JSON.parse(jsonText);

    // Considera preventivo se confidence > 70
    return parsed.is_pricing_request === true && (parsed.confidence || 0) > 70;
  } catch (error) {
    defaultLogger.warn('⚠️ [Intent Detector] Errore LLM, uso pattern matching:', error);
    return detectPricingIntentSimple(message);
  }
}

import { llmConfig } from '@/lib/config';
import { createGraphLLM } from './llm-factory';

/**
 * Rileva intento preventivo (usa LLM se disponibile, altrimenti pattern matching)
 */
export async function detectPricingIntent(
  message: string,
  useLLM: boolean = false
): Promise<boolean> {
  if (useLLM) {
    return detectPricingIntentLLM(message);
  }
  return detectPricingIntentSimple(message);
}

// ============================================
// CRM INTENT DETECTION
// ============================================

/**
 * Keyword CRM — pipeline, lead, prospect, azioni commerciali
 */
const CRM_KEYWORDS = [
  'pipeline',
  'lead',
  'prospect',
  'contattare',
  'funnel',
  'chi devo',
  'cosa devo fare oggi',
  'azioni di oggi',
  'azioni crm',
  'quanti lead',
  'quanti prospect',
  'conversione',
  'tasso conversione',
  'caldo',
  'freddo',
  'stale',
  'fermo',
  'abbandonato',
  'score',
  'punteggio',
  'salute crm',
  'health crm',
  'preventivo commerciale',
  'win-back',
  'riattiva',
  'perso',
  'negoziazione',
  'qualificato',
  'pipeline commerciale',
  'come va la pipeline',
  'situazione commerciale',
  'come vanno i lead',
  'come vanno i prospect',
  // Sprint S2 — Write actions
  'segna',
  'aggiorna stato',
  'cambia stato',
  'sposta',
  'aggiungi nota',
  'scrivi nota',
  'salva nota',
  'ho chiamato',
  'ho sentito',
  'ho parlato',
  'ho contattato',
  'abbiamo contattato',
  'registra contatto',
  'avanza',
  'metti come',
  'segna come',
];

/**
 * Keyword di esclusione — evita collisioni con pricing e support
 */
const CRM_EXCLUDE_KEYWORDS = [
  'preventivo spedizione',
  'quanto costa spedire',
  'traccia',
  'tracking',
  'dove si trova',
  'il mio pacco',
  'stato spedizione',
  'giacenza',
];

/**
 * Rileva intento CRM con pattern matching
 *
 * Usato dal supervisor-router DOPO il check support e PRIMA del check pricing.
 */
export function detectCrmIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  // Escludi se contiene keyword di pricing/support
  if (CRM_EXCLUDE_KEYWORDS.some((kw) => lowerMessage.includes(kw))) {
    return false;
  }

  // Controlla se contiene almeno una keyword CRM
  return CRM_KEYWORDS.some((kw) => lowerMessage.includes(kw));
}

// ============================================
// OUTREACH INTENT DETECTION (Sprint S3c)
// ============================================

/**
 * Keyword outreach — sequenze, invii, canali, template, campagne
 */
const OUTREACH_KEYWORDS = [
  'sequenza',
  'outreach',
  'invia email',
  'invia whatsapp',
  'invia telegram',
  'manda email',
  'manda whatsapp',
  'manda messaggio',
  'manda telegram',
  'followup automatico',
  'follow-up automatico',
  'campagna',
  'enrollment',
  'iscrivi alla sequenza',
  'attiva sequenza',
  'canali attivi',
  'canali outreach',
  'template outreach',
  'template email',
  'disabilita canale',
  'abilita canale',
  'metriche outreach',
  'statistiche outreach',
  'pausa sequenza',
  'riprendi sequenza',
  'cancella sequenza',
  'stop sequenza',
];

/**
 * Keyword di esclusione outreach
 */
const OUTREACH_EXCLUDE_KEYWORDS = [
  'preventivo spedizione',
  'quanto costa spedire',
  'traccia',
  'tracking',
];

/**
 * Rileva intento outreach con pattern matching.
 * Usato dal supervisor-router DOPO CRM e PRIMA di pricing.
 */
export function detectOutreachIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  if (OUTREACH_EXCLUDE_KEYWORDS.some((kw) => lowerMessage.includes(kw))) {
    return false;
  }

  return OUTREACH_KEYWORDS.some((kw) => lowerMessage.includes(kw));
}

// ============================================
// SHIPMENT CREATION INTENT DETECTION
// ============================================

/**
 * Keyword per rilevare l'intento di CREARE una spedizione (non solo un preventivo).
 * L'utente vuole effettivamente spedire, non solo sapere il prezzo.
 */
// HIGH-3 FIX: rimosse keyword troppo generiche ('spedire a', 'spedire da', 'spedisci a')
// che catturavano anche richieste pricing tipo "spedire 5kg a Milano".
// Tenute solo frasi esplicite di CREAZIONE/PRENOTAZIONE spedizione.
const SHIPMENT_CREATION_KEYWORDS = [
  'voglio spedire',
  'vorrei spedire',
  'devo spedire',
  'devo inviare',
  'crea spedizione',
  'crea una spedizione',
  'creare una spedizione',
  'nuova spedizione',
  'fare una spedizione',
  'fai una spedizione',
  'manda un pacco',
  'manda pacco',
  'mandare un pacco',
  'invia un pacco',
  'invia pacco',
  'inviare un pacco',
  'spedire un pacco',
  'prenota spedizione',
  'prenotare spedizione',
  'prenotare una spedizione',
  'preparare una spedizione',
  'effettuare una spedizione',
  'organizza spedizione',
  'spedisci questo',
  'voglio fare una spedizione',
  'voglio mandare',
  'vorrei mandare',
  'vorrei inviare',
  'ordina spedizione',
  'ordinare una spedizione',
];

/**
 * Keyword di esclusione — non sono richieste di creazione spedizione
 */
const SHIPMENT_CREATION_EXCLUDE_KEYWORDS = [
  'traccia',
  'tracking',
  'dove si trova',
  'stato spedizione',
  'annulla spedizione',
  'cancella spedizione',
  'fattura',
  'report',
  'statistiche',
  'preventivo',
  'quanto costa',
];

/**
 * Rileva intento "creazione spedizione": l'utente vuole creare/prenotare una spedizione
 * (non solo un preventivo).
 *
 * Usato dal Supervisor Router per instradare alla catena creazione spedizione.
 * Posizionato DOPO outreach e PRIMA di pricing nel flusso di intent detection.
 */
export function detectShipmentCreationIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();

  if (SHIPMENT_CREATION_EXCLUDE_KEYWORDS.some((kw) => lowerMessage.includes(kw))) {
    return false;
  }

  return SHIPMENT_CREATION_KEYWORDS.some((kw) => lowerMessage.includes(kw));
}

/**
 * HIGH-2 FIX: Rileva se l'utente vuole annullare/abbandonare la creazione spedizione in corso.
 * Usato dal supervisor per resettare shipment_creation_phase.
 */
const CANCEL_CREATION_KEYWORDS = [
  'annulla',
  'cancella',
  'lascia perdere',
  'lascia stare',
  'basta',
  'stop',
  'ricomincia',
  'non voglio più',
  'non voglio piu',
  'ferma',
  'dimentica',
  'abort',
];

export function detectCancelCreationIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();
  return CANCEL_CREATION_KEYWORDS.some((kw) => lowerMessage.includes(kw));
}

// ============================================
// DELEGATION INTENT DETECTION ("per conto di")
// ============================================

/**
 * Pattern per rilevare delegazione: il reseller vuole operare
 * per conto di un sub-client. Scope: solo messaggio corrente (stateless).
 */
const DELEGATION_PATTERNS = [
  /per\s+conto\s+di\s+(.+?)(?:\s*[,.:;!?]|\s+(?:crea|fai|spedisci|prenota|manda|invia|voglio|vorrei|devo|calcola|quanto))/i,
  /per\s+conto\s+di\s+(.+)/i,
  /per\s+il\s+cliente\s+(.+?)(?:\s*[,.:;!?]|\s+(?:crea|fai|spedisci|prenota|manda|invia|voglio|vorrei|devo|calcola|quanto))/i,
  /per\s+il\s+cliente\s+(.+)/i,
  /a\s+nome\s+di\s+(.+?)(?:\s*[,.:;!?]|\s+(?:crea|fai|spedisci|prenota|manda|invia|voglio|vorrei|devo|calcola|quanto))/i,
  /a\s+nome\s+di\s+(.+)/i,
  /workspace\s+di\s+(.+?)(?:\s*[,.:;!?]|\s+(?:crea|fai|spedisci|prenota|manda|invia|voglio|vorrei|devo|calcola|quanto))/i,
  /workspace\s+di\s+(.+)/i,
];

/**
 * Rileva se il messaggio contiene un intento di delegazione.
 * Il reseller vuole operare per conto di un sub-client.
 */
export function detectDelegationIntent(message: string): boolean {
  if (!message?.trim()) return false;
  return DELEGATION_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Estrae il nome del target della delegazione dal messaggio.
 * Ritorna il nome del sub-client o null se non trovato.
 */
export function extractDelegationTarget(message: string): string | null {
  if (!message?.trim()) return null;

  for (const pattern of DELEGATION_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      // Pulisci il nome: rimuovi spazi extra, punteggiatura trailing
      return (
        match[1]
          .trim()
          .replace(/[,.:;!?]+$/, '')
          .trim() || null
      );
    }
  }

  return null;
}
