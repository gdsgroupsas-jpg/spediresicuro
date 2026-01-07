'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Users, Building2, Wallet, Package } from 'lucide-react'

// Usa classi Tailwind direttamente per coerenza con dashboard
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { EmptyState } from '@/components/shared/empty-state'
import { DataTableSkeleton } from '@/components/shared/data-table-skeleton'

import { useAllClients } from '@/lib/queries/use-sub-users'
import { formatCurrency, formatDate } from '@/lib/utils'

interface ResellerCardProps {
  reseller: {
    id: string
    email: string
    name: string
    company_name: string | null
    phone: string | null
    wallet_balance: number
    created_at: string
  }
  subUsers: Array<{
    id: string
    email: string
    name: string
    company_name: string | null
    phone: string | null
    wallet_balance: number
    created_at: string
  }>
  stats: {
    totalSubUsers: number
    totalWalletBalance: number
  }
}

function ResellerCard({ reseller, subUsers, stats }: ResellerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
      <div className="p-6 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback>
                {reseller.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2) || 'R'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold truncate">
                {reseller.name || reseller.email}
              </h3>
              <p className="text-sm text-gray-500 truncate">{reseller.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Sub-Users</p>
              <p className="text-sm font-semibold">{stats.totalSubUsers}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Wallet Totale</p>
              <p className="text-sm font-semibold">{formatCurrency(stats.totalWalletBalance)}</p>
            </div>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              Reseller
            </Badge>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="px-6 pb-6 pt-0">
          {subUsers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nessun Sub-User"
              description="Questo reseller non ha ancora sub-users."
            />
          ) : (
            <div className="space-y-2">
              {subUsers.map((subUser) => (
                <div
                  key={subUser.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {subUser.name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{subUser.name || subUser.email}</p>
                      <p className="text-xs text-gray-500 truncate">{subUser.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {subUser.company_name && (
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500">Azienda</p>
                        <p className="text-xs font-medium truncate max-w-[150px]">
                          {subUser.company_name}
                        </p>
                      </div>
                    )}
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Wallet</p>
                      <p className="text-sm font-semibold">{formatCurrency(subUser.wallet_balance)}</p>
                    </div>
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-gray-500">Registrato</p>
                      <p className="text-xs">{formatDate(subUser.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface BYOCSectionProps {
  clients: Array<{
    id: string
    email: string
    name: string
    company_name: string | null
    phone: string | null
    wallet_balance: number
    created_at: string
  }>
}

function BYOCSection({ clients }: BYOCSectionProps) {
  if (clients.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mt-6">
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Clienti BYOC
          <Badge variant="outline" className="ml-2">
            {clients.length}
          </Badge>
        </h2>
        <div className="space-y-2">
          {clients.map((client) => (
            <div
              key={client.id}
              className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {client.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2) || 'B'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{client.name || client.email}</p>
                  <p className="text-xs text-gray-500 truncate">{client.email}</p>
                  {client.company_name && (
                    <p className="text-xs text-gray-400 truncate">{client.company_name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Wallet</p>
                  <p className="text-sm font-semibold">{formatCurrency(client.wallet_balance)}</p>
                </div>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  BYOC
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ClientsHierarchyView() {
  const { data: clients, isLoading, error } = useAllClients()

  if (isLoading) {
    return <DataTableSkeleton />
  }

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Errore nel caricamento"
        description={error instanceof Error ? error.message : 'Errore sconosciuto'}
      />
    )
  }

  if (!clients) {
    return (
      <EmptyState icon={Users} title="Nessun dato" description="Non ci sono clienti da visualizzare." />
    )
  }

  const { resellers, byocClients, stats } = clients

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Reseller</p>
              <p className="text-2xl font-bold">{stats.totalResellers}</p>
            </div>
            <Users className="h-8 w-8 text-orange-500" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sub-Users</p>
              <p className="text-2xl font-bold">{stats.totalSubUsers}</p>
            </div>
            <Package className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">BYOC</p>
              <p className="text-2xl font-bold">{stats.totalBYOC}</p>
            </div>
            <Building2 className="h-8 w-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Wallet Totale</p>
              <p className="text-2xl font-bold">{formatCurrency(stats.totalWalletBalance)}</p>
            </div>
            <Wallet className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Resellers Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          Reseller ({resellers.length})
        </h2>
        {resellers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nessun Reseller"
            description="Non ci sono reseller registrati."
          />
        ) : (
          <div className="space-y-4">
            {resellers.map((item) => (
              <ResellerCard
                key={item.reseller.id}
                reseller={item.reseller}
                subUsers={item.subUsers}
                stats={item.stats}
              />
            ))}
          </div>
        )}
      </div>

      {/* BYOC Section */}
      <BYOCSection clients={byocClients} />
    </div>
  )
}
