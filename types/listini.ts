/**
 * Types: Price Lists (Listini)
 *
 * Sistema avanzato di gestione listini prezzi con regole complesse,
 * gerarchia multi-utente, versionamento e supporto multi-formato.
 */

import type { CourierServiceType } from "./shipments";

export type PriceListStatus = "draft" | "active" | "archived";
export type PriceListPriority = "global" | "partner" | "client" | "default";
export type { CourierServiceType };

/**
 * Regola di calcolo prezzi avanzata
 *
 * Ogni regola definisce come calcolare il prezzo in base a:
 * - Fascia di peso/volume
 * - Area geografica (zone, CAP, province, regioni)
 * - Corriere applicabile
 * - Margine (percentuale o fisso)
 * - Sovrapprezzi (carburante, assicurazione, ecc.)
 * - Priorità (per matching multipli)
 */
export interface PriceRule {
  id?: string; // ID univoco della regola (generato se non fornito)

  // Identificazione
  name?: string; // Nome descrittivo della regola
  description?: string; // Descrizione opzionale

  // Condizioni di applicabilità
  weight_from?: number; // Peso minimo (kg)
  weight_to?: number; // Peso massimo (kg)
  volume_from?: number; // Volume minimo (m³)
  volume_to?: number; // Volume massimo (m³)

  // Area geografica
  zone_codes?: string[]; // Codici zona (es. ["Z1", "Z2", "ISOLE"])
  zip_code_from?: string; // CAP minimo
  zip_code_to?: string; // CAP massimo
  province_codes?: string[]; // Sigle province (es. ["MI", "RM"])
  regions?: string[]; // Nomi regioni (es. ["Lombardia", "Lazio"])
  countries?: string[]; // Codici paese ISO (es. ["IT", "FR"])

  // Corriere e servizio
  courier_ids?: string[]; // ID corrieri applicabili (vuoto = tutti)
  service_types?: CourierServiceType[]; // Tipi servizio (vuoto = tutti)

  // Calcolo prezzo
  margin_type: "percent" | "fixed" | "none"; // Tipo margine
  margin_value?: number; // Valore margine (percentuale o fisso in €)
  base_price_override?: number; // Prezzo base fisso (sovrascrive calcolo)

  // Sovrapprezzi
  fuel_surcharge_percent?: number; // Supplemento carburante (%)
  insurance_rate_percent?: number; // Tasso assicurazione (%)
  cash_on_delivery_fee?: number; // Commissione contrassegno (€)
  island_surcharge?: number; // Supplemento isole (€)
  ztl_surcharge?: number; // Supplemento ZTL (€)
  express_surcharge?: number; // Supplemento express (€)

  // Priorità e matching
  priority: number; // Priorità regola (maggiore = applicata per prima, default: 0)
  is_active: boolean; // Se false, regola ignorata

  // Validità temporale
  valid_from?: string; // Data inizio validità (ISO string)
  valid_until?: string; // Data fine validità (ISO string)

  // Metadati
  metadata?: Record<string, any>; // Dati aggiuntivi personalizzati
}

/**
 * Listino prezzi completo con sistema di regole avanzato
 */
export interface PriceList {
  id: string;
  courier_id?: string; // Opzionale: se null, listino multi-corriere
  courier?: any;

  name: string;
  version: string;
  status: PriceListStatus;

  // Gerarchia e priorità
  priority: PriceListPriority; // 'global' | 'partner' | 'client' | 'default'
  is_global: boolean; // Se true, listino globale (admin)
  assigned_to_user_id?: string; // Se specificato, listino personalizzato per utente
  list_type?: "supplier" | "custom" | "global"; // Tipo listino: supplier (fornitore), custom (personalizzato), global (globale)

  // Tracciabilità derivazione (master/clone)
  master_list_id?: string; // ID listino master da cui questo deriva (null = listino originale)

  // Versionamento
  valid_from?: string;
  valid_until?: string;
  parent_version_id?: string; // ID versione precedente (per storico)

  // Sistema regole avanzato
  rules?: PriceRule[]; // Array di regole di calcolo (JSONB nel DB)
  default_margin_percent?: number; // Margine di default se nessuna regola matcha
  default_margin_fixed?: number; // Margine fisso di default

  // Sorgente dati
  source_type?: "csv" | "excel" | "pdf" | "manual" | "api" | "ocr";
  source_file_url?: string;
  source_file_name?: string;
  source_metadata?: Record<string, any>; // Metadati file sorgente
  metadata?: Record<string, any>; // Metadati aggiuntivi (alias per source_metadata in alcuni contesti)

  // Note e descrizione
  description?: string;
  notes?: string;

  // Compatibilità con sistema legacy
  entries?: PriceListEntry[]; // Righe listino legacy (per retrocompatibilità)

  // Audit
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;

  // Statistiche
  usage_count?: number; // Numero di volte utilizzato
  last_used_at?: string; // Ultima volta utilizzato
}

export interface PriceListEntry {
  id: string;
  price_list_id: string;

  weight_from: number;
  weight_to: number;

  zone_code?: string;
  zip_code_from?: string;
  zip_code_to?: string;
  province_code?: string;
  region?: string;

  service_type: CourierServiceType;

  base_price: number;

  fuel_surcharge_percent?: number;
  island_surcharge?: number;
  ztl_surcharge?: number;
  cash_on_delivery_surcharge?: number;
  insurance_rate_percent?: number;

  estimated_delivery_days_min?: number;
  estimated_delivery_days_max?: number;

  created_at: string;
}

export interface CreatePriceListInput {
  courier_id?: string | null; // Opzionale per listini multi-corriere o quando tabella couriers non disponibile
  name: string;
  version: string;
  status?: PriceListStatus;
  priority?: PriceListPriority;
  is_global?: boolean;
  assigned_to_user_id?: string;
  list_type?: "supplier" | "custom" | "global"; // Tipo listino: supplier (fornitore), custom (personalizzato), global (globale)
  valid_from?: string;
  valid_until?: string;
  rules?: PriceRule[]; // Regole avanzate
  default_margin_percent?: number;
  default_margin_fixed?: number;
  source_type?: "csv" | "excel" | "pdf" | "manual" | "api" | "ocr";
  source_file_url?: string;
  source_file_name?: string;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Input per aggiornamento listino
 */
export interface UpdatePriceListInput {
  name?: string;
  version?: string;
  status?: PriceListStatus;
  priority?: PriceListPriority;
  list_type?: "supplier" | "custom" | "global"; // Tipo listino: supplier (fornitore), custom (personalizzato), global (globale)
  valid_from?: string;
  valid_until?: string;
  rules?: PriceRule[];
  default_margin_percent?: number;
  default_margin_fixed?: number;
  description?: string;
  notes?: string;
  metadata?: Record<string, any>;
}

/**
 * Risultato calcolo prezzo con dettagli regola applicata
 */
export interface PriceCalculationResult {
  basePrice: number;
  surcharges: number;
  margin: number;
  totalCost: number;
  finalPrice: number; // Prezzo finale con margine applicato
  supplierPrice?: number; // ✨ Costo fornitore originale (se listino personalizzato con master_list_id)
  appliedRule?: PriceRule; // Regola applicata
  appliedPriceList?: PriceList; // Listino utilizzato
  priceListId: string; // ID listino per audit
  _courierConfigId?: string; // ID configurazione API corriere (per tracciamento)
  calculationDetails: {
    weight: number;
    volume?: number;
    destination: {
      zip?: string;
      province?: string;
      region?: string;
      country?: string;
    };
    courierId?: string;
    serviceType?: CourierServiceType;
    options?: {
      declaredValue?: number;
      cashOnDelivery?: boolean;
      insurance?: boolean;
    };
  };
  auditTrail?: {
    matchedRules: PriceRule[]; // Tutte le regole che matchano
    selectedRule: PriceRule; // Regola selezionata (priorità più alta)
    selectionReason: string; // Motivo selezione
  };
}

export interface ParsedPriceListRow {
  weight_from: number;
  weight_to: number;
  zone_code?: string;
  service_type?: CourierServiceType;
  base_price: number;
  fuel_surcharge_percent?: number;
  [key: string]: any;
}

/**
 * Assegnazione listino a utente (tabella N:N)
 */
export interface PriceListAssignment {
  id: string;
  price_list_id: string;
  user_id: string;
  assigned_by: string;
  assigned_at: string;
  revoked_at?: string;
  revoked_by?: string;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Campi join opzionali
  price_list?: PriceList;
  user?: {
    id: string;
    email: string;
    name?: string;
    account_type?: string;
  };
  assigner?: {
    id: string;
    email: string;
  };
}

/**
 * Input per clonazione listino
 */
export interface ClonePriceListInput {
  source_price_list_id: string;
  name: string;
  target_user_id?: string;
  overrides?: {
    valid_from?: string;
    valid_until?: string;
    default_margin_percent?: number;
    default_margin_fixed?: number;
    description?: string;
    notes?: string;
  };
}

/**
 * Input per assegnazione listino
 */
export interface AssignPriceListInput {
  price_list_id: string;
  user_id: string;
  notes?: string;
}
