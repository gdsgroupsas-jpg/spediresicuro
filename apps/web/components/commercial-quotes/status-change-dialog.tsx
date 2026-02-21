'use client';

/**
 * Dialog per cambio stato preventivo con note obbligatorie/opzionali.
 *
 * Appare quando il reseller clicca "In trattativa"/"Accetta"/"Rifiuta".
 * Note obbligatorie per rejected/negotiating, opzionali per accepted.
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { CommercialQuoteStatus } from '@/types/commercial-quotes';
import { CheckCircle2, Loader2, MessageSquare, XCircle } from 'lucide-react';
import { useState } from 'react';

const STATUS_META: Record<
  string,
  { title: string; color: string; notesRequired: boolean; placeholder: string }
> = {
  negotiating: {
    title: 'In Trattativa',
    color: 'text-amber-600',
    notesRequired: true,
    placeholder: 'Es: Il cliente richiede uno sconto del 5% sulle zone insulari...',
  },
  accepted: {
    title: 'Accettato',
    color: 'text-green-600',
    notesRequired: false,
    placeholder: 'Es: Accettato senza modifiche, contratto firmato il...',
  },
  rejected: {
    title: 'Rifiutato',
    color: 'text-red-600',
    notesRequired: true,
    placeholder: 'Es: Prezzi troppo alti rispetto alla concorrenza, preferisce BRT...',
  },
};

interface StatusChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetStatus: CommercialQuoteStatus | null;
  onConfirm: (notes: string) => Promise<void>;
}

export function StatusChangeDialog({
  open,
  onOpenChange,
  targetStatus,
  onConfirm,
}: StatusChangeDialogProps) {
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open || !targetStatus) return null;

  const meta = STATUS_META[targetStatus];
  if (!meta) return null;

  const canSubmit = meta.notesRequired ? notes.trim().length > 0 : true;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onConfirm(notes.trim());
      setNotes('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setNotes('');
    onOpenChange(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-5 border-b">
            {targetStatus === 'accepted' && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {targetStatus === 'rejected' && <XCircle className="h-5 w-5 text-red-600" />}
            {targetStatus === 'negotiating' && <MessageSquare className="h-5 w-5 text-amber-600" />}
            <h3 className="text-lg font-semibold text-gray-900">
              Segna come <span className={meta.color}>{meta.title}</span>
            </h3>
          </div>

          {/* Body */}
          <div className="p-5 space-y-3">
            <Label htmlFor="status-notes">
              Note {meta.notesRequired ? '(obbligatorie)' : '(opzionali)'}
            </Label>
            <textarea
              id="status-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={meta.placeholder}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              autoFocus
            />
            {meta.notesRequired && notes.trim().length === 0 && (
              <p className="text-xs text-amber-600">Le note sono obbligatorie per questo stato</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 p-5 border-t bg-gray-50 rounded-b-lg">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Annulla
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Conferma
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
