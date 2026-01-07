'use client'

import { useState } from 'react'
import { 
  MoreHorizontal, 
  Wallet, 
  FileText, 
  Plus,
  Link2,
  Eye,
  Package,
  Edit,
  AlertTriangle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency, formatRelativeDate } from '@/lib/utils'
import { WALLET_THRESHOLDS } from '@/lib/validations/wallet-schema'

export interface ClientWithListino {
  id: string
  email: string
  name: string
  company_name?: string | null
  phone?: string | null
  wallet_balance: number
  created_at: string
  shipments_count: number
  total_spent: number
  assigned_listino?: {
    id: string
    name: string
    margin_percent?: number
    status: string
  } | null
}

interface ClientCardWithListinoProps {
  client: ClientWithListino
  onAssignListino: (clientId: string) => void
  onCreateListino: (clientId: string) => void
  onManageWallet: (clientId: string) => void
  onViewShipments: (clientId: string) => void
  onEditClient: (clientId: string) => void
}

export function ClientCardWithListino({ 
  client, 
  onAssignListino, 
  onCreateListino, 
  onManageWallet,
  onViewShipments,
  onEditClient
}: ClientCardWithListinoProps) {
  const isLowBalance = client.wallet_balance < WALLET_THRESHOLDS.LOW
  const isNewClient = () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return new Date(client.created_at) >= sevenDaysAgo
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-orange-200 transition-all group">
      <div className="flex items-center justify-between gap-4">
        {/* Client Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-500 text-white font-semibold">
              {client.name?.[0]?.toUpperCase() || client.email[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 truncate">
                {client.name || client.email.split('@')[0]}
              </p>
              {isNewClient() && (
                <Badge variant="success" className="shrink-0 text-xs">
                  Nuovo
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">{client.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6">
          {/* Wallet */}
          <div className="text-center min-w-[80px]">
            <p className="text-xs text-gray-400 mb-0.5">Wallet</p>
            <Badge
              variant={isLowBalance ? 'error' : 'secondary'}
              className="font-mono text-sm"
            >
              {isLowBalance && <AlertTriangle className="w-3 h-3 mr-1" />}
              {formatCurrency(client.wallet_balance)}
            </Badge>
          </div>

          {/* Spedizioni */}
          <div className="text-center min-w-[70px]">
            <p className="text-xs text-gray-400 mb-0.5">Spedizioni</p>
            <p className="font-semibold text-gray-900">{client.shipments_count}</p>
          </div>

          {/* Speso */}
          <div className="text-center min-w-[80px]">
            <p className="text-xs text-gray-400 mb-0.5">Fatturato</p>
            <p className="font-medium text-gray-700">{formatCurrency(client.total_spent)}</p>
          </div>
        </div>

        {/* Listino Badge */}
        <div className="flex items-center gap-3 shrink-0">
          {client.assigned_listino ? (
            <div 
              className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
              onClick={() => onAssignListino(client.id)}
              title="Clicca per cambiare listino"
            >
              <FileText className="w-4 h-4 text-green-600" />
              <div className="text-left">
                <p className="text-xs font-medium text-green-800 truncate max-w-[120px]">
                  {client.assigned_listino.name}
                </p>
                {client.assigned_listino.margin_percent !== undefined && (
                  <p className="text-[10px] text-green-600">
                    +{client.assigned_listino.margin_percent}% margine
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div 
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors"
              onClick={() => onAssignListino(client.id)}
              title="Assegna un listino"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-800">
                Nessun listino
              </span>
            </div>
          )}
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onManageWallet(client.id)}>
              <Wallet className="w-4 h-4 mr-2 text-green-600" />
              Ricarica Wallet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewShipments(client.id)}>
              <Package className="w-4 h-4 mr-2 text-blue-600" />
              Vedi Spedizioni
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {client.assigned_listino ? (
              <DropdownMenuItem onClick={() => onAssignListino(client.id)}>
                <Edit className="w-4 h-4 mr-2 text-orange-600" />
                Cambia Listino
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onClick={() => onAssignListino(client.id)}>
                  <Link2 className="w-4 h-4 mr-2 text-orange-600" />
                  Assegna Listino Esistente
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreateListino(client.id)}>
                  <Plus className="w-4 h-4 mr-2 text-purple-600" />
                  Crea Listino Personalizzato
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEditClient(client.id)}>
              <Eye className="w-4 h-4 mr-2 text-gray-600" />
              Dettagli Cliente
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile Stats Row */}
      <div className="md:hidden mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
        <div>
          <span className="text-gray-400">Wallet: </span>
          <span className={isLowBalance ? 'text-red-600 font-medium' : 'text-gray-700'}>
            {formatCurrency(client.wallet_balance)}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Spedizioni: </span>
          <span className="text-gray-700">{client.shipments_count}</span>
        </div>
        <div>
          <span className="text-gray-400">Fatturato: </span>
          <span className="text-gray-700">{formatCurrency(client.total_spent)}</span>
        </div>
      </div>
    </div>
  )
}
