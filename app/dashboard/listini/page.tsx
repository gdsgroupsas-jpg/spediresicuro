/**
 * Dashboard: Gestione Listini Prezzi
 * 
 * Interfaccia completa per gestire listini prezzi con:
 * - Visualizzazione listini esistenti
 * - Creazione/modifica listini
 * - Editor regole PriceRule
 * - Caricamento tariffe (CSV, Excel, PDF, OCR)
 * - Assegnazione listini a utenti
 * - Audit e reporting
 */

'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { 
  FileText, 
  Plus, 
  Upload, 
  Search, 
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Download,
  Eye,
  Users,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import DashboardNav from '@/components/dashboard-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { QueryProvider } from '@/components/providers/query-provider'
import { listPriceListsAction, createPriceListAction } from '@/actions/price-lists'
import { formatCurrency, formatDate } from '@/lib/utils'
import { SyncSpedisciOnlineDialog } from '@/components/listini/sync-spedisci-online-dialog'

interface PriceList {
  id: string
  name: string
  version: string
  status: 'draft' | 'active' | 'archived'
  priority: 'global' | 'partner' | 'client' | 'default'
  is_global: boolean
  courier?: { name: string; code: string }
  usage_count?: number
  last_used_at?: string
  created_at: string
  valid_from?: string
  valid_until?: string
}

export default function PriceListsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'active' | 'archived'>('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showSyncDialog, setShowSyncDialog] = useState(false)
  const [accountType, setAccountType] = useState<string | null>(null)

  // Verifica permessi superadmin/admin
  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated' || !session) {
      router.push('/login')
      return
    }

    async function checkPermissions() {
      try {
        const response = await fetch('/api/user/info')
        if (response.ok) {
          const data = await response.json()
          const userData = data.user || data
          const userAccountType = userData.account_type || userData.accountType
          setAccountType(userAccountType)
          
          // Superadmin e admin hanno sempre accesso
          if (userAccountType !== 'superadmin' && userAccountType !== 'admin') {
            router.push('/dashboard?error=unauthorized')
            return
          }
        }
      } catch (error) {
        console.error('Errore verifica permessi:', error)
        router.push('/dashboard?error=unauthorized')
      }
    }

    checkPermissions()
  }, [session, status, router])

  useEffect(() => {
    if (accountType === 'superadmin' || accountType === 'admin') {
      loadPriceLists()
    }
  }, [statusFilter, accountType])

  async function loadPriceLists() {
    try {
      setIsLoading(true)
      const result = await listPriceListsAction({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })

      if (result.success && result.priceLists) {
        setPriceLists(result.priceLists as PriceList[])
      } else {
        toast.error(result.error || 'Errore nel caricamento listini')
      }
    } catch (error: any) {
      toast.error('Errore imprevisto')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredLists = priceLists.filter(list => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        list.name.toLowerCase().includes(query) ||
        list.version.toLowerCase().includes(query) ||
        list.courier?.name?.toLowerCase().includes(query)
      )
    }
    return true
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Attivo</Badge>
      case 'draft':
        return <Badge variant="secondary">Bozza</Badge>
      case 'archived':
        return <Badge variant="error">Archiviato</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'global':
        return <Badge variant="warning">Globale</Badge>
      case 'partner':
        return <Badge variant="default">Partner</Badge>
      case 'client':
        return <Badge variant="secondary">Cliente</Badge>
      default:
        return <Badge variant="outline">Default</Badge>
    }
  }

  return (
    <QueryProvider>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav
            title="Gestione Listini Prezzi"
            subtitle="Sistema avanzato di pricing con regole dinamiche - Crea, modifica e gestisci listini"
            actions={
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowSyncDialog(true)}
                  variant="outline"
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sincronizza da Spedisci.Online
                </Button>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nuovo Listino
                </Button>
              </div>
            }
          />

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Totale Listini</span>
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{priceLists.length}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Attivi</span>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {priceLists.filter(l => l.status === 'active').length}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Utilizzi Totali</span>
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {priceLists.reduce((sum, l) => sum + (l.usage_count || 0), 0)}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Listini Globali</span>
                <Sparkles className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {priceLists.filter(l => l.is_global).length}
              </div>
            </div>
          </div>

          {/* Filtri e Ricerca */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Cerca listino..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-40"
              >
                <option value="all">Tutti gli stati</option>
                <option value="active">Attivi</option>
                <option value="draft">Bozze</option>
                <option value="archived">Archiviati</option>
              </Select>
            </div>
          </div>

          {/* Tabella Listini */}
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
              <p className="text-gray-600">Caricamento listini...</p>
            </div>
          ) : filteredLists.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
              <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nessun listino trovato</h3>
              <p className="text-gray-600 mb-6">
                {searchQuery ? 'Prova a modificare i filtri di ricerca' : 'Crea il primo listino per iniziare'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crea Primo Listino
                </Button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Listino</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Corriere</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Stato</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priorità</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Utilizzi</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Validità</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLists.map((list) => (
                      <tr key={list.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">{list.name}</div>
                            <div className="text-sm text-gray-500">v{list.version}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {list.courier ? (
                            <div className="text-sm text-gray-900">{list.courier.name}</div>
                          ) : (
                            <Badge variant="outline">Multi-corriere</Badge>
                          )}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(list.status)}</td>
                        <td className="px-6 py-4">{getPriorityBadge(list.priority)}</td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">{list.usage_count || 0}</div>
                          {list.last_used_at && (
                            <div className="text-xs text-gray-500">
                              {formatDate(list.last_used_at)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {list.valid_from ? formatDate(list.valid_from) : '-'}
                          </div>
                          {list.valid_until && (
                            <div className="text-xs text-gray-500">
              fino a {formatDate(list.valid_until)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => router.push(`/dashboard/listini/${list.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Dialog Sincronizzazione Spedisci.Online */}
          <SyncSpedisciOnlineDialog
            open={showSyncDialog}
            onOpenChange={setShowSyncDialog}
            onSyncComplete={() => {
              loadPriceLists();
            }}
          />

          {/* Dialog Creazione Listino */}
          {showCreateDialog && (
            <CreatePriceListDialog
              isOpen={showCreateDialog}
              onClose={() => setShowCreateDialog(false)}
              onSuccess={() => {
                setShowCreateDialog(false)
                loadPriceLists()
              }}
            />
          )}
        </div>
      </div>
    </QueryProvider>
  )
}

// Componente Dialog Creazione Listino Completo
function CreatePriceListDialog({ isOpen, onClose, onSuccess }: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [name, setName] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft')
  const [priority, setPriority] = useState<'global' | 'partner' | 'client' | 'default'>('default')
  const [courierId, setCourierId] = useState<string>('')
  const [isGlobal, setIsGlobal] = useState(false)
  const [description, setDescription] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couriers, setCouriers] = useState<any[]>([])

  // Carica corrieri disponibili
  useEffect(() => {
    if (isOpen) {
      loadCouriers()
    }
  }, [isOpen])

  async function loadCouriers() {
    try {
      // Prova API couriers, altrimenti usa lista hardcoded
      try {
        const response = await fetch('/api/couriers')
        if (response.ok) {
          const data = await response.json()
          setCouriers(data.couriers || data || [])
          return
        }
      } catch (apiError) {
        console.warn('API couriers non disponibile, uso lista default')
      }
      
      // Fallback: lista corrieri comuni
      setCouriers([
        { id: 'bartolini', name: 'Bartolini', code: 'BRT' },
        { id: 'dhl', name: 'DHL', code: 'DHL' },
        { id: 'gls', name: 'GLS', code: 'GLS' },
        { id: 'sda', name: 'SDA', code: 'SDA' },
        { id: 'ups', name: 'UPS', code: 'UPS' },
        { id: 'fedex', name: 'FedEx', code: 'FEDEX' },
      ])
    } catch (error) {
      console.error('Errore caricamento corrieri:', error)
      // Fallback lista vuota
      setCouriers([])
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('Il nome del listino è obbligatorio')
      return
    }

    if (!version.trim()) {
      setError('La versione è obbligatoria')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const result = await createPriceListAction({
        name: name.trim(),
        version: version.trim(),
        status,
        priority,
        courier_id: courierId || undefined,
        is_global: isGlobal,
        description: description.trim() || undefined,
        valid_from: validFrom || undefined,
        valid_until: validUntil || undefined,
      })

      if (result.success) {
        toast.success('Listino creato con successo!')
        // Reset form
        setName('')
        setVersion('1.0.0')
        setStatus('draft')
        setPriority('default')
        setCourierId('')
        setIsGlobal(false)
        setDescription('')
        setValidFrom('')
        setValidUntil('')
        onSuccess()
      } else {
        setError(result.error || 'Errore durante la creazione del listino')
        toast.error(result.error || 'Errore durante la creazione del listino')
      }
    } catch (error: any) {
      setError(error.message || 'Errore sconosciuto')
      toast.error('Errore durante la creazione del listino')
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Listino Prezzi</DialogTitle>
          <DialogDescription>
            Crea un nuovo listino con sistema PriceRule avanzato
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Nome Listino */}
          <div>
            <Label htmlFor="name">Nome Listino *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Es: Listino Standard 2025"
              className="mt-1"
            />
          </div>

          {/* Versione */}
          <div>
            <Label htmlFor="version">Versione *</Label>
            <Input
              id="version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="Es: 1.0.0"
              className="mt-1"
            />
          </div>

          {/* Status e Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Stato</Label>
              <Select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'draft' | 'active' | 'archived')}
              >
                <option value="draft">Bozza</option>
                <option value="active">Attivo</option>
                <option value="archived">Archiviato</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priorità</Label>
              <Select
                id="priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'global' | 'partner' | 'client' | 'default')}
              >
                <option value="default">Default</option>
                <option value="client">Cliente</option>
                <option value="partner">Partner</option>
                <option value="global">Globale</option>
              </Select>
            </div>
          </div>

          {/* Corriere */}
          <div>
            <Label htmlFor="courier">Corriere (opzionale)</Label>
            <Select
              id="courier"
              value={courierId}
              onChange={(e) => setCourierId(e.target.value)}
            >
              <option value="">Nessuno (Multi-corriere)</option>
              {couriers.map((courier) => (
                <option key={courier.id} value={courier.id}>
                  {courier.name} ({courier.code})
                </option>
              ))}
            </Select>
          </div>

          {/* Global */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isGlobal"
              checked={isGlobal}
              onChange={(e) => setIsGlobal(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="isGlobal" className="cursor-pointer">
              Listino globale (visibile a tutti gli utenti)
            </Label>
          </div>

          {/* Date validità */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="validFrom">Valido dal (opzionale)</Label>
              <Input
                id="validFrom"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="validUntil">Valido fino a (opzionale)</Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          {/* Descrizione */}
          <div>
            <Label htmlFor="description">Descrizione (opzionale)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrizione del listino..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isCreating}>
            Annulla
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim() || !version.trim()}>
            {isCreating ? 'Creazione...' : 'Crea Listino'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
