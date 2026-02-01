/**
 * ActionConfirmCard
 *
 * Card inline nella chat di Anne che mostra un'azione proposta
 * con dettagli, costo opzionale, e bottoni Conferma/Annulla.
 * Usata per il confirmation flow del support system.
 */

'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

export interface ActionConfirmCardProps {
  actionId: string;
  type: string;
  description: string;
  cost?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionConfirmCard({
  actionId,
  type,
  description,
  cost,
  onConfirm,
  onCancel,
}: ActionConfirmCardProps) {
  const [status, setStatus] = useState<'pending' | 'confirming' | 'confirmed' | 'cancelled'>(
    'pending'
  );

  const handleConfirm = () => {
    setStatus('confirming');
    onConfirm();
    // Lo stato 'confirmed' sara impostato dal parent dopo la risposta
    setTimeout(() => setStatus('confirmed'), 500);
  };

  const handleCancel = () => {
    setStatus('cancelled');
    onCancel();
  };

  if (status === 'confirmed') {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
        <CheckCircle className="w-4 h-4 flex-shrink-0" />
        <span>Azione confermata ed eseguita.</span>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
        <XCircle className="w-4 h-4 flex-shrink-0" />
        <span>Azione annullata.</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-purple-900">Conferma azione</p>
          <p className="text-purple-700 mt-1">{description}</p>
          {cost !== undefined && cost > 0 && (
            <p className="text-purple-800 font-semibold mt-1">Costo: &euro;{cost.toFixed(2)}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleConfirm}
          disabled={status === 'confirming'}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors text-xs font-medium"
        >
          {status === 'confirming' ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CheckCircle className="w-3 h-3" />
          )}
          Conferma
        </button>
        <button
          onClick={handleCancel}
          disabled={status === 'confirming'}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-xs font-medium"
        >
          <XCircle className="w-3 h-3" />
          Annulla
        </button>
      </div>
    </div>
  );
}
