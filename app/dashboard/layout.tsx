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
import { headers } from 'next/headers';
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
  // ⚠️ BYPASS IN TEST MODE: Controlla header HTTP o variabile d'ambiente
  // Playwright può impostare header HTTP facilmente, più affidabile delle env vars
  let isTestMode = false;
  let testHeaderValue = null;
  try {
    const headersList = headers();
    testHeaderValue = headersList.get('x-test-mode');
    isTestMode = testHeaderValue === 'playwright' || process.env.PLAYWRIGHT_TEST_MODE === 'true';
    if (testHeaderValue) {
      console.log('🧪 [DASHBOARD LAYOUT] Header x-test-mode trovato:', testHeaderValue);
    }
  } catch (e) {
    // Se headers() non è disponibile, usa solo env var
    isTestMode = process.env.PLAYWRIGHT_TEST_MODE === 'true';
    console.log('🧪 [DASHBOARD LAYOUT] headers() non disponibile, uso solo env var:', isTestMode);
  }
  
  let session = null;
  if (!isTestMode) {
    session = await auth();
  } else {
    // In test mode, crea una sessione mock
    session = {
      user: {
        id: 'test-user-id',
        email: process.env.TEST_USER_EMAIL || 'test@example.com',
        name: 'Test User E2E',
        role: 'user',
      },
    };
    console.log('🧪 [DASHBOARD LAYOUT] Test mode attivo - bypass autenticazione');
  }

  console.log('🔍 [DASHBOARD LAYOUT] Verifica sessione:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    email: session?.user?.email,
    provider: (session?.user as any)?.provider,
    isTestMode,
  });

  if (!session && !isTestMode) {
    console.log('❌ [DASHBOARD LAYOUT] Nessuna sessione trovata, redirect a /login');
    redirect('/login');
  }

  // ⚠️ P0-1 FIX: Gate server-authoritative per onboarding
  // Controlla dati_cliente.datiCompletati PRIMA di renderizzare
  // Se dati non completati e NON siamo già su /dashboard/dati-cliente → redirect
  if (session?.user?.email && !isTestMode) {
    try {
      // Ottieni pathname corrente dal middleware (header custom)
      const headersList = headers();
      const currentPathname = headersList.get('x-pathname') || '';
      const isOnOnboardingPage = currentPathname === '/dashboard/dati-cliente';
      
      const user = await findUserByEmail(session.user.email);
      const userEmail = session.user.email?.toLowerCase() || '';
      const isTestUser = userEmail === 'test@spediresicuro.it';
      
      // Per utente test, bypass controllo onboarding
      if (!isTestUser) {
        // Verifica se dati cliente sono completati
        const datiCompletati = user?.datiCliente?.datiCompletati === true;
        const hasDatiCliente = !!user?.datiCliente;
        
        // Se dati NON completati (NULL o datiCompletati !== true)
        if (!datiCompletati || !hasDatiCliente) {
          // ⚠️ CRITICO: Redirect solo se NON siamo già su onboarding page (evita loop infiniti)
          if (!isOnOnboardingPage) {
            console.log('🔄 [DASHBOARD LAYOUT] Dati cliente non completati, redirect a /dashboard/dati-cliente', {
              email: session.user.email,
              hasDatiCliente,
              datiCompletati,
              currentPathname,
            });
            redirect('/dashboard/dati-cliente');
          } else {
            // Siamo già su onboarding page, non fare redirect (evita loop)
            console.log('ℹ️ [DASHBOARD LAYOUT] Dati cliente non completati ma già su /dashboard/dati-cliente, skip redirect', {
              email: session.user.email,
              currentPathname,
            });
          }
        }
      }
    } catch (error: any) {
      // Fail-closed: se errore query DB → redirect a dati-cliente (solo se non siamo già lì)
      console.error('❌ [DASHBOARD LAYOUT] Errore verifica dati cliente, fail-closed:', error);
      try {
        const headersList = headers();
        const currentPathname = headersList.get('x-pathname') || '';
        if (currentPathname !== '/dashboard/dati-cliente') {
          redirect('/dashboard/dati-cliente');
        }
      } catch (e) {
        // Se non possiamo determinare pathname, redirect comunque (fail-closed)
        redirect('/dashboard/dati-cliente');
      }
    }
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

