'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateSubUserBillingMode } from '@/actions/admin-reseller';
import { CreditCard, FileText, Loader2 } from 'lucide-react';

interface BillingModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  currentMode: 'prepagato' | 'postpagato';
  onSuccess: () => void;
}

export function BillingModeDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  currentMode,
  onSuccess,
}: BillingModeDialogProps) {
  const [selectedMode, setSelectedMode] = useState<'prepagato' | 'postpagato'>(currentMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincronizza selectedMode quando il dialog viene aperto per un client diverso
  useEffect(() => {
    if (open) {
      setSelectedMode(currentMode);
      setError(null);
    }
  }, [open, currentMode]);

  const handleSave = async () => {
    if (selectedMode === currentMode) {
      onOpenChange(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await updateSubUserBillingMode(clientId, selectedMode);
      if (result.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(result.error || 'Errore sconosciuto');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambia Contratto</DialogTitle>
          <DialogDescription>
            Seleziona la modalit&agrave; di fatturazione per <strong>{clientName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Opzione Prepagato */}
          <button
            type="button"
            onClick={() => setSelectedMode('prepagato')}
            className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
              selectedMode === 'prepagato'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <CreditCard
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                selectedMode === 'prepagato' ? 'text-green-600' : 'text-gray-400'
              }`}
            />
            <div>
              <p className="font-medium text-gray-900">Prepagato</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Il cliente paga in anticipo tramite wallet. Le spedizioni vengono addebitate
                immediatamente dal saldo disponibile.
              </p>
            </div>
          </button>

          {/* Opzione Postpagato */}
          <button
            type="button"
            onClick={() => setSelectedMode('postpagato')}
            className={`w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all text-left ${
              selectedMode === 'postpagato'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <FileText
              className={`w-5 h-5 mt-0.5 shrink-0 ${
                selectedMode === 'postpagato' ? 'text-blue-600' : 'text-gray-400'
              }`}
            />
            <div>
              <p className="font-medium text-gray-900">Postpagato (fattura a fine mese)</p>
              <p className="text-sm text-gray-500 mt-0.5">
                Il cliente spedisce senza pagare subito. A fine mese riceve una fattura con il
                riepilogo di tutte le spedizioni effettuate.
              </p>
            </div>
          </button>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={loading || selectedMode === currentMode}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
