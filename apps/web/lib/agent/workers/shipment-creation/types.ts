/**
 * Tipi per la catena creazione spedizione.
 * Ogni worker restituisce present/value/missingLabel per il proprio sotto-insieme di campi.
 */

import type { ShipmentDraft } from '@/lib/address/shipment-draft';

export interface WorkerFieldResult<T = unknown> {
  present: boolean;
  value?: T;
  missingLabel?: string;
}

export interface ShipmentChainInput {
  message: string;
  existingDraft?: ShipmentDraft;
  /** Stato esistente (userId, userEmail, etc.) per pricing + booking */
  stateContext: {
    userId: string;
    userEmail: string;
    messages?: import('@langchain/core/messages').BaseMessage[];
  };
}

export interface ShipmentChainResult {
  /** Bozza aggiornata dopo i 7 worker */
  shipmentDraft: ShipmentDraft;
  /** Campi ancora mancanti (es. ['recipient.fullName', 'parcel.weightKg']) */
  missingFields: string[];
  /** Messaggio da mostrare all'utente se servono integrazioni */
  clarification_request?: string;
  /** Fase: collecting = in attesa integrazioni, ready = dati completi */
  shipment_creation_phase: 'collecting' | 'ready';
  /** Se dati completi e booking eseguito (popolato dalla chain) */
  booking_result?: unknown;
  /** AgentState da persistere (per prossimo messaggio) */
  agentState?: unknown;
}
