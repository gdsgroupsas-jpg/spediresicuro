/**
 * Intent Detector
 *
 * Rileva se il messaggio dell'utente è una richiesta di preventivo.
 * Usa pattern matching semplice + LLM opzionale per maggiore accuratezza.
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
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
  const llm = getLLM();

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

/**
 * Helper per ottenere LLM
 */
import { llmConfig } from '@/lib/config';

function getLLM() {
  if (!process.env.GOOGLE_API_KEY) {
    return null;
  }
  return new ChatGoogleGenerativeAI({
    model: llmConfig.MODEL,
    maxOutputTokens: llmConfig.INTENT_DETECTOR_MAX_OUTPUT_TOKENS,
    temperature: llmConfig.SUPERVISOR_TEMPERATURE,
    apiKey: process.env.GOOGLE_API_KEY,
  });
}

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
