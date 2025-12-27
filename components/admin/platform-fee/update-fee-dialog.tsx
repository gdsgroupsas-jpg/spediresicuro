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
import { Edit2, Loader2 } from 'lucide-react';

interface UpdateFeeDialogProps {
  userId: string;
  currentFee: number | null;
  currentNotes: string | null;
}

// Quick presets per fee comuni
const FEE_PRESETS = [
  { label: 'Enterprise', value: 0.30, description: 'Volume alto' },
  { label: 'Standard', value: 0.50, description: 'Default' },
  { label: 'VIP', value: 0.00, description: 'Gratis' },
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
      toast.error('Fee non valida. Inserisci un valore >= 0 o lascia vuoto per reset.');
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
      
      toast.success('Fee aggiornata con successo');
      setOpen(false);
      router.refresh();
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore sconosciuto';
      toast.error(message);
    } finally {
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
