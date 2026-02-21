/**
 * Configurazione centralizzata per l'agent orchestrator e workers.
 *
 * Tutte le costanti magiche sono qui per facilitare:
 * - Testing (override facile)
 * - Tuning (cambiare valori senza toccare logica)
 * - Documentazione (valori in un unico posto)
 */

/**
 * Configurazione per i grafi LangGraph
 */
export const graphConfig = {
  /**
   * Limite massimo di iterazioni per il pricing graph.
   * Previene loop infiniti nel grafo di preventivi.
   */
  MAX_ITERATIONS: 2,

  /**
   * Limite di ricorsione per il logistics graph (legacy).
   * Previene loop infiniti nel grafo di logistica.
   */
  RECURSION_LIMIT: 5,

  /**
   * Soglia minima di confidence score per procedere senza review umana.
   * Valore: 0-100. Se confidenceScore < MIN_CONFIDENCE, va a human_review.
   */
  MIN_CONFIDENCE: 80,
} as const;

/**
 * Configurazione per i modelli LLM
 */
export const llmConfig = {
  /**
   * Modello Gemini da usare per tutti i worker
   */
  MODEL: 'gemini-2.0-flash-001',

  /**
   * Temperature per il supervisor (bassa = più deterministico)
   */
  SUPERVISOR_TEMPERATURE: 0.1,

  /**
   * Max output tokens per il supervisor
   */
  SUPERVISOR_MAX_OUTPUT_TOKENS: 512,

  /**
   * Max output tokens per l'intent detector
   */
  INTENT_DETECTOR_MAX_OUTPUT_TOKENS: 256,

  /**
   * Max output tokens per i nodi di estrazione dati
   */
  EXTRACT_DATA_MAX_OUTPUT_TOKENS: 2048,
} as const;

/**
 * Configurazione per il booking worker
 */
export const bookingConfig = {
  /**
   * Tempo di attesa prima di riprovare un booking fallito (in millisecondi).
   * Usato quando lo status è 'retryable'.
   */
  RETRY_AFTER_MS: 30000, // 30 secondi
} as const;

/**
 * Feature Flags per migrazione graduale
 */
export const featureFlags = {
  /**
   * FINANCE_STRICT_MARGIN: Abilita calcolo margine strict (no fallback hardcoded)
   *
   * - true: Usa computeMargin() da lib/financial, margin=null se dati mancanti
   * - false: Legacy mode con fallback a DEFAULT_MARGIN_PERCENT (warning in console)
   *
   * Default: false (per migrazione graduale)
   * Target: true entro prossima major release
   *
   * @see lib/financial/margin-calculator.ts
   */
  FINANCE_STRICT_MARGIN: process.env.FINANCE_STRICT_MARGIN === 'true',
} as const;

/**
 * Configurazione per i margini di ricarico
 */
export const pricingConfig = {
  /**
   * @deprecated Usa computeMargin() da lib/financial invece.
   * Questa costante sarà rimossa quando FINANCE_STRICT_MARGIN=true diventa default.
   *
   * Margine percentuale di default per il calcolo prezzi.
   * Il margine PARTE DA 0 ed è PERSONALIZZABILE per ogni reseller/utente.
   *
   * ⚠️ NON USARE DIRETTAMENTE - controllare sempre featureFlags.FINANCE_STRICT_MARGIN
   */
  DEFAULT_MARGIN_PERCENT: 0,

  /**
   * Soglia minima di reliability score per considerare un corriere affidabile.
   * Valore: 0-100. Corrieri con score >= MIN_RELIABILITY sono considerati affidabili.
   */
  MIN_RELIABILITY_SCORE: 80,
} as const;

/**
 * Configurazione per OCR Vision (Sprint 2.5)
 */
export const ocrConfig = {
  /**
   * Feature flag per abilitare OCR immagini via Gemini Vision.
   * Default: false (opt-in). Impostare ENABLE_OCR_IMAGES=true per attivare.
   */
  ENABLE_OCR_IMAGES: process.env.ENABLE_OCR_IMAGES === 'true',

  /**
   * Soglia minima di confidence per accettare dati estratti da immagine.
   * Valore: 0-1 (es. 0.7 = 70%). Se confidence < soglia, chiede conferma.
   * Configurabile via OCR_MIN_CONFIDENCE (default: 0.7 - conservativo).
   */
  MIN_VISION_CONFIDENCE: parseFloat(process.env.OCR_MIN_CONFIDENCE || '0.7'),

  /**
   * Timeout in ms per chiamata Gemini Vision.
   * Default: 30 secondi.
   */
  VISION_TIMEOUT_MS: parseInt(process.env.OCR_VISION_TIMEOUT_MS || '30000', 10),
} as const;

/**
 * Configurazione per dimensioni default dei pacchi (quando non specificate)
 */
export const parcelDefaults = {
  /**
   * Lunghezza default in cm
   */
  DEFAULT_LENGTH_CM: 20,

  /**
   * Larghezza default in cm
   */
  DEFAULT_WIDTH_CM: 15,

  /**
   * Altezza default in cm
   */
  DEFAULT_HEIGHT_CM: 10,
} as const;

/**
 * Configurazione per Auto-Proceed (P4 Task 2)
 */
export const autoProceedConfig = {
  /**
   * Soglia di confidence per auto-proceed completo (senza chiedere conferma).
   * Valore: 0-100. Se confidenceScore >= AUTO_PROCEED_THRESHOLD e validationErrors.length === 0,
   * procede automaticamente (solo per operazioni sicure: pricing, address normalization).
   *
   * ⚠️ CRITICO: Auto-proceed NON si applica mai a:
   * - booking_worker (creazione LDV/spedizione)
   * - Operazioni wallet (ricarica, addebito, svincolo giacenza)
   * - Qualsiasi operazione finanziaria
   */
  AUTO_PROCEED_CONFIDENCE_THRESHOLD: parseInt(
    process.env.AUTO_PROCEED_CONFIDENCE_THRESHOLD || '85',
    10
  ),

  /**
   * Soglia di confidence per suggerire procedura (1 click invece di form completo).
   * Valore: 0-100. Se confidenceScore >= SUGGEST_PROCEED_THRESHOLD ma < AUTO_PROCEED_THRESHOLD,
   * mostra suggerimento "Dati quasi completi, procedi?".
   */
  SUGGEST_PROCEED_CONFIDENCE_THRESHOLD: parseInt(
    process.env.SUGGEST_PROCEED_CONFIDENCE_THRESHOLD || '70',
    10
  ),

  /**
   * Finestra di annullamento per auto-proceed (in millisecondi).
   * L'utente può annullare l'auto-proceed entro questo tempo.
   */
  CANCELLATION_WINDOW_MS: parseInt(process.env.AUTO_PROCEED_CANCELLATION_WINDOW_MS || '5000', 10),
} as const;

/**
 * Export di tutte le configurazioni per facilità di import
 */
export const agentConfig = {
  graph: graphConfig,
  llm: llmConfig,
  booking: bookingConfig,
  pricing: pricingConfig,
  parcel: parcelDefaults,
  ocr: ocrConfig,
  autoProceed: autoProceedConfig,
} as const;
