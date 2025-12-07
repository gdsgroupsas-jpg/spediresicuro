'use client'

import { useState, useTransition } from 'react'
import { Loader2, Wallet, Plus } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { rechargeMyWallet } from '@/actions/wallet'
import { formatCurrency, cn } from '@/lib/utils'

// Schema validazione
const rechargeSchema = {
  amount: (val: number) => {
    if (!val || val <= 0) return 'L\'importo deve essere maggiore di zero'
    if (val > 10000) return 'L\'importo massimo è €10.000'
    return null
  },
  reason: (val: string) => {
    if (!val || val.trim().length < 3) return 'Inserisci una causale (minimo 3 caratteri)'
    return null
  }
}

interface RechargeWalletDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  currentBalance: number
}

const QUICK_AMOUNTS = [
  { amount: 50, label: '+50 €' },
  { amount: 100, label: '+100 €' },
  { amount: 250, label: '+250 €' },
  { amount: 500, label: '+500 €' },
]

export function RechargeWalletDialog({
  isOpen,
  onClose,
  onSuccess,
  currentBalance,
}: RechargeWalletDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState<number>(0)
  const [reason, setReason] = useState<string>('')
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({})

  const newBalance = currentBalance + amount

  const handleQuickAmount = (quickAmount: number) => {
    setAmount(quickAmount)
    setErrors({})
  }

  const validateForm = (): boolean => {
    const newErrors: { amount?: string; reason?: string } = {}
    
    const amountError = rechargeSchema.amount(amount)
    if (amountError) newErrors.amount = amountError

    const reasonError = rechargeSchema.reason(reason)
    if (reasonError) newErrors.reason = reasonError

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    startTransition(async () => {
      try {
        const result = await rechargeMyWallet(amount, reason)

        if (!result.success) {
          toast.error(result.error || 'Errore durante la ricarica')
          return
        }

        toast.success(
          result.message || `Ricarica di ${formatCurrency(amount)} completata!`
        )
        
        // Reset form
        setAmount(0)
        setReason('')
        setErrors({})
        
        onClose()
        onSuccess?.()
      } catch (error) {
        toast.error('Errore imprevisto. Riprova.')
        console.error('Wallet recharge error:', error)
      }
    })
  }

  const handleClose = () => {
    if (!isPending) {
      setAmount(0)
      setReason('')
      setErrors({})
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[#FF9500]" />
            Ricarica Wallet
          </DialogTitle>
          <DialogDescription>
            Aggiungi credito al tuo wallet per utilizzare i servizi della piattaforma
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Saldo Attuale */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Saldo Attuale</span>
              <span className="text-2xl font-bold text-green-700">
                {formatCurrency(currentBalance)}
              </span>
            </div>
          </div>

          {/* Quick Amounts */}
          <div>
            <Label className="mb-2 block text-sm font-medium text-gray-700">
              Importi rapidi
            </Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((qa) => (
                <Button
                  key={qa.amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAmount(qa.amount)}
                  disabled={isPending}
                  className="flex items-center gap-1 border-2 border-gray-300 hover:border-green-500 hover:bg-green-50"
                >
                  <Plus className="h-3 w-3 text-green-600" />
                  {qa.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount" className="text-sm font-medium text-gray-700">
              Importo <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max="10000"
                placeholder="0.00"
                value={amount || ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0
                  setAmount(val)
                  if (errors.amount) {
                    setErrors({ ...errors, amount: undefined })
                  }
                }}
                error={!!errors.amount}
                disabled={isPending}
                className="pr-12 text-lg font-medium"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
                €
              </span>
            </div>
            {errors.amount && (
              <p className="text-xs text-red-500">{errors.amount}</p>
            )}
          </div>

          {/* Preview Nuovo Saldo */}
          {amount > 0 && (
            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-green-700 font-medium">Nuovo Saldo</span>
                <span className="text-xl font-bold text-green-700">
                  {formatCurrency(newBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600">Ricarica</span>
                <span className="text-green-600 font-medium">
                  +{formatCurrency(amount)}
                </span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-sm font-medium text-gray-700">
              Causale <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reason"
              placeholder="Es: Ricarica mensile, Bonus, Rimborso, etc."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (errors.reason) {
                  setErrors({ ...errors, reason: undefined })
                }
              }}
              error={!!errors.reason}
              disabled={isPending}
              rows={3}
            />
            {errors.reason && (
              <p className="text-xs text-red-500">{errors.reason}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
              className="border-2 border-gray-300"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isPending || amount <= 0 || !!errors.amount || !!errors.reason}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isPending ? 'Elaborazione...' : 'Ricarica Wallet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
