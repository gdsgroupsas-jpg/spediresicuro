/**
 * API Route: Tracking Shipment
 *
 * Endpoint: GET /api/tracking/[shipmentId]
 *           GET /api/tracking/[shipmentId]?refresh=true  (force refresh from API)
 *
 * Returns tracking events and current status for a shipment.
 * First checks cache (DB), then fetches from Spedisci.Online if stale.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { getTrackingService } from '@/lib/services/tracking';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { shipmentId: string } }) {
  try {
    const { shipmentId } = params;
    const searchParams = request.nextUrl.searchParams;
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Verify authentication
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Verify user has access to this shipment
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from('shipments')
      .select('id, user_id, tracking_number')
      .eq('id', shipmentId)
      .single();

    if (shipmentError || !shipment) {
      return NextResponse.json({ error: 'Spedizione non trovata' }, { status: 404 });
    }

    // Check access: user must own shipment or be admin
    const isAdmin = context.actor.role === 'admin' || context.actor.role === 'superadmin';
    const isOwner = shipment.user_id === context.actor.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 });
    }

    // Get tracking info
    const trackingService = getTrackingService();
    const trackingData = await trackingService.getTracking(shipmentId, forceRefresh);

    // Add carrier direct links for fallback
    const carrierLinks = getCarrierTrackingLinks(shipment.tracking_number, trackingData.carrier);

    return NextResponse.json({
      ...trackingData,
      carrier_links: carrierLinks,
    });
  } catch (error) {
    console.error('Error in tracking API:', error);
    return NextResponse.json(
      {
        error: 'Errore durante il recupero del tracking',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get direct tracking links for carrier websites
 */
function getCarrierTrackingLinks(
  trackingNumber: string | null,
  carrier?: string | null
): Record<string, string> {
  if (!trackingNumber) return {};

  const encoded = encodeURIComponent(trackingNumber);
  const links: Record<string, string> = {};

  // Always provide generic links based on carrier
  const carrierUpper = (carrier || '').toUpperCase();

  switch (carrierUpper) {
    case 'GLS':
      links.gls = `https://gls-group.eu/IT/it/tracking?match=${encoded}`;
      break;
    case 'BRT':
    case 'BARTOLINI':
      links.brt = `https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Ession=&Chiession=&NumeroSpedizione=${encoded}`;
      break;
    case 'POSTE':
    case 'POSTE ITALIANE':
    case 'SDA':
      links.poste = `https://www.poste.it/cerca/index.html#/risultati-ricerca-702702702702702/${encoded}`;
      break;
    case 'DHL':
      links.dhl = `https://www.dhl.com/it-it/home/tracking/tracking-express.html?submit=1&tracking-id=${encoded}`;
      break;
    case 'UPS':
      links.ups = `https://www.ups.com/track?tracknum=${encoded}&loc=it_IT`;
      break;
    case 'FEDEX':
      links.fedex = `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
      break;
    case 'TNT':
      links.tnt = `https://www.tnt.it/tracking/track?locale=it_IT&searchType=CON&cons=${encoded}`;
      break;
    default:
      // Provide all major Italian carriers as fallback
      links.gls = `https://gls-group.eu/IT/it/tracking?match=${encoded}`;
      links.brt = `https://vas.brt.it/vas/sped_det_show.hsm?referer=sped_numspe_par.htm&Ession=&ChiSession=&NumeroSpedizione=${encoded}`;
      links.poste = `https://www.poste.it/cerca/index.html#/risultati-ricerca-702702702702702/${encoded}`;
  }

  return links;
}
