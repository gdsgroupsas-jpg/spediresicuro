/**
 * Types: Giacenze (Shipment Holds)
 *
 * Spedizioni bloccate presso corrieri in attesa di istruzioni.
 */

export type HoldStatus = 'open' | 'action_requested' | 'action_confirmed' | 'resolved' | 'expired';

export type HoldReason =
  | 'destinatario_assente'
  | 'indirizzo_errato'
  | 'rifiutata'
  | 'documenti_mancanti'
  | 'contrassegno_non_pagato'
  | 'zona_non_accessibile'
  | 'altro';

export type HoldActionType =
  | 'riconsegna'
  | 'riconsegna_nuovo_destinatario'
  | 'reso_mittente'
  | 'distruggere'
  | 'ritiro_in_sede'
  | 'consegna_parziale_rendi'
  | 'consegna_parziale_distruggi';

export interface ShipmentHold {
  id: string;
  shipment_id: string;
  user_id: string;
  status: HoldStatus;
  reason: HoldReason | null;
  reason_detail: string | null;
  detected_at: string;
  deadline_at: string | null;
  resolved_at: string | null;
  action_type: HoldActionType | null;
  action_cost: number | null;
  action_requested_at: string | null;
  action_confirmed_at: string | null;
  new_recipient_name: string | null;
  new_recipient_address: string | null;
  new_recipient_city: string | null;
  new_recipient_zip: string | null;
  new_recipient_province: string | null;
  new_recipient_phone: string | null;
  wallet_transaction_id: string | null;
  idempotency_key: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined from shipments
  shipment?: {
    tracking_number: string;
    recipient_name: string;
    recipient_city: string;
    recipient_address: string;
    courier_id: string;
    final_price: number;
    price_list_id: string | null;
  };
}

export interface HoldActionOption {
  action: HoldActionType;
  label: string;
  description: string;
  fixed_cost: number;
  percent_cost: number;
  dossier_cost: number;
  total_cost: number;
  requires_new_address: boolean;
}

/** Labels italiani per i motivi giacenza */
export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  destinatario_assente: 'Destinatario assente',
  indirizzo_errato: 'Indirizzo errato o incompleto',
  rifiutata: 'Spedizione rifiutata',
  documenti_mancanti: 'Documenti mancanti',
  contrassegno_non_pagato: 'Contrassegno non pagato',
  zona_non_accessibile: 'Zona non accessibile',
  altro: 'Altro',
};

/** Labels italiani per le azioni */
export const HOLD_ACTION_LABELS: Record<HoldActionType, { label: string; description: string }> = {
  riconsegna: {
    label: 'Riconsegna',
    description: 'Nuovo tentativo di consegna allo stesso indirizzo',
  },
  riconsegna_nuovo_destinatario: {
    label: 'Riconsegna a nuovo indirizzo',
    description: 'Consegna a un indirizzo diverso',
  },
  reso_mittente: {
    label: 'Reso al mittente',
    description: 'Restituzione della merce al mittente',
  },
  distruggere: {
    label: 'Distruzione',
    description: 'Il corriere distrugge la merce',
  },
  ritiro_in_sede: {
    label: 'Ritiro in sede',
    description: 'Il destinatario ritira la merce presso la filiale del corriere',
  },
  consegna_parziale_rendi: {
    label: 'Consegna parziale + reso',
    description: 'Consegna parte della merce e reso del resto',
  },
  consegna_parziale_distruggi: {
    label: 'Consegna parziale + distruzione',
    description: 'Consegna parte della merce e distruzione del resto',
  },
};

/** Labels italiani per gli stati */
export const HOLD_STATUS_LABELS: Record<HoldStatus, string> = {
  open: 'Aperta',
  action_requested: 'Azione richiesta',
  action_confirmed: 'Azione confermata',
  resolved: 'Risolta',
  expired: 'Scaduta',
};
