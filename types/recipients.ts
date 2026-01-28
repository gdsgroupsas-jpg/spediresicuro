/**
 * Tipi per autocompletamento destinatari
 *
 * Strutture dati per suggerire destinatari da spedizioni precedenti
 */

/**
 * Destinatario salvato estratto dalle spedizioni precedenti
 * Mappato su AddressData del wizard
 */
export interface SavedRecipient {
  /** ID univoco (hash di nome+indirizzo+citta) */
  id: string;
  /** Nome completo destinatario */
  name: string;
  /** Azienda (opzionale) */
  company?: string;
  /** Indirizzo completo */
  address: string;
  /** Citta */
  city: string;
  /** Provincia (2 lettere) */
  province: string;
  /** CAP (5 cifre) */
  zip: string;
  /** Telefono */
  phone: string;
  /** Email (opzionale) */
  email?: string;
  /** Data ultima spedizione (ISO string) */
  lastUsed: string;
  /** Numero di spedizioni a questo destinatario */
  usageCount: number;
}

/**
 * Risposta API ricerca destinatari
 */
export interface RecipientSearchResponse {
  results: SavedRecipient[];
  query: string;
  count: number;
}

/**
 * Parametri ricerca destinatari
 */
export interface RecipientSearchParams {
  /** Query di ricerca (nome destinatario) */
  query: string;
  /** Limite risultati (default 10, max 20) */
  limit?: number;
}
