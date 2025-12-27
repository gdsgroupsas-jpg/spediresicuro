'use client';

import { Badge } from '@/components/ui/badge';
import { UpdateFeeDialog } from './update-fee-dialog';

interface CurrentFeeDisplayProps {
  userId: string;
  fee: number;
  isCustom: boolean;
  notes: string | null;
}

/**
 * Mostra la fee corrente per un utente con badge custom/default
 * e pulsante per modificarla.
 */
export function CurrentFeeDisplay({
  userId,
  fee,
  isCustom,
  notes,
}: CurrentFeeDisplayProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-gray-900">
            €{fee.toFixed(2)}
          </span>
          <Badge variant={isCustom ? 'default' : 'secondary'}>
            {isCustom ? 'Custom' : 'Default'}
          </Badge>
        </div>
        
        {notes && (
          <p className="text-sm text-gray-600 italic">
            &quot;{notes}&quot;
          </p>
        )}
        
        {!isCustom && (
          <p className="text-xs text-gray-500">
            Fee standard applicata a tutti gli utenti senza override
          </p>
        )}
      </div>
      
      <UpdateFeeDialog
        userId={userId}
        currentFee={isCustom ? fee : null}
        currentNotes={notes}
      />
    </div>
  );
}

