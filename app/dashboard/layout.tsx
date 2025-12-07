/**
 * Dashboard Layout
 *
 * Layout protetto per tutte le pagine del dashboard.
 * Verifica autenticazione e reindirizza al login se necessario.
 * Include:
 * - Sidebar per desktop
 * - Mobile navigation con bottom bar
 * - AI Assistant modal globale
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';
import DashboardSidebar from '@/components/dashboard-sidebar';
import DashboardMobileNav from '@/components/dashboard-mobile-nav';
import DashboardLayoutClient from '@/components/dashboard-layout-client';

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

  return (
    <DashboardLayoutClient>
      {/* Sidebar - Desktop Only */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Content */}
        <main className="flex-1 pb-20 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Navigation - Mobile Only */}
      <DashboardMobileNav />
    </DashboardLayoutClient>
  );
}

