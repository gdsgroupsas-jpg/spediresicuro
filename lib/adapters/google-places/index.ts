/**
 * Google Places Adapters - Export centrale e Factory
 */

export * from './base';
export * from './google';
export * from './mock';

import { PlacesAdapter } from './base';
import { MockPlacesAdapter } from './mock';

/**
 * Factory per creare Places adapter
 * Segue lo stesso pattern di lib/adapters/ocr/base.ts
 */
export function createPlacesAdapter(type: 'google' | 'mock' | 'auto' = 'auto'): PlacesAdapter {
  switch (type) {
    case 'google': {
      const { GooglePlacesAdapter } = require('./google');
      return new GooglePlacesAdapter();
    }

    case 'mock': {
      return new MockPlacesAdapter();
    }

    case 'auto':
    default: {
      // Usa Google se API key disponibile, altrimenti mock
      const hasKey = !!(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY);

      if (hasKey) {
        try {
          const { GooglePlacesAdapter } = require('./google');
          return new GooglePlacesAdapter();
        } catch (error) {
          console.warn('[Places] Google Places non disponibile, fallback a Mock:', error);
        }
      }

      console.warn('[Places] API key non configurata - usando Mock Places');
      return new MockPlacesAdapter();
    }
  }
}
