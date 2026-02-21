/**
 * Pagina Manuale Utente - Route Pubblica (Redirect)
 *
 * Route pubblica /manuale - Redirect a versione protetta
 *
 * Se utente è autenticato → redirect a /dashboard/manuale
 * Se utente NON è autenticato → redirect a login
 *
 * ⚠️ La versione protetta è in /dashboard/manuale (legge docs/MANUALE_UTENTE_RESELLER_V1.md)
 */

import { redirect } from 'next/navigation';
import { getSafeAuth } from '@/lib/safe-auth';

export const metadata = {
  title: 'Manuale Utente | SpedireSicuro',
  description: 'Documentazione completa della piattaforma SpedireSicuro.',
};

// Forza rendering dinamico
export const dynamic = 'force-dynamic';

export default async function ManualePage() {
  const context = await getSafeAuth();

  if (context) {
    // Utente autenticato → redirect a versione protetta
    redirect('/dashboard/manuale');
  }

  // Utente non autenticato → redirect a login con callback
  redirect('/login?callbackUrl=/dashboard/manuale');
}
