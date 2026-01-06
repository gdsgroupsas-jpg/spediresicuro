/**
 * Types: Supplier Price List Config
 * 
 * Configurazioni manuali per sezioni listini fornitore non disponibili via API:
 * - Assicurazione
 * - Contrassegni
 * - Servizi accessori
 * - Giacenze
 * - Ritiro
 * - Extra
 */

/**
 * Configurazione Assicurazione
 */
export interface InsuranceConfig {
  max_value: number; // Valore massimo assicurabile
  fixed_price: number; // Prezzo fisso (€)
  percent: number; // Percentuale aggiuntiva (%)
  percent_on: "totale" | "base"; // Calcolo % su: "totale" o "base"
}

/**
 * Configurazione Contrassegni (array di scaglioni)
 */
export interface CODConfigRow {
  max_value: number; // Valore massimo contrassegno
  fixed_price: number; // Prezzo fisso (€)
  percent: number; // Percentuale sul valore (%)
  percent_on: "totale" | "base"; // Calcolo % su: "totale" o "base"
}

/**
 * Configurazione Servizi Accessori
 */
export interface AccessoryServiceConfig {
  service: string; // Nome servizio (es. "Exchange", "Document Return", "Saturday Service", "Express12", "Preavviso Telefonico")
  price: number; // Prezzo fisso (€)
  percent: number; // Percentuale sul valore della spedizione (%)
}

/**
 * Configurazione Giacenze
 */
export interface StorageServiceConfig {
  service: string; // Nome servizio (es. "Riconsegna", "Riconsegna al nuovo destinatario", "Reso al mittente", "Distruggere", etc.)
  price: number; // Prezzo fisso (€)
  percent: number; // Percentuale sul valore della spedizione (%)
}

export interface StorageConfig {
  services: StorageServiceConfig[]; // Array di servizi giacenza
  dossier_opening_cost: number; // Costo apertura dossier giacenza (€)
  // Nota: "Il costo sarà addebitato solo nella fase di svincolo da parte del cliente"
}

/**
 * Configurazione Ritiro
 */
export interface PickupServiceConfig {
  service: string; // Nome servizio (es. "Ritiro")
  fixed_price: number; // Prezzo fisso (€)
  percent_of_freight: number; // Percentuale sul nolo (%)
}

/**
 * Configurazione Extra (flessibile per future estensioni)
 */
export interface ExtraConfig {
  [key: string]: any; // Struttura flessibile per configurazioni aggiuntive
}

/**
 * Configurazione completa per listino fornitore
 */
export interface SupplierPriceListConfig {
  id: string;
  price_list_id: string; // Collegamento al listino fornitore
  
  // Identificazione
  carrier_code: string; // es. "gls", "postedeliverybusiness"
  contract_code?: string; // es. "gls-standard", "postedeliverybusiness-SDA---Express---H24+"
  courier_config_id?: string; // ID configurazione Spedisci.Online
  
  // Configurazioni per sezione
  insurance_config: InsuranceConfig;
  cod_config: CODConfigRow[];
  accessory_services_config: AccessoryServiceConfig[];
  storage_config: StorageConfig;
  pickup_config: PickupServiceConfig[];
  extra_config: ExtraConfig;
  
  // Fattore peso/volume (densità)
  volumetric_density_factor?: number; // kg/m³ (default: 200 = divisore 5000)
  
  // Metadata
  notes?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

/**
 * Input per creazione/aggiornamento configurazione
 */
export interface UpsertSupplierPriceListConfigInput {
  price_list_id: string;
  carrier_code: string;
  contract_code?: string;
  courier_config_id?: string;
  insurance_config?: Partial<InsuranceConfig>;
  cod_config?: CODConfigRow[];
  accessory_services_config?: AccessoryServiceConfig[];
  storage_config?: Partial<StorageConfig>;
  pickup_config?: PickupServiceConfig[];
  extra_config?: ExtraConfig;
  volumetric_density_factor?: number; // kg/m³ (default: 200 = divisore 5000)
  notes?: string;
}

/**
 * Servizi accessori comuni per mapping default
 * 
 * Ogni corriere ha servizi specifici diversi.
 * Questi vengono inizializzati automaticamente quando si crea una configurazione.
 */
export const COMMON_ACCESSORY_SERVICES: Record<string, string[]> = {
  gls: [
    "Exchange",
    "Document Return",
    "Saturday Service",
    "Express12",
    "Preavviso Telefonico"
  ],
  postedeliverybusiness: [
    "Reverse A Domicilio",
    "Andata & Ritorno",
    "Reverse PuntoPoste",
    "Reverse PuntoPoste Locker",
    "Reverse Ufficio Postale",
    "Consegna su appuntamento"
  ],
  poste: [
    "Reverse A Domicilio",
    "Andata & Ritorno",
    "Reverse PuntoPoste",
    "Reverse PuntoPoste Locker",
    "Reverse Ufficio Postale",
    "Consegna su appuntamento"
  ],
  posteitaliane: [
    "Reverse A Domicilio",
    "Andata & Ritorno",
    "Reverse PuntoPoste",
    "Reverse PuntoPoste Locker",
    "Reverse Ufficio Postale",
    "Consegna su appuntamento"
  ],
  brt: [
    "Exchange",
    "Document Return",
    "Preavviso Telefonico"
  ],
  sda: [
    "Exchange",
    "Document Return",
    "Saturday Service",
    "Preavviso Telefonico"
  ],
  ups: [
    "Exchange",
    "Document Return",
    "Saturday Service"
  ],
  dhl: [
    "Exchange",
    "Document Return"
  ]
};

/**
 * Servizi giacenza comuni
 */
export const COMMON_STORAGE_SERVICES = [
  "Riconsegna",
  "Riconsegna al nuovo destinatario",
  "Reso al mittente",
  "Distruggere",
  "Il destinatario ritira la merce in sede",
  "Consegna parziale e rendi",
  "Consegna parziale e distruggi"
];

