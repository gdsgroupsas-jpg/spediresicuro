import { BaseMessage } from '@langchain/core/messages';
import { Shipment, CourierServiceType, RecipientType } from '@/types/shipments';
import { PricingResult } from '@/lib/ai/pricing-engine';

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
  next_step?: 'pricing_worker' | 'request_clarification' | 'END';
  
  // Messaggio di chiarimento (se servono più dati)
  clarification_request?: string;
  
  // Contatore iterazioni per prevenire loop infiniti
  iteration_count?: number;
}
