/**
 * Modulo Telemetria Strutturata - Anne V2
 *
 * Log strutturati per pricing graph con trace_id.
 * ⚠️ NO PII nei log (no email, no nomi, no indirizzi)
 */

import crypto from 'crypto';

// ====== TIPI ======
export interface TelemetryEvent {
  event: string;
  trace_id: string;
  timestamp: string;
  user_id_hash?: string; // Hash dell'userId, non l'id originale
  [key: string]: unknown;
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// ====== UTILITY ======

/**
 * Genera un trace_id univoco per tracciare una richiesta
 * Formato: ann-{timestamp}-{random}
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `ann-${timestamp}-${random}`;
}

/**
 * Hash dell'userId per log (no PII)
 * Usa SHA256 troncato a 12 caratteri
 */
function hashUserId(userId: string): string {
  return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 12);
}

/**
 * Formatta un evento di telemetria come JSON strutturato
 */
function formatEvent(event: TelemetryEvent): string {
  return JSON.stringify(event);
}

/**
 * Log strutturato generico
 */
function logStructured(level: LogLevel, event: TelemetryEvent): void {
  const formattedEvent = formatEvent(event);

  switch (level) {
    case 'error':
      console.error(`[TELEMETRY] ${formattedEvent}`);
      break;
    case 'warn':
      console.warn(`[TELEMETRY] ${formattedEvent}`);
      break;
    case 'debug':
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[TELEMETRY] ${formattedEvent}`);
      }
      break;
    case 'info':
    default:
      console.log(`[TELEMETRY] ${formattedEvent}`);
  }
}

// ====== EVENTI SPECIFICI ======

/**
 * Log: Intent Detection
 * Evento quando l'intent detector classifica un messaggio
 */
export function logIntentDetected(
  traceId: string,
  userId: string,
  isPricingIntent: boolean,
  confidence?: number
): void {
  logStructured('info', {
    event: 'intentDetected',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    is_pricing_intent: isPricingIntent,
    confidence: confidence ?? null,
  });
}

/**
 * Log: Using Pricing Graph
 * Evento quando il pricing graph viene invocato
 */
export function logUsingPricingGraph(
  traceId: string,
  userId: string,
  executionTimeMs: number,
  optionsCount: number
): void {
  logStructured('info', {
    event: 'usingPricingGraph',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    execution_time_ms: executionTimeMs,
    pricing_options_count: optionsCount,
  });
}

/**
 * Log: Graph Failed
 * Evento quando il pricing graph fallisce
 */
export function logGraphFailed(traceId: string, error: Error | unknown, userId: string): void {
  // Estrai messaggio errore in modo sicuro (no stack trace in prod)
  let errorMessage = 'Unknown error';
  let errorType = 'unknown';

  if (error instanceof Error) {
    errorMessage = error.message;
    errorType = error.name;
  } else if (typeof error === 'string') {
    errorMessage = error;
    errorType = 'string_error';
  }

  logStructured('error', {
    event: 'graphFailed',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    error_message: errorMessage,
    error_type: errorType,
    // NO stack trace in prod (potrebbe contenere path con PII)
    stack_trace:
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.stack
          : undefined
        : undefined,
  });
}

/**
 * Log: Fallback to Legacy
 * Evento quando si passa al codice legacy
 */
export function logFallbackToLegacy(
  traceId: string,
  userId: string,
  reason: 'graph_failed' | 'no_pricing_intent' | 'intent_error' | 'disabled'
): void {
  logStructured('warn', {
    event: 'fallbackToLegacy',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    fallback_reason: reason,
  });
}

/**
 * Log: Pricing Worker Executed
 * Evento quando il pricing worker completa
 */
export function logPricingWorkerExecuted(
  traceId: string,
  userId: string,
  optionsFound: number,
  executionTimeMs: number,
  hasClarification: boolean
): void {
  logStructured('info', {
    event: 'pricingWorkerExecuted',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    options_found: optionsFound,
    execution_time_ms: executionTimeMs,
    has_clarification: hasClarification,
  });
}

/**
 * Log: Supervisor Decision
 * Evento quando il supervisor prende una decisione di routing
 */
export function logSupervisorDecision(
  traceId: string,
  userId: string,
  nextStep: string,
  iterationCount: number
): void {
  logStructured('info', {
    event: 'supervisorDecision',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    next_step: nextStep,
    iteration_count: iterationCount,
  });
}

/**
 * Log: Request Completed
 * Evento finale quando la richiesta è completata
 */
export function logRequestCompleted(
  traceId: string,
  userId: string,
  totalTimeMs: number,
  usedGraph: boolean,
  success: boolean
): void {
  logStructured('info', {
    event: 'requestCompleted',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    total_time_ms: totalTimeMs,
    used_graph: usedGraph,
    success,
  });
}

// ====== TIPI TELEMETRIA STEP 2.2 + 2.3 ======

export type IntentType = 'pricing' | 'non_pricing' | 'unknown';
export type BackendUsed = 'pricing_graph' | 'legacy';
export type FallbackReason =
  | 'graph_error'
  | 'non_pricing'
  | 'unknown_intent'
  | 'intent_error'
  | 'address_unparsable'
  | null;
export type WorkerRun = 'address' | 'pricing' | 'ocr' | 'booking' | null;
export type OcrSource = 'image' | 'text' | null;

export interface SupervisorRouterTelemetry {
  intentDetected: IntentType;
  supervisorDecision:
    | 'pricing_worker'
    | 'address_worker'
    | 'ocr_worker'
    | 'booking_worker'
    | 'legacy'
    | 'end';
  backendUsed: BackendUsed;
  fallbackToLegacy: boolean;
  fallbackReason: FallbackReason;
  duration_ms: number;
  pricingOptionsCount?: number;
  hasClarification?: boolean;
  success: boolean;

  // Sprint 2.3: Address Worker telemetry
  workerRun?: WorkerRun;
  missingFieldsCount?: number;
  addressNormalized?: boolean;

  // Sprint 2.4: OCR Worker telemetry
  ocrSource?: OcrSource;
  ocrExtractedFieldsCount?: number;

  // Sprint 2.6: Booking Worker telemetry
  bookingStatus?: 'success' | 'failed' | 'retryable' | null;
}

/**
 * Log: Supervisor Router Complete (EVENTO FINALE UNIFICATO)
 *
 * Emesso SEMPRE 1 volta per richiesta, anche in caso di errore.
 * Contiene tutti i campi per tracciare il flusso decisionale.
 *
 * ⚠️ NO PII: userId è hashato, no payload utente
 */
export function logSupervisorRouterComplete(
  traceId: string,
  userId: string,
  telemetry: SupervisorRouterTelemetry
): void {
  logStructured('info', {
    event: 'supervisorRouterComplete',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    intent_detected: telemetry.intentDetected,
    supervisor_decision: telemetry.supervisorDecision,
    backend_used: telemetry.backendUsed,
    fallback_to_legacy: telemetry.fallbackToLegacy,
    fallback_reason: telemetry.fallbackReason,
    duration_ms: telemetry.duration_ms,
    pricing_options_count: telemetry.pricingOptionsCount ?? 0,
    has_clarification: telemetry.hasClarification ?? false,
    success: telemetry.success,
    // Sprint 2.3: Address Worker telemetry
    worker_run: telemetry.workerRun ?? null,
    missing_fields_count: telemetry.missingFieldsCount ?? 0,
    address_normalized: telemetry.addressNormalized ?? false,
    // Sprint 2.4: OCR Worker telemetry
    ocr_source: telemetry.ocrSource ?? null,
    ocr_extracted_fields_count: telemetry.ocrExtractedFieldsCount ?? 0,
  });
}

// ====== EVENTI BOOKING (Sprint 2.6) ======

/**
 * Log: Booking Attempt
 * Evento quando si tenta una prenotazione
 */
export function logBookingAttempt(traceId: string, userId: string, carrier: string): void {
  logStructured('info', {
    event: 'bookingAttempt',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    carrier,
  });
}

/**
 * Log: Booking Success
 * Evento quando la prenotazione ha successo
 */
export function logBookingSuccess(
  traceId: string,
  userId: string,
  carrier: string,
  shipmentId: string,
  durationMs: number
): void {
  logStructured('info', {
    event: 'bookingSuccess',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    carrier,
    shipment_id: shipmentId,
    duration_ms: durationMs,
  });
}

/**
 * Log: Booking Failed
 * Evento quando la prenotazione fallisce
 */
export function logBookingFailed(
  traceId: string,
  userId: string,
  failureReason: string,
  durationMs: number
): void {
  logStructured('warn', {
    event: 'bookingFailed',
    trace_id: traceId,
    timestamp: new Date().toISOString(),
    user_id_hash: hashUserId(userId),
    failure_reason: failureReason,
    duration_ms: durationMs,
  });
}

// ====== EXPORT AGGREGATO ======
export const telemetry = {
  generateTraceId,
  logIntentDetected,
  logUsingPricingGraph,
  logGraphFailed,
  logFallbackToLegacy,
  logPricingWorkerExecuted,
  logSupervisorDecision,
  logRequestCompleted,
  logSupervisorRouterComplete,
  // Sprint 2.6: Booking
  logBookingAttempt,
  logBookingSuccess,
  logBookingFailed,
};

export default telemetry;
