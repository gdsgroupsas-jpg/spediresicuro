'use client';

/**
 * ManageWalletCard - Card per accreditare/addebitare wallet utente
 *
 * Usata nella pagina dettaglio utente admin (/dashboard/admin/users/[userId])
 * Chiama la server action manageWallet() da actions/super-admin.ts
 */

import { manageWallet } from '@/actions/super-admin';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Minus, Plus, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface ManageWalletCardProps {
  userId: string;
  userName: string;
  currentBalance: number;
}

// Importi rapidi preimpostati
const QUICK_AMOUNTS = [50, 100, 250, 500];

export function ManageWalletCard({ userId, userName, currentBalance }: ManageWalletCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);

  const openDialog = (selectedMode: 'credit' | 'debit') => {
    setMode(selectedMode);
    setAmount('');
    setReason('');
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);

    // Validazione client-side
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Inserisci un importo valido maggiore di zero.');
      return;
    }

    if (parsedAmount > 10000) {
      toast.error('Importo massimo: €10.000');
      return;
    }

    if (!reason.trim()) {
      toast.error('La motivazione è obbligatoria.');
      return;
    }

    setIsLoading(true);

    try {
      const finalAmount = mode === 'credit' ? parsedAmount : -parsedAmount;
      const result = await manageWallet(userId, finalAmount, reason.trim());

      if (!result.success) {
        throw new Error(result.error || 'Errore sconosciuto');
      }

      toast.success(result.message);
      setDialogOpen(false);
      // Aggiorna la pagina per mostrare il nuovo saldo
      router.refresh();
    } catch (error: any) {
      console.error('Errore gestione wallet:', error);
      toast.error(error.message || 'Errore durante la gestione del wallet.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-gray-600" />
            Gestione Wallet
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Accredita o addebita manualmente il wallet di questo utente.
          </p>
        </div>

        {/* Saldo attuale */}
        <div className="bg-slate-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-500">Saldo attuale</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentBalance)}</p>
        </div>

        {/* Bottoni azione */}
        <div className="flex gap-3">
          <Button
            onClick={() => openDialog('credit')}
            className="flex-1 gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Accredita
          </Button>
          <Button
            onClick={() => openDialog('debit')}
            variant="outline"
            className="flex-1 gap-2 border-red-200 text-red-700 hover:bg-red-50"
          >
            <Minus className="h-4 w-4" />
            Addebita
          </Button>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === 'credit' ? 'Accredita Wallet' : 'Addebita Wallet'}</DialogTitle>
            <DialogDescription>
              {mode === 'credit'
                ? `Aggiungi credito al wallet di ${userName}.`
                : `Rimuovi credito dal wallet di ${userName}. Saldo disponibile: ${formatCurrency(currentBalance)}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Importi rapidi (solo per accredito) */}
            {mode === 'credit' && (
              <div>
                <Label className="text-sm text-gray-500">Importo rapido</Label>
                <div className="flex gap-2 mt-1.5">
                  {QUICK_AMOUNTS.map((qa) => (
                    <Button
                      key={qa}
                      variant="outline"
                      size="sm"
                      className={amount === String(qa) ? 'border-green-500 bg-green-50' : ''}
                      onClick={() => setAmount(String(qa))}
                    >
                      €{qa}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Importo */}
            <div>
              <Label htmlFor="wallet-amount">Importo (€)</Label>
              <Input
                id="wallet-amount"
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            {/* Motivazione */}
            <div>
              <Label htmlFor="wallet-reason">Motivazione *</Label>
              <Input
                id="wallet-reason"
                type="text"
                placeholder={
                  mode === 'credit'
                    ? 'es. Bonifico ricevuto, Regalo, Credito iniziale...'
                    : 'es. Storno, Correzione, Penale...'
                }
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {/* Riepilogo */}
            {amount && parseFloat(amount) > 0 && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Saldo attuale</span>
                  <span>{formatCurrency(currentBalance)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">
                    {mode === 'credit' ? 'Accredito' : 'Addebito'}
                  </span>
                  <span className={mode === 'credit' ? 'text-green-600' : 'text-red-600'}>
                    {mode === 'credit' ? '+' : '-'}
                    {formatCurrency(parseFloat(amount))}
                  </span>
                </div>
                <hr className="my-1.5" />
                <div className="flex justify-between font-medium">
                  <span>Nuovo saldo</span>
                  <span>
                    {formatCurrency(
                      mode === 'credit'
                        ? currentBalance + parseFloat(amount)
                        : currentBalance - parseFloat(amount)
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isLoading}>
              Annulla
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !amount || !reason.trim()}
              className={
                mode === 'credit'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === 'credit' ? 'Conferma Accredito' : 'Conferma Addebito'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
