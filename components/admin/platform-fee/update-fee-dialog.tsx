'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Edit2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface UpdateFeeDialogProps {
  userId: string;
  currentFee: number | null;
  currentNotes: string | null;
}

// Quick presets per fee comuni
const FEE_PRESETS = [
  { label: 'Enterprise', value: 0.30, description: 'Volume alto' },
  { label: 'Standard', value: 0.50, description: 'Default' },
  { label: 'Gratis (€0)', value: 0.00, description: 'Nessuna fee' },
  { label: 'Reset', value: null, description: 'Torna a default' },
] as const;

/**
 * Dialog per modificare la platform fee di un utente.
 * Supporta quick presets e validazione.
 */
export function UpdateFeeDialog({
  userId,
  currentFee,
  currentNotes,
}: UpdateFeeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fee, setFee] = useState<string>(currentFee?.toFixed(2) ?? '');
  const [notes, setNotes] = useState<string>(currentNotes ?? '');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Applica preset
  const applyPreset = (presetValue: number | null) => {
    if (presetValue === null) {
      setFee('');
      setNotes('Reset a default');
    } else {
      setFee(presetValue.toFixed(2));
    }
  };

  // Valida input fee
  const validateFee = (): { valid: boolean; value: number | null } => {
    if (fee === '' || fee.trim() === '') {
      return { valid: true, value: null }; // Reset a default
    }
    
    const numValue = parseFloat(fee);
    if (isNaN(numValue)) {
      return { valid: false, value: null };
    }
    if (numValue < 0) {
      return { valid: false, value: null };
    }
    
    return { valid: true, value: numValue };
  };

  // Submit form
  const handleSubmit = async () => {
    const validation = validateFee();
    
    if (!validation.valid) {
      toast.error('Fee non valida. Inserisci un valore >= 0 o lascia vuoto per reset.', {
        duration: 5000,
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/platform-fee/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          newFee: validation.value,
          notes: notes.trim() || null,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Errore aggiornamento fee');
      }
      
      // Messaggio di successo dettagliato
      const feeDisplay = validation.value === null 
        ? 'default (€0.50)' 
        : `€${validation.value.toFixed(2)}`;
      
      const previousFeeDisplay = data.previousFee === null 
        ? 'default (€0.50)' 
        : `€${data.previousFee.toFixed(2)}`;
      
      const successMsg = data.previousFee === null
        ? `Fee impostata a ${feeDisplay}`
        : `Fee aggiornata da ${previousFeeDisplay} a ${feeDisplay}`;
      
      // Mostra messaggio di successo nel dialog
      setSuccessMessage(successMsg);
      setErrorMessage(null);
      
      // Toast di successo con dettagli (doppio feedback)
      toast.success(`✅ ${successMsg}`, {
        duration: 6000,
        description: data.message || 'La modifica è stata salvata correttamente nel database.',
        icon: <CheckCircle2 className="w-5 h-5 text-green-600" />,
      });
      
      // Reset form dopo 2 secondi e chiudi
      setTimeout(() => {
        setSuccessMessage(null);
        setFee(validation.value?.toFixed(2) ?? '');
        setOpen(false);
        // Refresh per aggiornare i dati nella pagina
        router.refresh();
      }, 2000);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      setErrorMessage(message);
      setSuccessMessage(null);
      
      // Toast di errore
      toast.error(`❌ Errore: ${message}`, {
        duration: 7000,
        description: 'Riprova o contatta il supporto se il problema persiste.',
        icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      });
      
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Edit2 className="h-4 w-4" />
        Modifica Fee
      </Button>
      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Modifica Platform Fee</DialogTitle>
            <DialogDescription>
              Imposta una fee personalizzata per questo utente.
              Lascia vuoto per tornare al default (€0.50).
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Messaggio di successo */}
            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900">
                    ✅ {successMessage}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Salvataggio completato con successo!
                  </p>
                </div>
              </div>
            )}
            
            {/* Messaggio di errore */}
            {errorMessage && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">
                    ❌ Errore: {errorMessage}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Riprova o contatta il supporto se il problema persiste.
                  </p>
                </div>
              </div>
            )}
            
            {/* Quick Presets */}
            <div className="space-y-2">
              <Label>Presets rapidi</Label>
              <div className="flex flex-wrap gap-2">
                {FEE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(preset.value)}
                    className="text-xs"
                  >
                    {preset.label}
                    {preset.value !== null && (
                      <span className="ml-1 text-gray-500">
                        €{preset.value.toFixed(2)}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Fee Input */}
            <div className="space-y-2">
              <Label htmlFor="fee">Fee (€)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  €
                </span>
                <Input
                  id="fee"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.50"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-gray-500">
                Vuoto = torna a default (€0.50)
              </p>
            </div>
            
            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Note (opzionale)</Label>
              <Textarea
                id="notes"
                placeholder="es. Accordo commerciale cliente enterprise"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Annulla
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                'Salva'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
