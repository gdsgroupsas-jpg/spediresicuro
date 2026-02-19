/**
 * Server Component: Gestione Resi
 *
 * Fetch iniziale server-side con AuthContext + getSpedizioni.
 * Passa dati a Client Component per UI e realtime.
 */

import { getSafeAuth } from '@/lib/safe-auth';
import { getSpedizioni, getSupabaseUserIdFromEmail } from '@/lib/database';
import type { AuthContext } from '@/lib/auth-context';
import DashboardNav from '@/components/dashboard-nav';
import ResiUI, { ReturnShipment } from './_components/resi-ui';

export default async function ResiPage() {
  // Autenticazione
  const context = await getSafeAuth();

  if (!context?.actor?.email) {
    // Redirect o errore (gestito dal layout)
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardNav title="Gestione Resi" subtitle="Accesso negato" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500">Autenticazione richiesta</p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch dati server-side con AuthContext
  let returns: ReturnShipment[] = [];
  let userId: string | null = null;

  try {
    // Converti ActingContext in AuthContext per database operations
    const authContext: AuthContext = {
      type: 'user',
      userId: context.target.id,
      userEmail: context.target.email || undefined,
      isAdmin:
        context.target.account_type === 'admin' || context.target.account_type === 'superadmin',
    };

    // Ottieni userId per realtime
    if (authContext.type === 'user' && context.actor.email) {
      userId = await getSupabaseUserIdFromEmail(context.actor.email);
    }

    // Fetch spedizioni con AuthContext (multi-tenancy garantito)
    const allShipments = await getSpedizioni(authContext);

    // Filtra resi
    returns = allShipments
      .filter((s: any) => s.is_return === true && s.deleted !== true)
      .map((s: any) => s as ReturnShipment);
  } catch (error: any) {
    console.error('❌ [SERVER] Errore caricamento resi:', error);
    // In caso di errore, passa array vuoto (UI gestirà il messaggio)
    returns = [];
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Gestione Resi"
        subtitle="Visualizza e gestisci tutti i resi registrati"
      />
      <ResiUI initialReturns={returns} userId={userId} />
    </div>
  );
}
