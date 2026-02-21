'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Wallet, Plus, Minus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';

import { manageWallet } from '@/actions/super-admin';
import {
  walletOperationSchema,
  type WalletOperationInput,
  QUICK_AMOUNTS,
  WALLET_THRESHOLDS,
} from '@/lib/validations/wallet-schema';
import { formatCurrency, cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
}

interface WalletRechargeDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function WalletRechargeDialog({
  user,
  isOpen,
  onClose,
  onSuccess,
}: WalletRechargeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<WalletOperationInput | null>(null);

  const form = useForm<Omit<WalletOperationInput, 'userId'>>({
    resolver: zodResolver(walletOperationSchema.omit({ userId: true })),
    defaultValues: {
      amount: 0,
      reason: '',
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = form;
  const amount = watch('amount');

  const currentBalance = user?.wallet_balance || 0;
  const newBalance = currentBalance + (amount || 0);
  const isDebit = amount < 0;
  const wouldGoNegative = newBalance < 0;
  const isLargeAmount = Math.abs(amount) > WALLET_THRESHOLDS.WARNING_DEBIT;

  const handleQuickAmount = (quickAmount: number) => {
    setValue('amount', (amount || 0) + quickAmount);
  };

  async function executeOperation(data: WalletOperationInput) {
    startTransition(async () => {
      try {
        const result = await manageWallet(data.userId, data.amount, data.reason);

        if (!result.success) {
          toast.error(result.error || 'Errore nella gestione wallet');
          return;
        }

        toast.success(
          data.amount > 0
            ? `Ricarica di ${formatCurrency(data.amount)} completata!`
            : `Prelievo di ${formatCurrency(Math.abs(data.amount))} completato!`
        );
        reset();
        onClose();
        onSuccess?.();
      } catch (error) {
        toast.error('Errore imprevisto. Riprova.');
        console.error('Wallet operation error:', error);
      }
    });
  }

  function onSubmit(data: Omit<WalletOperationInput, 'userId'>) {
    if (!user) return;

    const fullData: WalletOperationInput = {
      ...data,
      userId: user.id,
    };

    // Se è un importo grande, chiedi conferma
    if (isLargeAmount) {
      setPendingData(fullData);
      setShowConfirm(true);
      return;
    }

    executeOperation(fullData);
  }

  const handleConfirm = () => {
    if (pendingData) {
      executeOperation(pendingData);
    }
    setShowConfirm(false);
    setPendingData(null);
  };

  const handleClose = () => {
    if (!isPending) {
      reset();
      setPendingData(null);
      onClose();
    }
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent onClose={handleClose} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#FF9500]" />
              Gestione Wallet
            </DialogTitle>
            <DialogDescription>
              {user.name} ({user.email})
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {/* Saldo Attuale */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Saldo attuale</span>
                <span
                  className={cn(
                    'text-lg font-bold',
                    currentBalance < WALLET_THRESHOLDS.LOW ? 'text-red-600' : 'text-gray-900'
                  )}
                >
                  {formatCurrency(currentBalance)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Quick Amounts */}
              <div>
                <Label className="mb-2 block">Importi rapidi</Label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map((qa) => (
                    <Button
                      key={qa.amount}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickAmount(qa.amount)}
                      disabled={isPending}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      {qa.label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAmount(-10)}
                    disabled={isPending}
                    className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Minus className="h-3 w-3" />
                    -10 €
                  </Button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="amount">Importo</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register('amount', { valueAsNumber: true })}
                    error={!!errors.amount || wouldGoNegative}
                    disabled={isPending}
                    className={cn('pr-12', isDebit && 'text-red-600')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    €
                  </span>
                </div>
                {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
                {wouldGoNegative && (
                  <p className="text-xs text-red-500">Il saldo non può andare in negativo</p>
                )}
              </div>

              {/* Preview Nuovo Saldo */}
              {amount !== 0 && !wouldGoNegative && (
                <div
                  className={cn(
                    'rounded-lg p-3 border',
                    isDebit ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                  )}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDebit ? 'text-red-700' : 'text-green-700'}>
                      {isDebit ? 'Prelievo' : 'Ricarica'}
                    </span>
                    <span
                      className={cn('font-medium', isDebit ? 'text-red-700' : 'text-green-700')}
                    >
                      {isDebit ? '-' : '+'}
                      {formatCurrency(Math.abs(amount))}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-1 pt-1 border-t border-current/10">
                    <span className={isDebit ? 'text-red-700' : 'text-green-700'}>Nuovo saldo</span>
                    <span className={cn('font-bold', isDebit ? 'text-red-700' : 'text-green-700')}>
                      {formatCurrency(newBalance)}
                    </span>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Causale</Label>
                <Textarea
                  id="reason"
                  placeholder="Es: Ricarica mensile, Rimborso spedizione, etc."
                  {...register('reason')}
                  error={!!errors.reason}
                  disabled={isPending}
                  rows={2}
                />
                {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                  Annulla
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || amount === 0 || wouldGoNegative}
                  variant={isDebit ? 'destructive' : 'default'}
                >
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isPending ? 'Elaborazione...' : isDebit ? 'Preleva' : 'Ricarica'}
                </Button>
              </DialogFooter>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog per importi grandi */}
      <ConfirmActionDialog
        isOpen={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setPendingData(null);
        }}
        onConfirm={handleConfirm}
        title={`Conferma ${isDebit ? 'prelievo' : 'ricarica'} importante`}
        description={`Stai per ${isDebit ? 'prelevare' : 'aggiungere'} ${formatCurrency(Math.abs(amount))} ${isDebit ? 'dal' : 'al'} wallet di ${user.name}. Confermi l'operazione?`}
        confirmText="Conferma"
        variant={isDebit ? 'destructive' : 'default'}
        isLoading={isPending}
      />
    </>
  );
}
