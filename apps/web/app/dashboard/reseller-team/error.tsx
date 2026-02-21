'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ResellerTeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('Reseller Team Page Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Qualcosa è andato storto</h1>
        <p className="text-gray-600 mb-6">
          {error.message || 'Errore imprevisto nel caricamento della pagina'}
        </p>
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Riprova
        </Button>
      </div>
    </div>
  );
}
