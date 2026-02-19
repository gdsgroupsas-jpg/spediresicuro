/**
 * Server Component: Gestione Contrassegni
 *
 * - Admin/Superadmin: Vista admin con tabs (Lista COD + Distinte)
 * - Utenti normali: Vista contrassegni spedizioni personali
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import { getSpedizioni, getSupabaseUserIdFromEmail } from '@/lib/database';
import type { AuthContext } from '@/lib/auth-context';
import DashboardNav from '@/components/dashboard-nav';
import ContrassegniUI, { CashOnDeliveryShipment } from './_components/contrassegni-ui';
import AdminContrassegni from './_components/admin-contrassegni';

// Helper per arricchire shipment con calcoli — usa cod_status reale dal DB quando disponibile
function enrichShipment(shipment: any): CashOnDeliveryShipment {
  function checkContrassegnoInCarica(s: any): boolean {
    if (s.cod_status === 'collected') return true;
    if (!s.internal_notes) return false;
    return s.internal_notes.includes('Contrassegno preso in carica');
  }

  function checkContrassegnoEvaso(s: any): boolean {
    if (s.cod_status === 'paid') return true;
    if (s.notes && s.notes.includes('CONTRASSEGNO EVASO')) return true;
    if (s.internal_notes && s.internal_notes.includes('Contrassegno EVASO')) return true;
    return false;
  }

  function calculatePaymentStatus(s: any): CashOnDeliveryShipment['paymentStatus'] {
    // Priorità: dato reale dal sistema COD (sincronizzato via trigger)
    if (s.cod_status === 'paid') return 'evaso';
    if (s.cod_status === 'collected') return 'in_carica';

    // Fallback euristica per spedizioni senza match COD
    if (s.status === 'delivered' && s.delivered_at) {
      const daysSince = Math.floor(
        (Date.now() - new Date(s.delivered_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSince > 7) return 'payment_expected';
      return 'delivered';
    }

    if (s.status === 'delivered') return 'delivered';
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
  // Legacy override solo se cod_status non presente
  if (!shipment.cod_status) {
    if (contrassegnoEvaso) paymentStatus = 'evaso';
    else if (contrassegnoInCarica) paymentStatus = 'in_carica';
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
  const context = await getSafeAuth();

  if (!context?.actor?.email) {
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

  const isAdmin = isAdminOrAbove(context.target);

  // Admin: mostra vista admin con tabs
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNav
          title="Admin Contrassegni"
          subtitle="Gestione contrassegni, distinte e pagamenti"
        />
        <AdminContrassegni />
      </div>
    );
  }

  // Utenti normali: vista contrassegni personali
  let shipments: CashOnDeliveryShipment[] = [];
  let userId: string | null = null;

  try {
    const authContext: AuthContext = {
      type: 'user',
      userId: context.target.id,
      userEmail: context.target.email || undefined,
      isAdmin: false,
    };

    if (context.actor.email) {
      userId = await getSupabaseUserIdFromEmail(context.actor.email);
    }

    const allShipments = await getSpedizioni(authContext);

    shipments = allShipments
      .filter((s: any) => s.cash_on_delivery === true && s.deleted !== true)
      .map((s: any) => enrichShipment(s));
  } catch (error: any) {
    console.error('[Contrassegni] Errore caricamento:', error);
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
