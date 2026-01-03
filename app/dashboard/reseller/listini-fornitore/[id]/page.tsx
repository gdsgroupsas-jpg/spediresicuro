/**
 * Pagina Dettaglio Listino Fornitore per Reseller
 * 
 * Visualizza il listino con le sue righe (entries) in formato tabellare
 * Dati basati su peso in kg e prezzi
 */

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Package,
  MapPin,
  Truck,
  Calendar,
  Info,
  Edit,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import DashboardNav from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getPriceListByIdAction } from '@/actions/price-lists'
import type { PriceList, PriceListEntry } from '@/types/listini'

// Formatta valuta
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

// Formatta data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// Badge status
function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    draft: { label: 'Bozza', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    active: { label: 'Attivo', className: 'bg-green-100 text-green-700 border-green-200' },
    archived: { label: 'Archiviato', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

// Badge tipo servizio
function getServiceTypeBadge(serviceType: string) {
  const serviceConfig: Record<string, { label: string; className: string }> = {
    standard: { label: 'Standard', className: 'bg-blue-100 text-blue-700' },
    express: { label: 'Express', className: 'bg-purple-100 text-purple-700' },
    economy: { label: 'Economy', className: 'bg-green-100 text-green-700' },
    same_day: { label: 'Same Day', className: 'bg-red-100 text-red-700' },
    next_day: { label: 'Next Day', className: 'bg-orange-100 text-orange-700' },
  };

  const config = serviceConfig[serviceType] || serviceConfig.standard;

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

export default function PriceListDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const [priceList, setPriceList] = useState<PriceList | null>(null)
  const [entries, setEntries] = useState<PriceListEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      loadPriceList(params.id as string)
    }
  }, [params.id])

  async function loadPriceList(id: string) {
    try {
      setIsLoading(true)
      const result = await getPriceListByIdAction(id)
      
      if (result.success && result.priceList) {
        const list = result.priceList as PriceList & { entries?: PriceListEntry[] }
        setPriceList(list)
        setEntries(list.entries || [])
      } else {
        toast.error(result.error || 'Listino non trovato')
        router.push('/dashboard/reseller/listini-fornitore')
      }
    } catch (error: any) {
      toast.error('Errore caricamento listino')
      console.error(error)
      router.push('/dashboard/reseller/listini-fornitore')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Caricamento listino...</p>
        </div>
      </div>
    )
  }

  if (!priceList) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav
        title="Dettaglio Listino"
        subtitle={priceList.name}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header con Back */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard/reseller/listini-fornitore')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Torna ai Listini
          </Button>
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{priceList.name}</h1>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Truck className="w-4 h-4" />
                    {priceList.courier?.name || 'Corriere non specificato'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Creato: {formatDate(priceList.created_at)}
                  </span>
                  <span>Versione: {priceList.version}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(priceList.status)}
            </div>
          </div>

          {priceList.description && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-gray-400 mt-0.5" />
                <p className="text-sm text-gray-600">{priceList.description}</p>
              </div>
            </div>
          )}

          {/* Statistiche */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Righe Tariffe</p>
              <p className="text-2xl font-bold text-blue-900">{entries.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Margine Default</p>
              <p className="text-2xl font-bold text-green-900">
                {priceList.default_margin_percent ? `${priceList.default_margin_percent}%` : '-'}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Tipo</p>
              <p className="text-2xl font-bold text-purple-900 capitalize">
                {priceList.list_type || 'supplier'}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-600 font-medium">Fonte</p>
              <p className="text-2xl font-bold text-orange-900 capitalize">
                {priceList.source_type || 'manual'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabella Entries */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tariffe per Peso e Zona</h2>
            <p className="text-sm text-gray-500">Prezzi base per fascia di peso (kg) e zona geografica</p>
          </div>

          {entries.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Nessuna tariffa nel listino</p>
              <p className="text-sm text-gray-500">
                Le tariffe vengono aggiunte durante la sincronizzazione da Spedisci.Online
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Peso (kg)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Zona
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Servizio
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prezzo Base
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fuel %
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contrassegno
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assicurazione %
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {entries.map((entry, index) => (
                    <tr key={entry.id || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {entry.weight_from} - {entry.weight_to} kg
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">
                            {entry.zone_code || entry.region || entry.province_code || 'Tutte'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getServiceTypeBadge(entry.service_type)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(entry.base_price)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                        {entry.fuel_surcharge_percent ? `${entry.fuel_surcharge_percent.toFixed(2)}%` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                        {entry.cash_on_delivery_surcharge ? formatCurrency(entry.cash_on_delivery_surcharge) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-600">
                        {entry.insurance_rate_percent ? `${entry.insurance_rate_percent.toFixed(2)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Note e Info Aggiuntive */}
        {priceList.notes && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Note</h3>
            <p className="text-gray-600 whitespace-pre-wrap">{priceList.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
