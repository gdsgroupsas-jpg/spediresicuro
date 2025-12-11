import { BaseMessage } from '@langchain/core/messages';
import { Shipment, CourierServiceType, RecipientType } from '@/types/shipments';

export interface AgentState {
  // Messaggi della conversazione (per debugging e chat history)
  messages: BaseMessage[];

  // Contesto Utente
  userId: string;
  userEmail: string;
  
  // ID della spedizione (se esiste già nel DB/Supabase)
  shipmentId?: string;
  
  // Dati estratti/elaborati finora - Partial perché viene costruito progressivamente
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
}
