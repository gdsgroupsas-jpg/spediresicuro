/**
 * API Route: Place Details
 *
 * Recupera dettagli strutturati di un indirizzo selezionato da autocomplete.
 * Cross-valida con dataset postale italiano.
 *
 * GET /api/address/details?placeId=xxx&session=uuid
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPlacesAdapter } from '@/lib/adapters/google-places';
import { getCachedPlaceDetails, setCachedPlaceDetails } from '@/lib/address/places-cache';
import { validateAddress } from '@/lib/address/italian-postal-data';
import { classifyAddress } from '@/lib/address/classify-address';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const placeId = searchParams.get('placeId');
    const sessionToken = searchParams.get('session');

    if (!placeId) {
      return NextResponse.json({ success: false, error: 'placeId obbligatorio' }, { status: 400 });
    }

    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Session token obbligatorio' },
        { status: 400 }
      );
    }

    // Check cache
    const cached = await getCachedPlaceDetails(placeId);
    if (cached) {
      const validation = validateAddress(cached.postalCode, cached.city, cached.province);
      const classification = classifyAddress({ addressLine1: cached.formattedAddress });

      return NextResponse.json({
        success: true,
        details: cached,
        validation,
        classification: classification.type,
        cached: true,
      });
    }

    // Call Places API
    const adapter = createPlacesAdapter();
    const details = await adapter.getPlaceDetails(placeId, sessionToken);

    if (!details) {
      return NextResponse.json(
        { success: false, error: 'Dettagli non trovati per questo indirizzo' },
        { status: 404 }
      );
    }

    // Cache results
    await setCachedPlaceDetails(placeId, details);

    // Cross-validate with Italian postal dataset
    const validation = validateAddress(details.postalCode, details.city, details.province);

    // Classify address type
    const classification = classifyAddress({ addressLine1: details.formattedAddress });

    return NextResponse.json({
      success: true,
      details,
      validation,
      classification: classification.type,
      cached: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore place details';
    console.error('[PlaceDetails] Errore:', message);

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
