/**
 * Dashboard Layout Client Component
 *
 * Componente client-side per gestire:
 * - AI Assistant modal globale (Pilot)
 * - Anne Assistant (fantasmino floating)
 * - Eventi personalizzati per aprire l'AI Assistant
 * - Session management
 */

'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PilotModal } from '@/components/ai/pilot/pilot-modal';
import { AnneProvider, AnneAssistant } from '@/components/anne';
import AnneDoctorBridge from '@/components/anne/AnneDoctorBridge';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

export default function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // ⚠️ P0: CLIENT-SIDE ONBOARDING GATE (Backup del middleware)
  // Questo è un FAIL-SAFE che si attiva se il middleware non blocca per qualche motivo
  // (es: soft navigation, cache, edge cases)
  // IMPORTANTE: Controlla su OGNI cambio pathname (non solo la prima volta)
  useEffect(() => {
    async function checkOnboarding() {
      // Non fare nulla se:
      // 1. Session non ancora caricata
      // 2. Siamo già su /dashboard/dati-cliente (anti-loop)
      if (status === 'loading') return;
      if (!session?.user?.email) return;
      if (pathname === '/dashboard/dati-cliente') {
        return;
      }

      try {
        // Verifica stato onboarding su OGNI navigazione
        const response = await fetch('/api/user/dati-cliente', {
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          const datiCompletati = data?.datiCliente?.datiCompletati === true;

          // Se dati NON completati → redirect a onboarding
          if (!datiCompletati) {
            console.warn('🔒 [CLIENT GUARD] Dati cliente non completati, redirect a onboarding', {
              email: session.user.email,
              pathname,
              datiCompletati,
            });
            router.push('/dashboard/dati-cliente');
            return;
          }

          // Dati completati → ok, continua
          console.log('✅ [CLIENT GUARD] Dati cliente completati, accesso consentito', {
            email: session.user.email,
            pathname,
          });
        }
      } catch (error) {
        console.error('❌ [CLIENT GUARD] Errore verifica onboarding:', error);
        // Fail-open: se errore, permetti accesso (il middleware ha già bloccato se necessario)
      }
    }

    checkOnboarding();
  }, [session, status, pathname, router]);

  // Carica il tipo di account e ruolo
  // ⚠️ OTTIMIZZAZIONE: Usa cache per evitare fetch duplicati (già fatto nella sidebar)
  useEffect(() => {
    async function loadUserInfo() {
      if (session?.user?.email) {
        // ⚠️ OTTIMIZZAZIONE: Controlla cache prima di fare fetch
        const cacheKey = `userInfo_${session.user.email}`;
        const cachedData = typeof window !== 'undefined' ? sessionStorage.getItem(cacheKey) : null;

        if (cachedData) {
          try {
            const userData = JSON.parse(cachedData);
            setAccountType(userData.account_type || null);
            setUserRole(userData.role || null);
            // Aggiorna in background senza bloccare
            fetch('/api/user/info')
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data) {
                  const freshData = data.user || data;
                  setAccountType(freshData.account_type || null);
                  setUserRole(freshData.role || null);
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
                  }
                }
              })
              .catch(() => {});
            return;
          } catch (e) {
            // Cache invalida, continua con fetch
          }
        }

        try {
          const response = await fetch('/api/user/info', {
            next: { revalidate: 30 },
          });
          if (response.ok) {
            const data = await response.json();
            const userData = data.user || data;
            setAccountType(userData.account_type || null);
            setUserRole(userData.role || null);
            if (typeof window !== 'undefined') {
              sessionStorage.setItem(cacheKey, JSON.stringify(userData));
            }
          }
        } catch (error) {
          console.error('Errore caricamento info utente:', error);
        }
      }
    }
    loadUserInfo();
  }, [session]);

  // Ascolta l'evento personalizzato per aprire l'AI Assistant (Pilot)
  useEffect(() => {
    const handleOpenAiAssistant = () => {
      setShowAiAssistant(true);
    };

    window.addEventListener('openAiAssistant', handleOpenAiAssistant);

    return () => {
      window.removeEventListener('openAiAssistant', handleOpenAiAssistant);
    };
  }, []);

  const effectiveUserRole = (accountType || userRole || 'user') as 'user' | 'admin' | 'superadmin';

  // Per PilotModal, converti superadmin in admin
  const pilotUserRole: 'admin' | 'user' =
    effectiveUserRole === 'superadmin' ? 'admin' : effectiveUserRole === 'admin' ? 'admin' : 'user';

  return (
    <AnneProvider>
      {children}

      {/* Pilot Modal - AI Assistant avanzato */}
      {session?.user && (
        <PilotModal
          isOpen={showAiAssistant}
          onClose={() => setShowAiAssistant(false)}
          userId={session.user.id || ''}
          userRole={pilotUserRole}
          userName={session.user.name || session.user.email || 'Utente'}
        />
      )}

      {/* Anne Assistant - Fantasmino floating */}
      {session?.user && (
        <AnneAssistant
          userId={session.user.id || ''}
          userRole={effectiveUserRole}
          userName={session.user.name || session.user.email || 'Utente'}
          currentPage={pathname || '/dashboard'}
        />
      )}

      {/* Doctor Bridge - Integrazione Self-Healing (Premium) */}
      {session?.user && (
        <AnneDoctorBridge
          userRole={effectiveUserRole}
          hasDoctorSubscription={true} // TODO: Leggere dal DB in produzione
        />
      )}
    </AnneProvider>
  );
}
