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
import { usePathname } from 'next/navigation';
import { PilotModal } from '@/components/ai/pilot/pilot-modal';
import { AnneProvider, AnneAssistant } from '@/components/anne';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

export default function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Carica il tipo di account e ruolo
  useEffect(() => {
    async function loadUserInfo() {
      if (session?.user?.email) {
        try {
          const response = await fetch('/api/user/info');
          if (response.ok) {
            const data = await response.json();
            const userData = data.user || data;
            setAccountType(userData.account_type || null);
            setUserRole(userData.role || null);
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
    effectiveUserRole === 'superadmin' ? 'admin' : 
    (effectiveUserRole === 'admin' ? 'admin' : 'user');

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
    </AnneProvider>
  );
}
