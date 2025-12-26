/**
 * Booking Worker (Sprint 2.6)
 * 
 * Prenota una spedizione usando l'infrastruttura esistente.
 * 
 * RESPONSABILITÀ:
 * - NON decide se prenotare (decide Supervisor)
 * - NON valida indirizzi (già fatto)
 * - NON ricalcola prezzi
 * - FA SOLO:
 *   - Pre-flight check
 *   - Chiamata a adapter SpedisciOnline
 *   - Mapping output → BookingResult
 * 
 * ⚠️ VINCOLO: NON modifica la logica di booking esistente
 */

import { AgentState } from '@/lib/agent/orchestrator/state';
import { ShipmentDraft } from '@/lib/address/shipment-draft';
import { PricingResult } from '@/lib/ai/pricing-engine';
import { logBookingAttempt, logBookingSuccess, logBookingFailed } from '@/lib/telemetry/logger';
import { generateTraceId } from '@/lib/telemetry/logger';
import { defaultLogger, type ILogger } from '../logger';

// ==================== TYPES ====================

/**
 * Risultato della prenotazione
 */
export interface BookingResult {
  /** Status della prenotazione */
  status: 'success' | 'failed' | 'retryable';
  
  /** ID spedizione (se success) */
  shipment_id?: string;
  
  /** Riferimento corriere (tracking number, LDV) */
  carrier_reference?: string;
  
  /** Codice errore (se failed) */
  error_code?: BookingErrorCode;
  
  /** Messaggio user-safe (sempre presente) */
  user_message: string;
  
  /** Tempo di attesa prima di riprovare in ms (se retryable) */
  retry_after_ms?: number;
  
  /** Label PDF/ZPL (se disponibile) */
  label_data?: string;
  label_format?: 'PDF' | 'ZPL';
}

/**
 * Codici errore booking
 */
export type BookingErrorCode = 
  | 'PREFLIGHT_FAILED'      // Pre-flight check fallito
  | 'INSUFFICIENT_CREDIT'   // Credito insufficiente
  | 'CARRIER_ERROR'         // Errore dal corriere
  | 'NETWORK_ERROR'         // Errore di rete
  | 'RATE_LIMITED'          // Rate limit raggiunto
  | 'INVALID_DATA'          // Dati non validi
  | 'DUPLICATE_BOOKING'     // Booking già effettuato (idempotency)
  | 'UNKNOWN_ERROR';        // Errore sconosciuto

/**
 * Risultato del pre-flight check
 */
export interface PreflightResult {
  passed: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Input per il booking (dati completi)
 */
export interface BookingInput {
  shipmentDraft: ShipmentDraft;
  selectedPricingOption: PricingResult;
  userId: string;
  idempotencyKey: string;
}

// ==================== PRE-FLIGHT CHECKS ====================

/**
 * Verifica che i dati siano completi per procedere con il booking.
 * 
 * Check obbligatori:
 * - recipient completo (nome, via, CAP, città, provincia)
 * - parcel completo (peso)
 * - pricing_option selezionata
 * - idempotency_key presente
 */
export function preflightCheck(
  draft: ShipmentDraft | undefined,
  pricingOption: PricingResult | undefined,
  idempotencyKey: string | undefined
): PreflightResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check recipient
  if (!draft?.recipient) {
    missing.push('destinatario');
  } else {
    if (!draft.recipient.fullName) missing.push('nome destinatario');
    if (!draft.recipient.addressLine1) missing.push('indirizzo destinatario');
    if (!draft.recipient.postalCode) missing.push('CAP destinatario');
    if (!draft.recipient.city) missing.push('città destinatario');
    if (!draft.recipient.province) missing.push('provincia destinatario');
  }
  
  // Check parcel
  if (!draft?.parcel) {
    missing.push('dettagli pacco');
  } else {
    if (!draft.parcel.weightKg || draft.parcel.weightKg <= 0) {
      missing.push('peso pacco');
    }
  }
  
  // Check pricing option
  if (!pricingOption) {
    missing.push('opzione prezzo selezionata');
  }
  
  // Check idempotency key
  if (!idempotencyKey) {
    missing.push('chiave idempotenza');
  }
  
  // Optional warnings
  if (draft?.recipient && !draft.recipient.phone) {
    warnings.push('telefono destinatario non presente (consigliato)');
  }
  
  return {
    passed: missing.length === 0,
    missing,
    warnings,
  };
}

// ==================== CONFIRMATION DETECTION ====================

/**
 * Pattern per rilevare conferma esplicita di booking
 */
const BOOKING_CONFIRMATION_PATTERNS = [
  /\b(procedi|conferma|ok\s*prenota|prenota|ordina|confermare)\b/i,
  /\b(sì|si)\s*(,?\s*)?(procedi|conferma|prenota)/i,
  /\b(va\s*bene|ok|d'accordo)\s*(,?\s*)?(procedi|prenota)?/i,
  /\bprocedo\b/i,
  /\bconfermo\b/i,
];

/**
 * Rileva se il messaggio contiene una conferma esplicita di booking.
 * Usato dal Supervisor per decidere se instradare a booking_worker.
 */
export function containsBookingConfirmation(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  
  return BOOKING_CONFIRMATION_PATTERNS.some(pattern => pattern.test(text));
}

// ==================== BOOKING WORKER ====================

/**
 * Booking Worker
 * 
 * Prenota una spedizione usando l'infrastruttura esistente.
 * 
 * FLUSSO:
 * 1. Pre-flight check (dati completi?)
 * 2. Se fallisce → END + clarification_request
 * 3. Genera idempotency key se mancante
 * 4. Chiama adapter SpedisciOnline
 * 5. Mappa risultato → BookingResult
 * 6. Restituisce stato aggiornato
 * 
 * @param state - Stato corrente dell'agente
 * @returns Partial<AgentState> con booking_result e next_step
 */
export async function bookingWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  logger.log('📦 [Booking Worker] Inizio prenotazione...');
  
  const traceId = generateTraceId();
  const startTime = Date.now();
  
  try {
    // 1. Recupera pricing option selezionata
    // Per ora assumiamo la prima opzione disponibile
    // TODO: In futuro, l'utente potrà selezionare quale opzione
    const selectedOption = state.pricing_options?.[0];
    
    // Genera idempotency key se non presente
    // Usa una combinazione di userId + timestamp per unicità
    const idempotencyKey = state.shipmentId || 
      `booking-${state.userId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    
    // 2. Pre-flight check
    const preflight = preflightCheck(
      state.shipmentDraft,
      selectedOption,
      idempotencyKey
    );
    
    if (!preflight.passed) {
      logger.log('⚠️ [Booking Worker] Pre-flight fallito:', preflight.missing);
      
      const bookingResult: BookingResult = {
        status: 'failed',
        error_code: 'PREFLIGHT_FAILED',
        user_message: `Non posso procedere con la prenotazione. Mancano: ${preflight.missing.join(', ')}.`,
      };
      
      logBookingFailed(traceId, state.userId, 'PREFLIGHT_FAILED', Date.now() - startTime);
      
      return {
        booking_result: bookingResult,
        clarification_request: bookingResult.user_message,
        next_step: 'END',
        processingStatus: 'error',
      };
    }
    
    // 3. Log tentativo
    logBookingAttempt(traceId, state.userId, selectedOption?.courier || 'unknown');
    
    // 4. Prepara dati per l'adapter
    const shipmentData = mapDraftToShipmentData(
      state.shipmentDraft!,
      selectedOption!,
      state.userId,
      state.userEmail
    );
    
    // 5. Chiama adapter SpedisciOnline
    // NOTA: Usiamo import dinamico per evitare dipendenze circolari
    // e per permettere il mock nei test
    const result = await callBookingAdapter(shipmentData, idempotencyKey, logger);
    
    const durationMs = Date.now() - startTime;
    
    // 6. Mappa risultato
    if (result.status === 'success') {
      logger.log('✅ [Booking Worker] Prenotazione riuscita:', result.shipment_id);
      
      logBookingSuccess(
        traceId, 
        state.userId, 
        selectedOption?.courier || 'unknown',
        result.shipment_id || '',
        durationMs
      );
      
      return {
        booking_result: result,
        shipmentId: result.shipment_id,
        next_step: 'END',
        processingStatus: 'complete',
        clarification_request: undefined, // Clear any previous clarification
      };
    } else if (result.status === 'retryable') {
      logger.log('⚠️ [Booking Worker] Errore temporaneo, riprovare:', result.error_code);
      
      logBookingFailed(traceId, state.userId, result.error_code || 'UNKNOWN_ERROR', durationMs);
      
      return {
        booking_result: result,
        clarification_request: result.user_message,
        next_step: 'END',
        processingStatus: 'error',
      };
    } else {
      logger.log('❌ [Booking Worker] Prenotazione fallita:', result.error_code);
      
      logBookingFailed(traceId, state.userId, result.error_code || 'UNKNOWN_ERROR', durationMs);
      
      return {
        booking_result: result,
        clarification_request: result.user_message,
        next_step: 'END',
        processingStatus: 'error',
      };
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Booking Worker] Errore:', errorMessage);
    
    const durationMs = Date.now() - startTime;
    logBookingFailed(traceId, state.userId, 'UNKNOWN_ERROR', durationMs);
    
    const bookingResult: BookingResult = {
      status: 'failed',
      error_code: 'UNKNOWN_ERROR',
      user_message: `Si è verificato un errore durante la prenotazione. Riprova più tardi.`,
    };
    
    return {
      booking_result: bookingResult,
      clarification_request: bookingResult.user_message,
      next_step: 'END',
      processingStatus: 'error',
      validationErrors: [...(state.validationErrors || []), errorMessage],
    };
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Mappa ShipmentDraft + PricingOption → formato adapter
 * 
 * NOTA: Sender in ShipmentDraft ha solo name, phone, company (non addressLine1, city, etc.)
 * Per il mittente, usa dati default se non presenti.
 */
export function mapDraftToShipmentData(
  draft: ShipmentDraft,
  pricingOption: PricingResult,
  userId: string,
  userEmail: string
): Record<string, any> {
  return {
    // Destinatario (da RecipientSchema: fullName, addressLine1, city, province, postalCode, phone)
    destinatario: draft.recipient?.fullName || '',
    destinatarioIndirizzo: draft.recipient?.addressLine1 || '',
    destinatarioCitta: draft.recipient?.city || '',
    destinatarioProvincia: draft.recipient?.province || '',
    destinatarioCAP: draft.recipient?.postalCode || '',
    destinatarioTelefono: draft.recipient?.phone || '',
    
    // Mittente (da SenderSchema: name, phone, company - senza indirizzo dettagliato)
    // L'indirizzo mittente sarà preso dalla configurazione utente
    mittente: draft.sender?.name || '',
    mittenteCompany: draft.sender?.company || '',
    mittenteTelefono: draft.sender?.phone || '',
    
    // Pacco
    peso: draft.parcel?.weightKg || 1,
    lunghezza: draft.parcel?.lengthCm || 20,
    larghezza: draft.parcel?.widthCm || 15,
    altezza: draft.parcel?.heightCm || 10,
    
    // Corriere e servizio (PricingResult usa serviceType, non service)
    corriere: pricingOption.courier || '',
    courier_id: pricingOption.courier || '',
    servizio: pricingOption.serviceType || 'standard',
    
    // Prezzo (PricingResult usa finalPrice, non price)
    prezzo: pricingOption.finalPrice || 0,
    
    // Metadati
    user_id: userId,
    created_by_user_email: userEmail,
  };
}

/**
 * Chiama l'adapter di booking.
 * Questa funzione è separata per facilitare il mock nei test.
 * 
 * NOTA: ShippingLabel ha { tracking_number, label_url?, label_pdf?, metadata? }
 * Il successo è determinato dalla presenza di tracking_number (non da success boolean)
 */
async function callBookingAdapter(
  shipmentData: Record<string, any>,
  idempotencyKey: string,
  logger: ILogger = defaultLogger
): Promise<BookingResult> {
  try {
    // Import dinamico per evitare dipendenze circolari
    const { SpedisciOnlineAdapter } = await import(
      '@/lib/adapters/couriers/spedisci-online'
    );
    
    // Recupera credenziali da DB o env
    // TODO: Implementare recupero credenziali dal database per l'utente
    const credentials = await getBookingCredentials(shipmentData.user_id);
    
    if (!credentials) {
      return {
        status: 'failed',
        error_code: 'INVALID_DATA',
        user_message: 'Configurazione corriere non trovata. Configura le credenziali in Integrazioni.',
      };
    }
    
    const adapter = new SpedisciOnlineAdapter(credentials);
    
    // Verifica connessione
    const connected = await adapter.connect();
    if (!connected) {
      return {
        status: 'retryable',
        error_code: 'NETWORK_ERROR',
        user_message: 'Impossibile connettersi al servizio di spedizione. Riprova tra qualche minuto.',
        retry_after_ms: 30000,
      };
    }
    
    // Aggiungi idempotency key ai dati
    shipmentData.idempotency_key = idempotencyKey;
    
    // Crea spedizione - ShippingLabel: { tracking_number, label_url?, label_pdf?, metadata? }
    const result = await adapter.createShipment(shipmentData);
    
    // Successo = tracking_number presente
    if (result.tracking_number) {
      return {
        status: 'success',
        shipment_id: result.tracking_number, // Usiamo tracking_number come ID
        carrier_reference: result.tracking_number,
        label_data: result.label_url || undefined,
        user_message: `Spedizione prenotata con successo! Tracking: ${result.tracking_number}`,
      };
    } else {
      // Nessun tracking = errore
      return {
        status: 'failed',
        error_code: 'CARRIER_ERROR',
        user_message: 'Errore durante la creazione della spedizione. Tracking non ricevuto.',
      };
    }
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('❌ [Booking Adapter] Errore:', errorMessage);
    
    // Analizza errore per determinare se retryable
    const isRetryable = isRetryableError(errorMessage);
    
    return {
      status: isRetryable ? 'retryable' : 'failed',
      error_code: mapAdapterError(errorMessage),
      user_message: 'Errore durante la connessione al servizio di spedizione.',
      retry_after_ms: isRetryable ? 30000 : undefined,
    };
  }
}

/**
 * Recupera credenziali per il booking.
 * Per ora usa variabili d'ambiente, in futuro leggerà dal DB.
 */
async function getBookingCredentials(userId: string): Promise<any | null> {
  // TODO: Implementare recupero credenziali dal database per l'utente
  // Per ora, usa credenziali da env
  const apiKey = process.env.SPEDISCI_ONLINE_API_KEY;
  
  if (!apiKey) {
    // Usa defaultLogger qui perché questa funzione non riceve logger come parametro
    defaultLogger.warn('⚠️ [Booking] SPEDISCI_ONLINE_API_KEY non configurata');
    return null;
  }
  
  return {
    api_key: apiKey,
    base_url: process.env.SPEDISCI_ONLINE_BASE_URL || 'https://api.spedisci.online/api/v2',
    contract_mapping: {}, // TODO: Caricare da DB
  };
}

/**
 * Determina se un errore è temporaneo e può essere riprovato
 */
function isRetryableError(error?: string): boolean {
  if (!error) return false;
  
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /rate.?limit/i,
    /too.?many.?requests/i,
    /service.?unavailable/i,
    /503/i,
    /429/i,
    /connection/i,
    /temporarily/i,
  ];
  
  return retryablePatterns.some(pattern => pattern.test(error));
}

/**
 * Mappa errore adapter a BookingErrorCode
 */
function mapAdapterError(error?: string): BookingErrorCode {
  if (!error) return 'UNKNOWN_ERROR';
  
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('credit') || errorLower.includes('saldo') || errorLower.includes('wallet')) {
    return 'INSUFFICIENT_CREDIT';
  }
  if (errorLower.includes('rate') || errorLower.includes('limit') || errorLower.includes('429')) {
    return 'RATE_LIMITED';
  }
  if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('connection')) {
    return 'NETWORK_ERROR';
  }
  if (errorLower.includes('duplicate') || errorLower.includes('already') || errorLower.includes('idempotent')) {
    return 'DUPLICATE_BOOKING';
  }
  if (errorLower.includes('invalid') || errorLower.includes('validation')) {
    return 'INVALID_DATA';
  }
  if (errorLower.includes('carrier') || errorLower.includes('corriere')) {
    return 'CARRIER_ERROR';
  }
  
  return 'UNKNOWN_ERROR';
}

// Le funzioni sono già esportate con 'export' inline

