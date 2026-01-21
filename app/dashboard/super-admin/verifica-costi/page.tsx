'use client';

/**
 * Dashboard SuperAdmin: Verifica Costi
 *
 * Mostra tutte le differenze rilevate tra prezzi DB (listino master) e API reali
 * Permette di sincronizzare listini quando necessario
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import DashboardNav from '@/components/dashboard-nav';
import { toast } from 'sonner';

interface CostValidation {
  id: string;
  shipment_id: string;
  tracking_number: string;
  db_price: number;
  api_price: number;
  price_difference: number;
  price_difference_percent: number;
  requires_attention: boolean;
  courier_code: string;
  contract_code: string;
  weight: number;
  destination_zip: string;
  destination_province: string;
  listino_synced: boolean;
  created_at: string;
}

export default function VerificaCostiPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [validations, setValidations] = useState<CostValidation[]>([]);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // Verifica permessi superadmin
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' || !session) {
      router.push('/login');
      return;
    }

    async function checkSuperAdmin() {
      try {
        const response = await fetch('/api/user/info');
        if (response.ok) {
          const data = await response.json();
          const userData = data.user || data;
          const accountType = userData.account_type || userData.accountType;

          if (accountType === 'superadmin') {
            setIsAuthorized(true);
          } else {
            router.push('/dashboard?error=unauthorized');
            return;
          }
        } else {
          router.push('/dashboard?error=unauthorized');
          return;
        }
      } catch (error) {
        console.error('Errore verifica superadmin:', error);
        router.push('/dashboard?error=unauthorized');
        return;
      } finally {
        setIsLoading(false);
      }
    }

    checkSuperAdmin();
  }, [session, status, router]);

  // Carica validazioni
  useEffect(() => {
    if (isAuthorized) {
      loadValidations();
    }
  }, [isAuthorized]);

  async function loadValidations() {
    try {
      const response = await fetch('/api/super-admin/cost-validations');
      if (response.ok) {
        const data = await response.json();
        setValidations(data.validations || []);
      } else {
        toast.error('Errore caricamento validazioni');
      }
    } catch (error: any) {
      console.error('Errore caricamento validazioni:', error);
      toast.error('Errore caricamento validazioni');
    }
  }

  async function syncPriceList(validationId: string, priceListId: string) {
    try {
      setIsSyncing(validationId);
      const response = await fetch('/api/super-admin/sync-price-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceListId }),
      });

      if (response.ok) {
        toast.success('Listino sincronizzato con successo');
        // Aggiorna validazione
        setValidations((prev) =>
          prev.map((v) =>
            v.id === validationId
              ? { ...v, listino_synced: true, synced_at: new Date().toISOString() }
              : v
          )
        );
      } else {
        const error = await response.json();
        toast.error(error.error || 'Errore sincronizzazione');
      }
    } catch (error: any) {
      console.error('Errore sync:', error);
      toast.error('Errore sincronizzazione');
    } finally {
      setIsSyncing(null);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/10 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  const requiresAttention = validations.filter((v) => v.requires_attention);
  const synced = validations.filter((v) => v.listino_synced);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-amber-50/10">
      <DashboardNav />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-orange-600" />
            <h1 className="text-3xl font-bold text-gray-900">Verifica Costi</h1>
          </div>
          <p className="text-gray-600">Confronto tra prezzi DB (listino master) e API reali</p>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-1">Totale Validazioni</div>
            <div className="text-2xl font-bold text-gray-900">{validations.length}</div>
          </div>
          <div className="bg-red-50 rounded-lg border border-red-200 p-4">
            <div className="text-sm text-red-600 mb-1">Richiedono Attenzione</div>
            <div className="text-2xl font-bold text-red-700">{requiresAttention.length}</div>
          </div>
          <div className="bg-green-50 rounded-lg border border-green-200 p-4">
            <div className="text-sm text-green-600 mb-1">Listini Sincronizzati</div>
            <div className="text-2xl font-bold text-green-700">{synced.length}</div>
          </div>
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <div className="text-sm text-blue-600 mb-1">Differenza Media</div>
            <div className="text-2xl font-bold text-blue-700">
              {validations.length > 0
                ? (
                    validations.reduce((sum, v) => sum + Math.abs(v.price_difference_percent), 0) /
                    validations.length
                  ).toFixed(1)
                : '0.0'}
              %
            </div>
          </div>
        </div>

        {/* Tabella validazioni */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Differenze Rilevate</h2>
            <Button
              onClick={loadValidations}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Aggiorna
            </Button>
          </div>

          {validations.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600">Nessuna differenza rilevata</p>
              <p className="text-sm text-gray-500 mt-2">
                Tutti i prezzi DB corrispondono ai prezzi API
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Tracking
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Corriere
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Prezzo DB
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Prezzo API
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Differenza
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Stato
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {validations.map((validation) => (
                    <tr
                      key={validation.id}
                      className={
                        validation.requires_attention
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'hover:bg-gray-50'
                      }
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {validation.tracking_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {validation.courier_code.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        €{validation.db_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-700">
                        €{validation.api_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span
                          className={
                            validation.price_difference_percent > 0
                              ? 'text-red-600 font-semibold'
                              : 'text-green-600 font-semibold'
                          }
                        >
                          {validation.price_difference_percent > 0 ? '+' : ''}
                          {validation.price_difference_percent.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {validation.requires_attention ? (
                          <Badge variant="error">Richiede Attenzione</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                        {validation.listino_synced && (
                          <Badge variant="outline" className="ml-2">
                            Sincronizzato
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {validation.requires_attention && !validation.listino_synced && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // TODO: Implementare sync listino
                              toast.info('Funzionalità in sviluppo');
                            }}
                            disabled={isSyncing === validation.id}
                          >
                            {isSyncing === validation.id ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Sincronizzazione...
                              </>
                            ) : (
                              'Sincronizza Listino'
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
