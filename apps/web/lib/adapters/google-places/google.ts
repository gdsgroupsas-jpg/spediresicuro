/**
 * Google Places Adapter - Real Implementation
 *
 * Usa Google Places API (New) con session tokens per billing optimization.
 * Una sessione autocomplete + details = 1 sola chiamata fatturata.
 *
 * Costo: ~$17/1000 sessioni, free tier 10.000/mese per SKU
 */

import { instrumentedFetch } from '@/lib/services/instrumented-fetch';
import {
  PlacesAdapter,
  PlacesAutocompleteResult,
  PlacesAutocompleteOptions,
  PlaceDetails,
} from './base';

const PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place';

export class GooglePlacesAdapter extends PlacesAdapter {
  private apiKey: string;

  constructor() {
    super('google-places');

    const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      throw new Error('GOOGLE_PLACES_API_KEY o GOOGLE_MAPS_API_KEY non configurata');
    }
    this.apiKey = key;
  }

  async autocomplete(
    input: string,
    options: PlacesAutocompleteOptions
  ): Promise<PlacesAutocompleteResult[]> {
    if (!input || input.length < 3) return [];

    const params = new URLSearchParams({
      input,
      key: this.apiKey,
      sessiontoken: options.sessionToken,
      components: `country:${options.country || 'it'}`,
      types: (options.types || ['address']).join('|'),
      language: 'it',
    });

    const response = await instrumentedFetch(`${PLACES_BASE_URL}/autocomplete/json?${params}`, {
      serviceName: 'google-places',
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`[GooglePlaces] Autocomplete error: ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error(`[GooglePlaces] Autocomplete status: ${data.status}`);
      return [];
    }

    return (data.predictions || []).map((prediction: Record<string, unknown>) => ({
      placeId: prediction.place_id as string,
      description: prediction.description as string,
      mainText: (prediction.structured_formatting as Record<string, string>)?.main_text || '',
      secondaryText:
        (prediction.structured_formatting as Record<string, string>)?.secondary_text || '',
    }));
  }

  async getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails | null> {
    const params = new URLSearchParams({
      place_id: placeId,
      key: this.apiKey,
      sessiontoken: sessionToken,
      fields: 'address_components,geometry,formatted_address',
      language: 'it',
    });

    const response = await instrumentedFetch(`${PLACES_BASE_URL}/details/json?${params}`, {
      serviceName: 'google-places',
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`[GooglePlaces] Details error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status !== 'OK') {
      console.error(`[GooglePlaces] Details status: ${data.status}`);
      return null;
    }

    return this.parseAddressComponents(data.result);
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  /**
   * Parsa i componenti indirizzo Google in formato strutturato
   */
  private parseAddressComponents(result: Record<string, unknown>): PlaceDetails {
    const components = (result.address_components || []) as Array<{
      long_name: string;
      short_name: string;
      types: string[];
    }>;
    const geometry = result.geometry as { location: { lat: number; lng: number } };

    const get = (type: string): string => {
      const comp = components.find((c) => c.types.includes(type));
      return comp?.long_name || '';
    };

    const getShort = (type: string): string => {
      const comp = components.find((c) => c.types.includes(type));
      return comp?.short_name || '';
    };

    return {
      streetName: get('route'),
      streetNumber: get('street_number'),
      city:
        get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2'),
      province: getShort('administrative_area_level_2'),
      postalCode: get('postal_code'),
      country: getShort('country'),
      lat: geometry?.location?.lat || 0,
      lng: geometry?.location?.lng || 0,
      formattedAddress: (result.formatted_address as string) || '',
    };
  }
}
