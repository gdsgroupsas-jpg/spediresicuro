'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { X, Wallet, Download, Loader2 } from 'lucide-react';

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

import { useBulkWalletOperation } from '@/lib/queries/use-all-users';
import {
  bulkWalletOperationSchema,
  type BulkWalletOperationInput,
} from '@/lib/validations/wallet-schema';
import { formatCurrency, cn } from '@/lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  wallet_balance: number;
}

interface BulkActionsBarProps {
  selectedCount: number;
  selectedUsers: User[];
  onClearSelection: () => void;
  onSuccess?: () => void;
}

export function BulkActionsBar({
  selectedCount,
  selectedUsers,
  onClearSelection,
  onSuccess,
}: BulkActionsBarProps) {
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const bulkWalletMutation = useBulkWalletOperation();

  const form = useForm<Omit<BulkWalletOperationInput, 'userIds'>>({
    resolver: zodResolver(bulkWalletOperationSchema.omit({ userIds: true })),
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
  } = form;
  const amount = watch('amount');
  const totalAmount = amount * selectedCount;

  async function onSubmit(data: Omit<BulkWalletOperationInput, 'userIds'>) {
    startTransition(async () => {
      try {
        const result = await bulkWalletMutation.mutateAsync({
          userIds: selectedUsers.map((u) => u.id),
          amount: data.amount,
          reason: data.reason,
        });

        if (result.failed > 0) {
          toast.warning(
            `${result.successful}/${result.total} operazioni completate. ${result.failed} fallite.`
          );
        } else {
          toast.success(`Tutte le ${result.total} operazioni completate con successo!`);
        }

        reset();
        setShowRechargeDialog(false);
        onSuccess?.();
      } catch (error: any) {
        toast.error(error.message || 'Errore nella ricarica massiva');
      }
    });
  }

  const handleExportCSV = () => {
    const headers = ['ID', 'Nome', 'Email', 'Saldo Wallet'];
    const rows = selectedUsers.map((u) => [u.id, u.name, u.email, u.wallet_balance.toString()]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utenti-selezionati-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Esportati ${selectedCount} utenti`);
  };

  return (
    <>
      {/* Fixed Bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{selectedCount}</span>
            <span className="text-gray-400">utenti selezionati</span>
          </div>

          <div className="h-8 w-px bg-gray-700" />

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRechargeDialog(true)}
              className="gap-2"
            >
              <Wallet className="h-4 w-4" />
              Ricarica Massiva
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="gap-2 text-gray-900"
            >
              <Download className="h-4 w-4" />
              Esporta CSV
            </Button>
          </div>

          <button
            onClick={onClearSelection}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Deseleziona tutti"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bulk Recharge Dialog */}
      <Dialog open={showRechargeDialog} onOpenChange={setShowRechargeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#FF9500]" />
              Ricarica Massiva
            </DialogTitle>
            <DialogDescription>
              Stai per aggiungere credito a {selectedCount} utenti
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
            {/* Preview Utenti */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Utenti interessati:</p>
              <p className="text-sm text-gray-600">
                {selectedUsers
                  .slice(0, 3)
                  .map((u) => u.name)
                  .join(', ')}
                {selectedUsers.length > 3 && ` (+${selectedUsers.length - 3} altri)`}
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="bulk-amount">Importo per utente</Label>
              <div className="relative">
                <Input
                  id="bulk-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register('amount', { valueAsNumber: true })}
                  error={!!errors.amount}
                  disabled={isPending}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  €
                </span>
              </div>
              {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
            </div>

            {/* Total Preview */}
            {amount > 0 && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-green-700">Totale operazione</span>
                  <span className="font-bold text-green-700">{formatCurrency(totalAmount)}</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  {formatCurrency(amount)} × {selectedCount} utenti
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Causale</Label>
              <Textarea
                id="bulk-reason"
                placeholder="Es: Bonus Natale 2024, Promozione, etc."
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
                onClick={() => setShowRechargeDialog(false)}
                disabled={isPending}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isPending || amount === 0}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isPending ? 'Elaborazione...' : `Ricarica ${selectedCount} utenti`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
