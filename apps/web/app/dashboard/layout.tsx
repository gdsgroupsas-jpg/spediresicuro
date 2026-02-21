export const dynamic = 'force-dynamic';

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
import { getSafeAuth } from '@/lib/safe-auth';
import { findUserByEmail } from '@/lib/database';
import DashboardSidebar from '@/components/dashboard-sidebar';
import DashboardMobileNav from '@/components/dashboard-mobile-nav';
import DashboardLayoutClient from '@/components/dashboard-layout-client';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Verifica autenticazione
  // ⚠️ SECURITY: Test mode bypass SOLO in sviluppo, MAI in produzione
  const isProductionEnv = process.env.NODE_ENV === 'production';
  let isTestMode = false;
  let testHeaderValue = null;

  // SECURITY: In produzione, NESSUN bypass è permesso
  if (!isProductionEnv) {
    try {
      const headersList = await headers();
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
  }

  let session = null;
  if (!isTestMode) {
    const context = await getSafeAuth();
    session = context ? { user: context.actor } : null;
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

  // ⚠️ P0 FIX: Onboarding check RIMOSSO dal Layout
  // Il middleware (middleware.ts) è la UNICA fonte di verità per il controllo onboarding
  // Se la request arriva qui, significa che il middleware ha già verificato e permesso l'accesso
  // Duplicare la logica nel layout causava 307 self-redirect loop quando x-pathname header
  // non era disponibile o null (es. document request vs RSC request)
  console.log('✅ [DASHBOARD LAYOUT] Rendering layout - middleware has authorized access');

  return (
    <DashboardLayoutClient>
      {/* Sidebar - Desktop Only */}
      <DashboardSidebar />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col min-h-screen bg-gray-50 text-gray-900">
        {/* Content */}
        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Mobile Navigation - Mobile Only */}
      <DashboardMobileNav />
    </DashboardLayoutClient>
  );
}
