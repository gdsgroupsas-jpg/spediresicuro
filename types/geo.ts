/**
 * Tipi TypeScript per il sistema geo-locations
 */

/**
 * Risultato ricerca geo-location
 */
export interface GeoLocation {
  id: string;
  name: string;
  province: string;
  region: string | null;
  caps: string[];
}

/**
 * Risultato formattato per la UI
 */
export interface GeoLocationOption {
  city: string;
  province: string;
  region: string | null;
  caps: string[];
  displayText: string; // Formato: "Roma (RM) - 00100, 00118"
}

/**
 * Risposta API di ricerca
 */
export interface GeoSearchResponse {
  results: GeoLocationOption[];
  count: number;
  query: string;
}

/**
 * Callback per selezione location
 */
export type OnLocationSelect = (location: {
  city: string;
  province: string;
  cap: string | null; // CAP selezionato (null se multipli)
  caps: string[]; // Tutti i CAP disponibili
}) => void;











