/**
 * API Route: Address Autocomplete
 *
 * Search-as-you-type per indirizzi italiani via Google Places API.
 * Cache Redis per ridurre chiamate API e costi.
 *
 * GET /api/address/autocomplete?q=Via+Roma+20&session=uuid
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPlacesAdapter } from '@/lib/adapters/google-places';
import { getCachedAutocomplete, setCachedAutocomplete } from '@/lib/address/places-cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const sessionToken = searchParams.get('session');

    if (!query || query.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Query deve essere almeno 3 caratteri' },
        { status: 400 }
      );
    }

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Session token obbligatorio' },
        { status: 400 }
      );
    }

    // Check cache
    const cached = await getCachedAutocomplete(query);
    if (cached) {
      return NextResponse.json({
        success: true,
        results: cached,
        cached: true,
      });
    }

    // Call Places API
    const adapter = createPlacesAdapter();
    const results = await adapter.autocomplete(query, {
      sessionToken,
      country: 'it',
    });

    // Cache results
    if (results.length > 0) {
      await setCachedAutocomplete(query, results);
    }

    return NextResponse.json({
      success: true,
      results,
      cached: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore autocomplete';
    console.error('[AddressAutocomplete] Errore:', message);

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
