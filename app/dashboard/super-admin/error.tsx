'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('Super Admin Page Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-indigo-50/20 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Errore nel pannello admin</h1>
        <p className="text-gray-600 mb-6">
          {error.message || 'Errore imprevisto nel caricamento del pannello Super Admin'}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">Digest: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Riprova
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = '/dashboard')}>
            Torna alla dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
