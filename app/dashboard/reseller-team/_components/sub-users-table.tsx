'use client'

import { useState, useMemo, useCallback } from 'react'
import { Users, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SearchInputDebounced } from '@/components/shared/search-input-debounced'
import { EmptyState } from '@/components/shared/empty-state'
import { DataTableSkeleton } from '@/components/shared/data-table-skeleton'

import { UserActionsMenu } from './user-actions-menu'
import { WalletRechargeDialog } from './wallet-recharge-dialog'

import { useSubUsers, useInvalidateSubUsers } from '@/lib/queries/use-sub-users'
import { formatCurrency, formatDate, formatRelativeDate, cn } from '@/lib/utils'
import { WALLET_THRESHOLDS } from '@/lib/validations/wallet-schema'

interface SubUser {
  id: string
  email: string
  name: string
  company_name: string | null
  phone: string | null
  wallet_balance: number
  created_at: string
}

type SortField = 'name' | 'wallet_balance' | 'created_at'
type SortOrder = 'asc' | 'desc'

const ITEMS_PER_PAGE = 50

export function SubUsersTable() {
  const { data: users = [], isLoading, error } = useSubUsers()
  const invalidate = useInvalidateSubUsers()

  // Filtri e ordinamento
  const [search, setSearch] = useState('')
  const [walletFilter, setWalletFilter] = useState<'all' | 'low' | 'high'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d' | '90d'>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)

  // Wallet dialog
  const [selectedUser, setSelectedUser] = useState<SubUser | null>(null)
  const [walletDialogOpen, setWalletDialogOpen] = useState(false)

  // Filtra utenti
  const filteredUsers = useMemo(() => {
    let result = [...users]

    // Ricerca
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower) ||
          u.company_name?.toLowerCase().includes(searchLower)
      )
    }

    // Filtro wallet
    if (walletFilter === 'low') {
      result = result.filter((u) => u.wallet_balance < WALLET_THRESHOLDS.LOW)
    } else if (walletFilter === 'high') {
      result = result.filter((u) => u.wallet_balance >= WALLET_THRESHOLDS.HIGH)
    }

    // Filtro data
    if (dateFilter !== 'all') {
      const now = new Date()
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 }
      const days = daysMap[dateFilter]
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      result = result.filter((u) => new Date(u.created_at) >= cutoff)
    }

    // Ordinamento
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'wallet_balance':
          comparison = a.wallet_balance - b.wallet_balance
          break
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [users, search, walletFilter, dateFilter, sortField, sortOrder])

  // Paginazione
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredUsers.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredUsers, currentPage])

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }, [])

  const handleRechargeWallet = (user: SubUser) => {
    setSelectedUser(user)
    setWalletDialogOpen(true)
  }

  const handleWalletSuccess = () => {
    invalidate()
    toast.success('Wallet aggiornato con successo')
  }

  const isNewUser = (createdAt: string) => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return new Date(createdAt) >= sevenDaysAgo
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-30" />
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1 text-[#FF9500]" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 text-[#FF9500]" />
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">Errore nel caricamento dei clienti</p>
        <Button variant="outline" onClick={() => invalidate()} className="mt-4">
          Riprova
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtri */}
      <div className="flex flex-wrap gap-4">
        <SearchInputDebounced
          onSearch={handleSearch}
          placeholder="Cerca per nome o email..."
          className="w-full sm:w-64"
        />

        <Select
          value={walletFilter}
          onChange={(e) => {
            setWalletFilter(e.target.value as typeof walletFilter)
            setCurrentPage(1)
          }}
          className="w-full sm:w-40"
        >
          <option value="all">Tutti i saldi</option>
          <option value="low">Saldo basso (&lt; {WALLET_THRESHOLDS.LOW}€)</option>
          <option value="high">Saldo alto (&gt; {WALLET_THRESHOLDS.HIGH}€)</option>
        </Select>

        <Select
          value={dateFilter}
          onChange={(e) => {
            setDateFilter(e.target.value as typeof dateFilter)
            setCurrentPage(1)
          }}
          className="w-full sm:w-40"
        >
          <option value="all">Tutte le date</option>
          <option value="7d">Ultimi 7 giorni</option>
          <option value="30d">Ultimi 30 giorni</option>
          <option value="90d">Ultimi 90 giorni</option>
        </Select>
      </div>

      {/* Tabella */}
      {isLoading ? (
        <DataTableSkeleton rows={5} columns={5} />
      ) : filteredUsers.length === 0 ? (
        users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nessun cliente ancora"
            description="Crea il primo cliente per iniziare a gestire le spedizioni del tuo team"
          />
        ) : (
          <EmptyState
            icon={Users}
            title="Nessun risultato"
            description="Prova a modificare i filtri di ricerca"
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setWalletFilter('all')
                  setDateFilter('all')
                }}
              >
                Resetta filtri
              </Button>
            }
          />
        )
      ) : (
        <>
          <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
            <table className="w-full" aria-label="Tabella clienti del team">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('name')}
                      className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                    >
                      Cliente
                      <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => handleSort('created_at')}
                      className="flex items-center text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900"
                    >
                      Registrazione
                      <SortIcon field="created_at" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSort('wallet_balance')}
                      className="flex items-center justify-end text-xs font-semibold text-gray-600 uppercase tracking-wider hover:text-gray-900 ml-auto"
                    >
                      Saldo Wallet
                      <SortIcon field="wallet_balance" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar size="md">
                          <AvatarFallback name={user.name} />
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {user.name}
                            </span>
                            {isNewUser(user.created_at) && (
                              <Badge variant="success" className="shrink-0">
                                Nuovo
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{formatDate(user.created_at)}</div>
                      <div className="text-xs text-gray-500">{formatRelativeDate(user.created_at)}</div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Badge
                        variant={
                          user.wallet_balance < WALLET_THRESHOLDS.LOW
                            ? 'error'
                            : user.wallet_balance >= WALLET_THRESHOLDS.HIGH
                            ? 'success'
                            : 'secondary'
                        }
                        className="font-mono"
                      >
                        {formatCurrency(user.wallet_balance)}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <UserActionsMenu
                        user={user}
                        onRechargeWallet={handleRechargeWallet}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2">
              <p className="text-sm text-gray-500">
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} di{' '}
                {filteredUsers.length} clienti
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Precedente
                </Button>
                <span className="text-sm text-gray-600">
                  Pagina {currentPage} di {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Successiva
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Wallet Dialog */}
      <WalletRechargeDialog
        user={selectedUser}
        isOpen={walletDialogOpen}
        onClose={() => {
          setWalletDialogOpen(false)
          setSelectedUser(null)
        }}
        onSuccess={handleWalletSuccess}
      />
    </div>
  )
}
