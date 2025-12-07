/**
 * Dashboard Layout Client Component
 *
 * Componente client-side per gestire:
 * - AI Assistant modal globale
 * - Eventi personalizzati per aprire l'AI Assistant
 * - Session management
 */

'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { PilotModal } from '@/components/ai/pilot/pilot-modal';

interface DashboardLayoutClientProps {
  children: React.ReactNode;
}

export default function DashboardLayoutClient({ children }: DashboardLayoutClientProps) {
  const { data: session } = useSession();
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

  // Ascolta l'evento personalizzato per aprire l'AI Assistant
  useEffect(() => {
    const handleOpenAiAssistant = () => {
      setShowAiAssistant(true);
    };

    window.addEventListener('openAiAssistant', handleOpenAiAssistant);

    return () => {
      window.removeEventListener('openAiAssistant', handleOpenAiAssistant);
    };
  }, []);

  return (
    <>
      {children}

      {/* AI Assistant Modal - Globale */}
      {session?.user && (
        <PilotModal
          isOpen={showAiAssistant}
          onClose={() => setShowAiAssistant(false)}
          userId={session.user.id || ''}
          userRole={(accountType as 'admin' | 'user') || (userRole as 'admin' | 'user') || 'user'}
          userName={session.user.name || session.user.email || 'Utente'}
        />
      )}
    </>
  );
}
