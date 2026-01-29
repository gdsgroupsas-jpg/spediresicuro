/**
 * Google Places Adapter - Base Interface
 *
 * Interfaccia comune per autocomplete indirizzi e geocoding.
 * Segue il pattern adapter di lib/adapters/ocr/base.ts.
 */

// ==================== TYPES ====================

export interface PlacesAutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  streetName: string;
  streetNumber: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface PlacesAutocompleteOptions {
  /** Session token per billing optimization (raggruppa autocomplete + details) */
  sessionToken: string;
  /** Filtro paese (default: 'it') */
  country?: string;
  /** Limita tipi di risultati */
  types?: string[];
}

// ==================== ABSTRACT ADAPTER ====================

/**
 * Base Places Adapter
 */
export abstract class PlacesAdapter {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Autocomplete: suggerimenti indirizzo da input parziale
   *
   * @param input - Testo parziale (es. "Via Roma 20, Mil")
   * @param options - Opzioni (sessionToken obbligatorio)
   */
  abstract autocomplete(
    input: string,
    options: PlacesAutocompleteOptions
  ): Promise<PlacesAutocompleteResult[]>;

  /**
   * Place Details: dati completi di un indirizzo selezionato
   *
   * @param placeId - ID restituito da autocomplete
   * @param sessionToken - Stesso token della sessione autocomplete
   */
  abstract getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails | null>;

  /**
   * Test disponibilità servizio
   */
  abstract isAvailable(): Promise<boolean>;
}
