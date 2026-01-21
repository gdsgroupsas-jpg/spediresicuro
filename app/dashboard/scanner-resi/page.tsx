/**
 * Pagina: Scanner Resi
 *
 * Pagina dedicata per la scansione LDV dei resi
 */

'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import DashboardNav from '@/components/dashboard-nav';
import { ScanLine } from 'lucide-react';

// Carica lo scanner solo quando serve (dynamic import per performance)
const ReturnScanner = dynamic(() => import('@/components/ReturnScanner'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-4"></div>
        <p className="text-gray-600">Caricamento scanner...</p>
      </div>
    </div>
  ),
});

export default function ScannerResiPage() {
  const [showScanner, setShowScanner] = useState(true);

  const handleSuccess = (returnShipment: any, originalShipment: any) => {
    console.log('Reso registrato con successo:', { returnShipment, originalShipment });
    // Qui puoi aggiungere logica per aggiornare la lista o reindirizzare
  };

  const handleClose = () => {
    setShowScanner(false);
    // Reindirizza alla pagina resi dopo la chiusura
    setTimeout(() => {
      window.location.href = '/dashboard/resi';
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav title="Scanner Resi" subtitle="Scansiona il codice LDV del reso" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!showScanner ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <ScanLine className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Scanner chiuso</h3>
            <p className="text-gray-500 mb-6">Lo scanner è stato chiuso.</p>
            <button
              onClick={() => setShowScanner(true)}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Riapri Scanner
            </button>
          </div>
        ) : (
          <ReturnScanner onClose={handleClose} onSuccess={handleSuccess} />
        )}
      </div>
    </div>
  );
}
