/**
 * Server Component: Gestione Contrassegni
 *
 * Fetch iniziale server-side con AuthContext + getSpedizioni.
 * Passa dati a Client Component per UI e realtime.
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { getSpedizioni, getSupabaseUserIdFromEmail } from '@/lib/database';
import type { AuthContext } from '@/lib/auth-context';
import DashboardNav from '@/components/dashboard-nav';
import ContrassegniUI, { CashOnDeliveryShipment } from './_components/contrassegni-ui';

// Helper per arricchire shipment con calcoli (stesso codice del client)
function enrichShipment(shipment: any): CashOnDeliveryShipment {
  function checkContrassegnoInCarica(s: any): boolean {
    if (!s.internal_notes) return false;
    return s.internal_notes.includes('Contrassegno preso in carica');
  }

  function checkContrassegnoEvaso(s: any): boolean {
    if (s.notes && s.notes.includes('CONTRASSEGNO EVASO')) return true;
    if (s.internal_notes && s.internal_notes.includes('Contrassegno EVASO')) return true;
    return false;
  }

  function calculatePaymentStatus(s: any): CashOnDeliveryShipment['paymentStatus'] {
    if (s.status === 'delivered' && s.delivered_at) {
      const daysSince = Math.floor(
        (Date.now() - new Date(s.delivered_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSince > 7) {
        return 'paid';
      }

      return 'payment_expected';
    }

    if (s.status === 'delivered') {
      return 'delivered';
    }

    return 'pending';
  }

  function calculateExpectedPaymentDate(s: any): string | null {
    if (!s.delivered_at) return null;

    const deliveredDate = new Date(s.delivered_at);
    const expectedDate = new Date(deliveredDate);
    expectedDate.setDate(expectedDate.getDate() + 7);

    return expectedDate.toISOString();
  }

  const contrassegnoInCarica = checkContrassegnoInCarica(shipment);
  const contrassegnoEvaso = checkContrassegnoEvaso(shipment);

  let paymentStatus = calculatePaymentStatus(shipment);
  if (contrassegnoEvaso) {
    paymentStatus = 'evaso';
  } else if (contrassegnoInCarica) {
    paymentStatus = 'in_carica';
  }

  const expectedPaymentDate = calculateExpectedPaymentDate(shipment);
  const daysSinceDelivery = shipment.delivered_at
    ? Math.floor((Date.now() - new Date(shipment.delivered_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    ...shipment,
    paymentStatus,
    expectedPaymentDate,
    daysSinceDelivery,
    contrassegnoInCarica,
    contrassegnoEvaso,
  };
}

export default async function ContrassegniPage() {
  // Autenticazione
  const context = await getSafeAuth();

  if (!context?.actor?.email) {
    // Redirect o errore (gestito dal layout)
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNav title="Gestione Contrassegni" subtitle="Accesso negato" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">Autenticazione richiesta</p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch dati server-side con AuthContext
  let shipments: CashOnDeliveryShipment[] = [];
  let userId: string | null = null;

  try {
    // Converti ActingContext in AuthContext per database operations
    const authContext: AuthContext = {
      type: 'user',
      userId: context.target.id,
      userEmail: context.target.email || undefined,
      isAdmin: context.target.role === 'admin' || context.target.account_type === 'superadmin',
    };

    // Ottieni userId per realtime
    if (authContext.type === 'user' && context.actor.email) {
      userId = await getSupabaseUserIdFromEmail(context.actor.email);
    }

    // Fetch spedizioni con AuthContext (multi-tenancy garantito)
    const allShipments = await getSpedizioni(authContext);

    // Filtra contrassegni e arricchisci
    shipments = allShipments
      .filter((s: any) => s.cash_on_delivery === true && s.deleted !== true)
      .map((s: any) => enrichShipment(s));
  } catch (error: any) {
    console.error('❌ [SERVER] Errore caricamento contrassegni:', error);
    // In caso di errore, passa array vuoto (UI gestirà il messaggio)
    shipments = [];
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Gestione Contrassegni"
        subtitle="Monitora e gestisci tutte le spedizioni con contrassegno"
      />
      <ContrassegniUI initialShipments={shipments} userId={userId} />
    </div>
  );
}
