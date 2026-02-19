/**
 * Dashboard: Gestione Listini (Unified)
 *
 * Pagina unificata per admin e superadmin:
 * - Tab "Listini Prezzi" (admin + superadmin): CRUD, sync Spedisci.Online
 * - Tab "Listini Master" (solo superadmin): template globali, clone, assign
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QueryProvider } from '@/components/providers/query-provider';
import { PriceListsTab } from '@/components/listini/price-lists-tab';
import { MasterPriceListsTab } from '@/components/listini/master-price-lists-tab';
import { isSuperAdminCheck } from '@/lib/auth-helpers';

export default function UnifiedPriceListsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accountType, setAccountType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'master' ? 'master' : 'prezzi'
  );

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    window.history.replaceState({}, '', url.toString());
  };

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session) {
      router.push('/login');
      return;
    }

    async function checkPermissions() {
      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          const userAccountType = userData.account_type || userData.accountType;
          setAccountType(userAccountType);

          if (userAccountType !== 'superadmin' && userAccountType !== 'admin') {
            router.push('/dashboard?error=unauthorized');
            return;
          }
        }
      } catch (error) {
        console.error('Errore verifica permessi:', error);
        router.push('/dashboard?error=unauthorized');
      } finally {
        setIsLoading(false);
      }
    }

    checkPermissions();
  }, [session, status, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Verifica permessi...</p>
        </div>
      </div>
    );
  }

  if (!accountType || (accountType !== 'superadmin' && accountType !== 'admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
          <p className="text-gray-600">
            Solo admin e superadmin possono accedere a questa sezione.
          </p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = isSuperAdminCheck({ account_type: accountType });

  return (
    <QueryProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav
            title="Gestione Listini"
            subtitle="Gestisci listini prezzi, template e assegnazioni"
          />

          {isSuperAdmin ? (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
              <TabsList>
                <TabsTrigger value="prezzi">Listini Prezzi</TabsTrigger>
                <TabsTrigger value="master">Listini Master</TabsTrigger>
              </TabsList>
              <TabsContent value="prezzi" className="mt-6">
                <PriceListsTab />
              </TabsContent>
              <TabsContent value="master" className="mt-6">
                <MasterPriceListsTab />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="mt-6">
              <PriceListsTab />
            </div>
          )}
        </div>
      </div>
    </QueryProvider>
  );
}
