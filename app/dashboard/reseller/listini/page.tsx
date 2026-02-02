/**
 * Dashboard Reseller: Gestione Listini (Unified)
 *
 * Pagina unificata per reseller:
 * - Tab "Fornitore": listini fornitore propri
 * - Tab "Personalizzati": listini custom per clienti
 */

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Shield } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResellerFornitoreTab } from '@/components/listini/reseller-fornitore-tab';
import { ResellerPersonalizzatiTab } from '@/components/listini/reseller-personalizzati-tab';

export default function UnifiedResellerListiniPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accountType, setAccountType] = useState<string>('');
  const [resellerRole, setResellerRole] = useState<string>('');
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'personalizzati' ? 'personalizzati' : 'fornitore'
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

          if (!userData.is_reseller && userData.account_type !== 'byoc') {
            router.push('/dashboard?error=unauthorized');
            return;
          }

          setAccountType(userData.account_type || '');
          setResellerRole(userData.reseller_role || '');
          setIsAuthorized(true);
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
          <Loader2 className="h-12 w-12 animate-spin text-orange-600 mx-auto" />
          <p className="mt-4 text-gray-600">Verifica permessi...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
          <p className="text-gray-600">Solo i reseller possono accedere a questa sezione.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Gestione Listini"
        subtitle="Gestisci listini fornitore e personalizzati"
      />

      <div className="p-6 max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="fornitore">Listini Fornitore</TabsTrigger>
            <TabsTrigger value="personalizzati">Listini Personalizzati</TabsTrigger>
          </TabsList>
          <TabsContent value="fornitore" className="mt-6">
            <ResellerFornitoreTab accountType={accountType} resellerRole={resellerRole} />
          </TabsContent>
          <TabsContent value="personalizzati" className="mt-6">
            <ResellerPersonalizzatiTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
