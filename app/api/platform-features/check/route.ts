/**
 * API Route: Verifica se una platform feature è attiva
 * 
 * GET: Verifica se una feature è attiva (pubblica, per uso lato client)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isPlatformFeatureEnabled, isPlatformFeatureVisible } from '@/lib/platform-features';

// Forza rendering dinamico (usa nextUrl.searchParams)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const featureCode = searchParams.get('feature');

    if (!featureCode) {
      return NextResponse.json(
        { error: 'Parametro feature obbligatorio' },
        { status: 400 }
      );
    }

    const [enabled, visible] = await Promise.all([
      isPlatformFeatureEnabled(featureCode),
      isPlatformFeatureVisible(featureCode),
    ]);

    return NextResponse.json({
      feature_code: featureCode,
      is_enabled: enabled,
      is_visible: visible,
      is_active: enabled && visible,
    });
  } catch (error: any) {
    console.error('Errore API platform-features/check:', error);
    return NextResponse.json(
      { error: 'Errore durante la verifica della feature' },
      { status: 500 }
    );
  }
}




