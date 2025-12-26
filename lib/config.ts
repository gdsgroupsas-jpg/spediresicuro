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
 * Configurazione per i margini di ricarico
 */
export const pricingConfig = {
  /**
   * Margine percentuale di default per il calcolo prezzi.
   * Applicato al prezzo base del corriere.
   */
  DEFAULT_MARGIN_PERCENT: 20,

  /**
   * Soglia minima di reliability score per considerare un corriere affidabile.
   * Valore: 0-100. Corrieri con score >= MIN_RELIABILITY sono considerati affidabili.
   */
  MIN_RELIABILITY_SCORE: 80,
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
 * Export di tutte le configurazioni per facilità di import
 */
export const agentConfig = {
  graph: graphConfig,
  llm: llmConfig,
  booking: bookingConfig,
  pricing: pricingConfig,
  parcel: parcelDefaults,
} as const;

