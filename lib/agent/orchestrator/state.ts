import { BaseMessage } from '@langchain/core/messages';
import { Shipment, CourierServiceType, RecipientType } from '@/types/shipments';
import { PricingResult } from '@/lib/ai/pricing-engine';
import { ShipmentDraft } from '@/lib/address/shipment-draft';
import { BookingResult } from '@/lib/agent/workers/booking';
import { UserRole } from '@/lib/rbac';
import { ActingContext } from '@/lib/safe-auth';

export interface AgentState {
  // Messaggi della conversazione (per debugging e chat history)
  messages: BaseMessage[];

  // Contesto Utente
  userId: string;
  userEmail: string;
  
  // ID della spedizione (se esiste già nel DB/Supabase)
  shipmentId?: string;
  
  // @deprecated Usa shipment_details per preventivi. Mantenuto per compatibilità OCR.
  shipmentData: Partial<Shipment>;
  
  // Metadati di processo
  processingStatus: 'idle' | 'extracting' | 'validating' | 'calculating' | 'error' | 'complete';
  validationErrors: string[];
  confidenceScore: number; // 0-100 (derivato da OCR e validazione)
  
  // Flag per intervento umano
  needsHumanReview: boolean;
  
  // Dati temporanei per il calcolo
  selectedCourier?: {
    id: string;
    name: string;
    serviceType: CourierServiceType;
    price: number;
    reliabilityScore: number;
    reason: string;
  };

  // ===== NUOVI CAMPI PER PREVENTIVI (Fase 1) =====
  
  // Dati per preventivo (estratti dal messaggio utente)
  shipment_details?: {
    weight?: number;
    destinationZip?: string;
    destinationProvince?: string;
    serviceType?: 'standard' | 'express' | 'economy';
    cashOnDelivery?: number;
    declaredValue?: number;
    insurance?: boolean;
  };
  
  // Risultati del calcolo preventivo
  pricing_options?: PricingResult[];
  
  // Prossimo step da eseguire (deciso dal supervisor)
  // 'pricing_worker' = calcola preventivo con pricing graph
  // 'address_worker' = normalizza indirizzi e raccoglie dati mancanti (Sprint 2.3)
  // 'ocr_worker' = estrai dati da immagine/testo OCR (Sprint 2.4)
  // 'booking_worker' = prenota spedizione dopo conferma utente (Sprint 2.6)
  // 'mentor_worker' = risponde a domande tecniche con RAG su documentazione (P1)
  // 'debug_worker' = analizza errori e suggerisce fix (P2)
  // 'explain_worker' = spiega business flows (wallet, spedizioni, margini) (P2)
  // 'legacy' = usa handler Claude legacy (non-pricing o fallback)
  // 'END' = risposta pronta, termina
  next_step?: 'pricing_worker' | 'address_worker' | 'ocr_worker' | 'booking_worker' | 'mentor_worker' | 'debug_worker' | 'explain_worker' | 'legacy' | 'END';
  
  // Messaggio di chiarimento (se servono più dati)
  clarification_request?: string;
  
  // Contatore iterazioni per prevenire loop infiniti
  iteration_count?: number;
  
  // ===== SPRINT 2.3: SHIPMENT DRAFT =====
  
  /**
   * Bozza spedizione con dati normalizzati.
   * Usato da address_worker per raccogliere dati progressivamente.
   * Contiene missingFields per sapere cosa manca.
   */
  shipmentDraft?: ShipmentDraft;
  
  // ===== SPRINT 2.6: BOOKING =====
  
  /**
   * Risultato della prenotazione.
   * Popolato da booking_worker dopo tentativo di prenotazione.
   */
  booking_result?: BookingResult;
  
  // ===== P4 TASK 2: AUTO-PROCEED =====
  
  /**
   * Flag per auto-proceed (P4 Task 2).
   * Impostato dal supervisor quando confidence > soglia e nessun errore.
   * ⚠️ CRITICO: Auto-proceed SOLO per operazioni sicure (pricing), MAI per booking/wallet/LDV.
   */
  autoProceed?: boolean;
  
  /**
   * Flag per suggerimento procedura (P4 Task 2).
   * Impostato dal supervisor quando confidence > soglia suggerimento ma < auto-proceed.
   */
  suggestProceed?: boolean;
  
  // ===== AI AGENT CONTEXT (P1 Prerequisites) =====
  
  /**
   * Contesto AI Agent per conversazioni multi-turn e mentor.
   * Popolato da supervisor-router con ActingContext.
   */
  agent_context?: {
    session_id: string;
    conversation_history: BaseMessage[];
    user_role: UserRole;
    current_page?: string;
    is_impersonating: boolean;
    acting_context?: ActingContext; // Iniettato da supervisor-router
  };
  
  /**
   * Risposta del mentor worker (Q&A tecnico).
   * Popolato da mentor_worker quando l'utente chiede spiegazioni tecniche.
   */
  mentor_response?: {
    answer: string;
    sources: string[]; // File paths referenziati (es. docs/MONEY_FLOWS.md)
    confidence: number; // 0-100
  };

  /**
   * Risposta del debug worker (analisi errori e troubleshooting).
   * Popolato da debug_worker quando l'utente chiede aiuto per errori o problemi.
   */
  debug_response?: {
    analysis: string;
    suggestions: string[];
    links: string[]; // File paths referenziati per documentazione
  };

  /**
   * Risposta del explain worker (spiegazione business flows).
   * Popolato da explain_worker quando l'utente chiede spiegazioni su wallet, spedizioni, margini.
   */
  explain_response?: {
    explanation: string;
    diagram: string; // Diagramma testuale del flusso
  };
}
