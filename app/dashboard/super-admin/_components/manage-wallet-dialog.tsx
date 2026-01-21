'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Wallet, Plus, Minus, History } from 'lucide-react';

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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ConfirmActionDialog } from '@/components/shared/confirm-action-dialog';

import { manageWallet } from '@/actions/super-admin';
import {
  walletOperationSchema,
  type WalletOperationInput,
  QUICK_AMOUNTS,
  WALLET_THRESHOLDS,
} from '@/lib/validations/wallet-schema';
import { formatCurrency, formatDateTime, cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
}

interface ManageWalletDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ManageWalletDialog({ user, isOpen, onClose, onSuccess }: ManageWalletDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<WalletOperationInput | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

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

  // Carica storico transazioni (mock per ora)
  useEffect(() => {
    if (isOpen && user) {
      setLoadingTransactions(true);
      // TODO: Implementare API per storico transazioni
      setTimeout(() => {
        setTransactions([
          {
            id: '1',
            amount: 100,
            type: 'credit',
            reason: 'Ricarica manuale',
            created_at: new Date().toISOString(),
            performed_by_name: 'Admin',
          },
          {
            id: '2',
            amount: -25,
            type: 'debit',
            reason: 'Acquisto servizio',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            performed_by_name: 'Sistema',
          },
        ]);
        setLoadingTransactions(false);
      }, 500);
    }
  }, [isOpen, user]);

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
        <DialogContent onClose={handleClose} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#FF9500]" />
              Gestione Wallet Avanzata
            </DialogTitle>
            <DialogDescription>
              {user.name} ({user.email})
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="recharge" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="recharge">Ricarica/Prelievo</TabsTrigger>
              <TabsTrigger value="history">Storico ({transactions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="recharge" className="space-y-4 pt-4">
              {/* Saldo Attuale */}
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
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
                      onClick={() => handleQuickAmount(-50)}
                      disabled={isPending}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Minus className="h-3 w-3" />
                      -50 €
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
                      <span className={isDebit ? 'text-red-700' : 'text-green-700'}>
                        Nuovo saldo
                      </span>
                      <span
                        className={cn('font-bold', isDebit ? 'text-red-700' : 'text-green-700')}
                      >
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
                    placeholder="Es: Ricarica mensile, Rimborso, Bonus, etc."
                    {...register('reason')}
                    error={!!errors.reason}
                    disabled={isPending}
                    rows={2}
                  />
                  {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isPending}
                  >
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
            </TabsContent>

            <TabsContent value="history" className="pt-4">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nessuna transazione</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{tx.reason}</p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(tx.created_at)} • {tx.performed_by_name}
                        </p>
                      </div>
                      <Badge variant={tx.amount > 0 ? 'success' : 'error'} className="font-mono">
                        {tx.amount > 0 ? '+' : ''}
                        {formatCurrency(tx.amount)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
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
