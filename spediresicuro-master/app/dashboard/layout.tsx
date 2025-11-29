/**
 * Dashboard Layout
 * 
 * Layout protetto per tutte le pagine del dashboard.
 * Verifica autenticazione e reindirizza al login se necessario.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verifica autenticazione
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return <>{children}</>;
}

