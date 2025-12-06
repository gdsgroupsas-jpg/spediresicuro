'use client'

import { MoreHorizontal, Wallet, Package, User, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface SubUser {
  id: string
  name: string
  email: string
  wallet_balance: number
  company_name: string | null
  phone: string | null
  created_at: string
}

interface UserActionsMenuProps {
  user: SubUser
  onRechargeWallet: (user: SubUser) => void
  onViewShipments?: (user: SubUser) => void
  onViewDetails?: (user: SubUser) => void
  onDelete?: (user: SubUser) => void
}

export function UserActionsMenu({
  user,
  onRechargeWallet,
  onViewShipments,
  onViewDetails,
  onDelete,
}: UserActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Azioni per ${user.name}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Azioni</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => onRechargeWallet(user)}>
          <Wallet className="mr-2 h-4 w-4 text-green-600" />
          Gestisci Wallet
        </DropdownMenuItem>

        {onViewShipments && (
          <DropdownMenuItem onClick={() => onViewShipments(user)}>
            <Package className="mr-2 h-4 w-4 text-blue-600" />
            Vedi Spedizioni
          </DropdownMenuItem>
        )}

        {onViewDetails && (
          <DropdownMenuItem onClick={() => onViewDetails(user)}>
            <User className="mr-2 h-4 w-4 text-gray-600" />
            Dettagli Cliente
          </DropdownMenuItem>
        )}

        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(user)}
              destructive
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Elimina Cliente
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
