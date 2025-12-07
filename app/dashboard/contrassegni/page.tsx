/**
 * Pagina: Gestione Contrassegni
 * 
 * Dashboard completa per gestire tutte le spedizioni con contrassegno:
 * - Verifica consegna
 * - Pagamento previsto
 * - Evasione contrassegno
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { DollarSign, Search, Filter, CheckCircle2, Clock, AlertCircle, Calendar, Package, Euro, Check, X } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { supabase } from '@/lib/db/client';
import { cn } from '@/lib/utils';
import { markContrassegnoInCarica, markContrassegnoEvaso } from '@/actions/contrassegni';

interface CashOnDeliveryShipment {
  id: string;
  tracking_number: string;
  recipient_name: string;
  recipient_city: string;
  cash_on_delivery_amount: number;
  status: string;
  delivered_at: string | null;
  created_at: string;
  shipped_at: string | null;
  // Calcolati
  paymentStatus: 'pending' | 'delivered' | 'payment_expected' | 'paid';
  expectedPaymentDate: string | null;
  daysSinceDelivery: number | null;
}

type FilterStatus = 'all' | 'pending' | 'delivered' | 'payment_expected' | 'paid' | 'in_carica' | 'evaso';

export default function ContrassegniPage() {
  const { data: session } = useSession();
  const [shipments, setShipments] = useState<CashOnDeliveryShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  useEffect(() => {
    if (session?.user?.email) {
      loadContrassegni();
    }
  }, [session]);

  async function loadContrassegni() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('cash_on_delivery', true)
        .eq('deleted', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calcola stati pagamento
      const enriched = (data || []).map((shipment: any) => {
        const contrassegnoInCarica = checkContrassegnoInCarica(shipment);
        const contrassegnoEvaso = checkContrassegnoEvaso(shipment);
        
        let paymentStatus = calculatePaymentStatus(shipment);
        // Override se già gestito manualmente
        if (contrassegnoEvaso) {
          paymentStatus = 'evaso';
        } else if (contrassegnoInCarica) {
          paymentStatus = 'in_carica';
        }
        
        const expectedPaymentDate = calculateExpectedPaymentDate(shipment);
        const daysSinceDelivery = shipment.delivered_at
          ? Math.floor((Date.now() - new Date(shipment.delivered_at).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          ...shipment,
          paymentStatus,
          expectedPaymentDate,
          daysSinceDelivery,
          contrassegnoInCarica,
          contrassegnoEvaso,
        };
      });

      setShipments(enriched);
    } catch (error: any) {
      console.error('Errore caricamento contrassegni:', error);
    } finally {
      setLoading(false);
    }
  }

  // Verifica se contrassegno è in carica
  function checkContrassegnoInCarica(shipment: any): boolean {
    if (!shipment.internal_notes) return false;
    return shipment.internal_notes.includes('Contrassegno preso in carica');
  }

  // Verifica se contrassegno è evaso
  function checkContrassegnoEvaso(shipment: any): boolean {
    if (shipment.notes && shipment.notes.includes('CONTRASSEGNO EVASO')) return true;
    if (shipment.internal_notes && shipment.internal_notes.includes('Contrassegno EVASO')) return true;
    return false;
  }

  // Calcola stato pagamento
  function calculatePaymentStatus(shipment: any): CashOnDeliveryShipment['paymentStatus'] {
    if (shipment.status === 'delivered' && shipment.delivered_at) {
      const daysSince = Math.floor(
        (Date.now() - new Date(shipment.delivered_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      // Se passati più di 7 giorni dalla consegna, consideralo pagato (o da verificare)
      if (daysSince > 7) {
        return 'paid'; // Assumiamo pagato dopo 7 giorni (puoi aggiungere campo esplicito nel DB)
      }
      
      // Se consegnato da meno di 7 giorni, pagamento previsto
      return 'payment_expected';
    }
    
    if (shipment.status === 'delivered') {
      return 'delivered';
    }
    
    return 'pending';
  }

  // Calcola data prevista pagamento (solitamente 3-5 giorni lavorativi dopo consegna)
  function calculateExpectedPaymentDate(shipment: any): string | null {
    if (!shipment.delivered_at) return null;
    
    const deliveredDate = new Date(shipment.delivered_at);
    // Aggiungi 5 giorni lavorativi (circa 7 giorni calendario)
    const expectedDate = new Date(deliveredDate);
    expectedDate.setDate(expectedDate.getDate() + 7);
    
    return expectedDate.toISOString();
  }

  // Filtra spedizioni
  const filteredShipments = useMemo(() => {
    let filtered = shipments;

    // Filtro per stato
    if (filterStatus !== 'all') {
      filtered = filtered.filter((s) => s.paymentStatus === filterStatus);
    }

    // Filtro per ricerca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.tracking_number?.toLowerCase().includes(term) ||
          s.recipient_name?.toLowerCase().includes(term) ||
          s.recipient_city?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [shipments, filterStatus, searchTerm]);

  // Statistiche
  const stats = useMemo(() => {
    const total = shipments.length;
    const pending = shipments.filter((s) => s.paymentStatus === 'pending').length;
    const delivered = shipments.filter((s) => s.paymentStatus === 'delivered').length;
    const paymentExpected = shipments.filter((s) => s.paymentStatus === 'payment_expected').length;
    const paid = shipments.filter((s) => s.paymentStatus === 'paid').length;
    const totalAmount = shipments.reduce((sum, s) => sum + (s.cash_on_delivery_amount || 0), 0);
    const pendingAmount = shipments
      .filter((s) => s.paymentStatus === 'payment_expected' || s.paymentStatus === 'delivered')
      .reduce((sum, s) => sum + (s.cash_on_delivery_amount || 0), 0);

    return {
      total,
      pending,
      delivered,
      paymentExpected,
      paid,
      totalAmount,
      pendingAmount,
      inCarica,
      evaso,
    };
  }, [shipments]);

  // Gestisci azioni
  async function handlePresoInCarica(shipmentId: string) {
    setProcessingId(shipmentId);
    try {
      const result = await markContrassegnoInCarica(shipmentId);
      if (result.success) {
        await loadContrassegni(); // Ricarica lista
      } else {
        alert(`Errore: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Errore: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleEvaso(shipmentId: string) {
    setProcessingId(shipmentId);
    try {
      const result = await markContrassegnoEvaso(shipmentId);
      if (result.success) {
        await loadContrassegni(); // Ricarica lista
      } else {
        alert(`Errore: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Errore: ${error.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  const getStatusBadge = (status: CashOnDeliveryShipment['paymentStatus']) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3" />
            Evaso
          </span>
        );
      case 'payment_expected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3" />
            Pagamento Previsto
          </span>
        );
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Package className="w-3 h-3" />
            Consegnata
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <AlertCircle className="w-3 h-3" />
            In Attesa
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Gestione Contrassegni"
        subtitle="Monitora e gestisci tutte le spedizioni con contrassegno"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Totale Contrassegni</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Valore totale: €{stats.totalAmount.toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Attesa Pagamento</p>
                <p className="text-2xl font-bold text-gray-900">{stats.paymentExpected}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Importo: €{stats.pendingAmount.toFixed(2)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Evaso</p>
                <p className="text-2xl font-bold text-gray-900">{stats.paid}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Attesa Consegna</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
              </div>
              <Package className="w-8 h-8 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Filtri e ricerca */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Ricerca */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cerca per tracking, destinatario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Filtri stato */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('all')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  filterStatus === 'all'
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Tutti
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  filterStatus === 'pending'
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                In Attesa
              </button>
              <button
                onClick={() => setFilterStatus('delivered')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  filterStatus === 'delivered'
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Consegnate
              </button>
              <button
                onClick={() => setFilterStatus('payment_expected')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  filterStatus === 'payment_expected'
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Pagamento Previsto
              </button>
              <button
                onClick={() => setFilterStatus('in_carica')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  filterStatus === 'in_carica'
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                In Carica
              </button>
              <button
                onClick={() => setFilterStatus('evaso')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  filterStatus === 'evaso'
                    ? "bg-orange-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                Evaso
              </button>
            </div>
          </div>
        </div>

        {/* Lista spedizioni */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : filteredShipments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun contrassegno trovato</h3>
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all'
                ? 'Nessun risultato per i filtri selezionati.'
                : 'Non ci sono spedizioni con contrassegno al momento.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tracking
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destinatario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Importo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato Consegna
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stato Pagamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data Consegna
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pagamento Previsto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredShipments.map((shipment) => (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {shipment.tracking_number}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{shipment.recipient_name}</div>
                        <div className="text-xs text-gray-500">{shipment.recipient_city}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm font-semibold text-gray-900">
                          <Euro className="w-4 h-4" />
                          {shipment.cash_on_delivery_amount?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                          shipment.status === 'delivered'
                            ? "bg-green-100 text-green-800"
                            : shipment.status === 'in_transit'
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        )}>
                          {shipment.status === 'delivered' ? 'Consegnata' : 
                           shipment.status === 'in_transit' ? 'In Transito' : 
                           shipment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(shipment.paymentStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shipment.delivered_at
                          ? new Date(shipment.delivered_at).toLocaleDateString('it-IT')
                          : shipment.shipped_at
                          ? `Spedita: ${new Date(shipment.shipped_at).toLocaleDateString('it-IT')}`
                          : 'Non ancora spedita'}
                        {shipment.daysSinceDelivery !== null && shipment.daysSinceDelivery > 0 && (
                          <div className="text-xs text-gray-400">
                            {shipment.daysSinceDelivery} giorni fa
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shipment.expectedPaymentDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(shipment.expectedPaymentDate).toLocaleDateString('it-IT')}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
