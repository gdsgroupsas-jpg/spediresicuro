/**
 * Modulo LLM per estrazione dati spedizione e generazione clarification conversazionali.
 *
 * Usa DeepSeek (via createGraphLLM) per:
 * 1. Estrarre dati strutturati dal messaggio utente
 * 2. Generare domande conversazionali naturali (non template rigidi)
 *
 * Ritorna null se LLM non disponibile — il caller usa fallback deterministico (processAddressCore).
 */
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { ShipmentDraft } from '@/lib/address/shipment-draft';
import { llmConfig } from '@/lib/config';
import { createGraphLLM } from '../llm-factory';
import { defaultLogger, type ILogger } from '../logger';

// ==================== TYPES ====================

/** Risultato estrazione LLM */
export interface LLMExtractionResult {
  /** Dati estratti dal messaggio */
  extractedData: Partial<ShipmentDraft>;
  /** Domanda conversazionale per campi mancanti (null se dati completi) */
  conversationalQuestion: string | null;
  /** Confidence 0-100 sull'accuratezza dell'estrazione */
  confidence: number;
}

// ==================== PROMPT ====================

const SYSTEM_PROMPT = `Sei Anne, assistente logistica di SpedireSicuro.it.
Il tuo compito e aiutare l'utente a creare una spedizione estraendo i dati dal suo messaggio.

REGOLE:
1. Estrai TUTTI i dati presenti nel messaggio (nome, indirizzo, citta, CAP, provincia, peso)
2. Se mancano dati, genera UNA domanda naturale e conversazionale per chiederli
3. Sii concisa e amichevole, usa il tu
4. Province italiane: usa sempre 2 lettere maiuscole (MI, RM, NA, TO, FI, ecc.)
5. CAP italiani: devono essere esattamente 5 cifre
6. Peso: in kg, converti se l'utente dice "chili" o altre unita
7. NON inventare dati che non sono nel messaggio
8. Se l'utente dice "al solito indirizzo" o simili senza specificare, chiedi l'indirizzo

ESEMPI di domande conversazionali BUONE:
- "Ho capito, 5kg a Mario Rossi a Milano! Mi mancano via e CAP, me li dici?"
- "Perfetto! A che indirizzo esattamente devo spedire?"
- "Ho quasi tutto! Mi manca solo il peso del pacco, quanti kg?"
- "Mario Rossi, Via Roma 1, Milano — tutto chiaro! Mi dici il CAP e la provincia?"

ESEMPI di domande CATTIVE (NON fare cosi):
- "Mi servono: **nome destinatario**, **CAP** e **provincia**."
- "Campi mancanti: recipient.postalCode, recipient.province"
- "Per procedere necessito dei seguenti dati..."

Rispondi ESCLUSIVAMENTE con un JSON valido, senza markdown, senza backtick:
{
  "extracted": {
    "fullName": string | null,
    "addressLine1": string | null,
    "city": string | null,
    "postalCode": string | null,
    "province": string | null,
    "phone": string | null,
    "weightKg": number | null
  },
  "question": string | null,
  "confidence": number
}`;

// ==================== FUNZIONE PRINCIPALE ====================

/**
 * Estrae dati e genera clarification usando LLM (DeepSeek).
 * Ritorna null se LLM non disponibile (caller usa fallback deterministico).
 */
export async function extractWithLLM(
  messageText: string,
  existingDraft?: ShipmentDraft,
  logger: ILogger = defaultLogger
): Promise<LLMExtractionResult | null> {
  const llm = createGraphLLM({
    maxOutputTokens: llmConfig.CREATION_WORKER_MAX_OUTPUT_TOKENS,
    temperature: llmConfig.CREATION_WORKER_TEMPERATURE,
    logger,
  });

  if (!llm) return null;

  const startTime = Date.now();

  try {
    // Costruisci contesto con dati gia raccolti
    const contextParts: string[] = [];
    if (existingDraft?.recipient?.fullName)
      contextParts.push(`Nome: ${existingDraft.recipient.fullName}`);
    if (existingDraft?.recipient?.addressLine1)
      contextParts.push(`Indirizzo: ${existingDraft.recipient.addressLine1}`);
    if (existingDraft?.recipient?.city) contextParts.push(`Citta: ${existingDraft.recipient.city}`);
    if (existingDraft?.recipient?.postalCode)
      contextParts.push(`CAP: ${existingDraft.recipient.postalCode}`);
    if (existingDraft?.recipient?.province)
      contextParts.push(`Provincia: ${existingDraft.recipient.province}`);
    if (existingDraft?.parcel?.weightKg)
      contextParts.push(`Peso: ${existingDraft.parcel.weightKg} kg`);

    const contextMsg =
      contextParts.length > 0
        ? `\n\nDati gia raccolti nei messaggi precedenti:\n${contextParts.join('\n')}`
        : '';

    const userPrompt = `Messaggio utente: "${messageText}"${contextMsg}

Estrai i dati dal messaggio e, se mancano campi, formula una domanda conversazionale per chiederli.`;

    const result = await llm.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(userPrompt),
    ]);

    const jsonText = result.content
      .toString()
      .replace(/```json/g, '')
      .replace(/```\w*/g, '')
      .replace(/```/g, '')
      .trim();

    const parsed = JSON.parse(jsonText);

    // Valida e normalizza output LLM
    const extracted = parsed.extracted || {};

    const durationMs = Date.now() - startTime;
    const extractionResult: LLMExtractionResult = {
      extractedData: {
        recipient: {
          country: 'IT' as const,
          fullName: extracted.fullName || undefined,
          addressLine1: extracted.addressLine1 || undefined,
          city: extracted.city || undefined,
          postalCode: normalizePostalCode(extracted.postalCode),
          province: normalizeProvince(extracted.province),
          phone: extracted.phone || undefined,
        },
        parcel: normalizeWeight(extracted.weightKg),
      },
      conversationalQuestion: normalizeQuestion(parsed.question),
      confidence: Number(parsed.confidence) || 50,
    };

    // Telemetria strutturata: traccia successo/performance LLM
    console.log(
      `[TELEMETRY] {"event":"llm_extraction","status":"success","duration_ms":${durationMs},"confidence":${extractionResult.confidence},"has_question":${extractionResult.conversationalQuestion !== null}}`
    );

    return extractionResult;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorType = error instanceof Error ? error.name : 'Unknown';

    // Telemetria strutturata: traccia fallimento LLM
    console.log(
      `[TELEMETRY] {"event":"llm_extraction","status":"failure","duration_ms":${durationMs},"error_type":"${errorType}"}`
    );

    logger.warn('[Shipment Creation LLM] Errore estrazione, fallback a regex:', error);
    return null;
  }
}

// ==================== HELPERS ====================

/** Normalizza peso: deve essere numero positivo e finito */
function normalizeWeight(value: unknown): { weightKg: number } | undefined {
  if (!value) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return { weightKg: num };
}

/** Normalizza domanda conversazionale: tronca se troppo lunga, null se vuota */
const MAX_QUESTION_LENGTH = 500;
function normalizeQuestion(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_QUESTION_LENGTH
    ? trimmed.slice(0, MAX_QUESTION_LENGTH) + '...'
    : trimmed;
}

/** Normalizza CAP: deve essere 5 cifre */
function normalizePostalCode(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = String(value).replace(/\s/g, '').trim();
  return /^\d{5}$/.test(cleaned) ? cleaned : undefined;
}

/** Normalizza provincia: deve essere 2 lettere maiuscole */
function normalizeProvince(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = String(value).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(cleaned) ? cleaned : undefined;
}
