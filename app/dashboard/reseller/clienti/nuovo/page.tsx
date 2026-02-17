'use client';

/**
 * Pagina Unificata: Creazione Nuovo Utente
 *
 * Wizard intelligente che si adatta al ruolo dell'utente:
 * - SuperAdmin: Può creare Reseller OPPURE Cliente (selezionando reseller)
 * - Reseller/Admin: Può creare solo Clienti (sotto di sé)
 *
 * Features:
 * - Wizard multi-step dinamico
 * - Creazione atomica con ownership
 * - Privacy totale tra reseller
 * - UX ottimizzata per ogni ruolo
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, UserPlus, ShieldAlert, Store } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { OnboardingWizard } from '@/components/onboarding';
import type {
  AssignablePriceList,
  AvailableReseller,
  WizardMode,
} from '@/components/onboarding/types';
import { getAssignablePriceListsAction } from '@/actions/price-lists';

type UserRole = 'superadmin' | 'reseller' | 'admin' | 'user';

export default function NuovoUtentePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isCheckingRole, setIsCheckingRole] = useState(true);

  // Rileva il ruolo dell'utente
  useEffect(() => {
    async function checkUserRole() {
      if (status === 'loading') return;

      if (!session?.user?.email) {
        router.push('/login');
        return;
      }

      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          const accountType = userData.account_type || userData.accountType;

          if (accountType === 'superadmin') {
            setUserRole('superadmin');
          } else if (accountType === 'admin' || userData.is_reseller === true) {
            setUserRole('reseller');
          } else {
            setUserRole('user');
          }
        } else {
          setUserRole('user');
        }
      } catch (error) {
        console.error('Errore verifica ruolo:', error);
        setUserRole('user');
      } finally {
        setIsCheckingRole(false);
      }
    }

    checkUserRole();
  }, [session, status, router]);

  /**
   * Carica listini disponibili per assegnazione
   */
  const handleLoadPriceLists = useCallback(async (): Promise<AssignablePriceList[]> => {
    try {
      const result = await getAssignablePriceListsAction({ status: 'active' });
      if (result.success && result.priceLists) {
        return result.priceLists.map((pl) => ({
          id: pl.id,
          name: pl.name,
          description: pl.description,
          courier_id: pl.courier_id,
          courier_name: pl.courier_name,
          list_type: pl.list_type,
          status: pl.status,
          default_margin_percent: pl.default_margin_percent,
        }));
      }
      return [];
    } catch (error) {
      console.error('Errore caricamento listini:', error);
      return [];
    }
  }, []);

  /**
   * Carica reseller disponibili (solo per superadmin)
   */
  const handleLoadResellers = useCallback(async (): Promise<AvailableReseller[]> => {
    try {
      const response = await fetch('/api/superadmin/resellers');
      if (response.ok) {
        const data = await response.json();
        return (data.resellers || []).map((r: any) => ({
          id: r.id,
          name: r.name || r.full_name || 'Reseller',
          email: r.email,
          company_name: r.company_name,
        }));
      }
      return [];
    } catch (error) {
      console.error('Errore caricamento reseller:', error);
      return [];
    }
  }, []);

  const handleComplete = (data: {
    userCreationType?: 'cliente' | 'reseller';
    clientId?: string;
    generatedPassword?: string;
    priceListId?: string;
    parentResellerId?: string;
  }) => {
    const isResellerCreation = data.userCreationType === 'reseller';
    const messages: string[] = [];

    if (data.generatedPassword) {
      messages.push('Credenziali generate');
    }
    if (data.priceListId) {
      messages.push('Listino assegnato');
    }
    if (data.parentResellerId) {
      messages.push('Assegnato a reseller');
    }

    const entityName = isResellerCreation ? 'Reseller' : 'Cliente';
    const message =
      messages.length > 0
        ? `${entityName} creato con successo! ${messages.join(' | ')}`
        : `${entityName} creato con successo!`;

    toast.success(message, { duration: 5000 });

    // Redirect dopo un breve delay per mostrare credenziali
    setTimeout(() => {
      if (userRole === 'superadmin') {
        router.push('/dashboard/reseller-team');
      } else {
        router.push('/dashboard/reseller/clienti');
      }
    }, 3000);
  };

  const handleCancel = () => {
    if (userRole === 'superadmin') {
      router.push('/dashboard/reseller-team');
    } else {
      router.push('/dashboard/reseller/clienti');
    }
  };

  // Determina il mode del wizard in base al ruolo
  const getWizardMode = (): WizardMode => {
    if (userRole === 'superadmin') return 'superadmin';
    return 'reseller';
  };

  // Loading state
  if (status === 'loading' || isCheckingRole) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FACC15] mb-4" />
          <p className="text-gray-400">Verifica permessi...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Accesso Richiesto</h1>
          <p className="text-gray-400 mb-6">
            Devi effettuare il login per accedere a questa pagina.
          </p>
          <Button onClick={() => router.push('/login')} variant="outline">
            Vai al Login
          </Button>
        </div>
      </div>
    );
  }

  // Access denied for regular users
  if (userRole === 'user') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Accesso Negato</h1>
          <p className="text-gray-400 mb-6">
            Non hai i permessi per creare nuovi utenti. Questa funzione è riservata a Reseller e
            SuperAdmin.
          </p>
          <Button onClick={() => router.push('/dashboard')} variant="outline">
            Torna alla Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Contenuto header dinamico
  const isSuperAdmin = userRole === 'superadmin';
  const headerTitle = isSuperAdmin ? 'Crea Nuovo Utente' : 'Crea Nuovo Cliente';
  const headerSubtitle = isSuperAdmin
    ? 'Puoi creare un nuovo Reseller o un nuovo Cliente da assegnare a un reseller esistente.'
    : "Compila i dati per creare un nuovo cliente. Può essere una persona fisica o un'azienda.";
  const backButtonText = isSuperAdmin ? 'Torna alla Gestione' : 'Torna ai Clienti';
  const HeaderIcon = isSuperAdmin ? Store : UserPlus;
  const headerGradient = isSuperAdmin
    ? 'from-purple-500 to-indigo-600'
    : 'from-[#FACC15] to-[#F59E0B]';

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-200 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backButtonText}
          </Button>

          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${headerGradient} flex items-center justify-center shadow-lg`}
            >
              <HeaderIcon className={`w-7 h-7 ${isSuperAdmin ? 'text-white' : 'text-black'}`} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">{headerTitle}</h1>
              <p className="text-gray-400">{headerSubtitle}</p>
            </div>
          </div>
        </div>

        {/* Wizard Container */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 sm:p-8">
          <OnboardingWizard
            mode={getWizardMode()}
            onComplete={handleComplete}
            onCancel={handleCancel}
            onLoadPriceLists={handleLoadPriceLists}
            onLoadResellers={isSuperAdmin ? handleLoadResellers : undefined}
          />
        </div>

        {/* Info Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            I dati inseriti sono protetti e trattati secondo la normativa GDPR.
          </p>
        </div>
      </div>
    </div>
  );
}
