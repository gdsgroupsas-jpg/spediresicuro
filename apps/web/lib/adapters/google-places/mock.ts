/**
 * Google Places Adapter - Mock Implementation
 *
 * Per testing e sviluppo locale senza API key.
 * Restituisce dati realistici per indirizzi italiani comuni.
 */

import {
  PlacesAdapter,
  PlacesAutocompleteResult,
  PlacesAutocompleteOptions,
  PlaceDetails,
} from './base';

// ==================== MOCK DATA ====================

const MOCK_ADDRESSES: Record<string, PlaceDetails> = {
  'mock-place-1': {
    streetName: 'Via Roma',
    streetNumber: '20',
    city: 'Milano',
    province: 'MI',
    postalCode: '20121',
    country: 'IT',
    lat: 45.4654,
    lng: 9.1859,
    formattedAddress: 'Via Roma, 20, 20121 Milano MI, Italia',
  },
  'mock-place-2': {
    streetName: 'Piazza del Colosseo',
    streetNumber: '1',
    city: 'Roma',
    province: 'RM',
    postalCode: '00184',
    country: 'IT',
    lat: 41.8902,
    lng: 12.4922,
    formattedAddress: 'Piazza del Colosseo, 1, 00184 Roma RM, Italia',
  },
  'mock-place-3': {
    streetName: 'Via Toledo',
    streetNumber: '156',
    city: 'Napoli',
    province: 'NA',
    postalCode: '80134',
    country: 'IT',
    lat: 40.8438,
    lng: 14.2487,
    formattedAddress: 'Via Toledo, 156, 80134 Napoli NA, Italia',
  },
  'mock-place-4': {
    streetName: 'Corso Vittorio Emanuele II',
    streetNumber: '104',
    city: 'Torino',
    province: 'TO',
    postalCode: '10121',
    country: 'IT',
    lat: 45.0703,
    lng: 7.6869,
    formattedAddress: 'Corso Vittorio Emanuele II, 104, 10121 Torino TO, Italia',
  },
  'mock-place-5': {
    streetName: 'Via Maqueda',
    streetNumber: '100',
    city: 'Palermo',
    province: 'PA',
    postalCode: '90133',
    country: 'IT',
    lat: 38.1157,
    lng: 13.3615,
    formattedAddress: 'Via Maqueda, 100, 90133 Palermo PA, Italia',
  },
};

// ==================== MOCK ADAPTER ====================

export class MockPlacesAdapter extends PlacesAdapter {
  constructor() {
    super('mock-places');
  }

  async autocomplete(
    input: string,
    _options: PlacesAutocompleteOptions
  ): Promise<PlacesAutocompleteResult[]> {
    if (!input || input.length < 3) return [];

    const lower = input.toLowerCase();

    return Object.entries(MOCK_ADDRESSES)
      .filter(
        ([, details]) =>
          details.formattedAddress.toLowerCase().includes(lower) ||
          details.streetName.toLowerCase().includes(lower) ||
          details.city.toLowerCase().includes(lower)
      )
      .map(([placeId, details]) => ({
        placeId,
        description: details.formattedAddress,
        mainText: `${details.streetName}, ${details.streetNumber}`,
        secondaryText: `${details.city}, ${details.province}, Italia`,
      }));
  }

  async getPlaceDetails(placeId: string, _sessionToken: string): Promise<PlaceDetails | null> {
    return MOCK_ADDRESSES[placeId] || null;
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
