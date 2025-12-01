/**
 * Dashboard Layout
 * 
 * Layout protetto per tutte le pagine del dashboard.
 * Verifica autenticazione e reindirizza al login se necessario.
 * Verifica se i dati cliente sono completati e reindirizza se necessario.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verifica autenticazione
  const session = await auth();

  console.log('🔍 [DASHBOARD LAYOUT] Verifica sessione:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    email: session?.user?.email,
    provider: (session?.user as any)?.provider,
  });

  if (!session) {
    console.log('❌ [DASHBOARD LAYOUT] Nessuna sessione trovata, redirect a /login');
    redirect('/login');
  }

  // Verifica se i dati cliente sono completati (solo se non siamo già sulla pagina dati-cliente)
  // Nota: Questo controllo viene fatto lato server, ma per evitare problemi di routing
  // facciamo il check lato client nella pagina stessa
  
  return <>{children}</>;
}

