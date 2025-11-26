'use client';

/**
 * Error Boundary Component
 * 
 * Gestisce gli errori globali dell'applicazione
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Qualcosa è andato storto
        </h1>
        <p className="text-gray-600 mb-6">
          {error.message || 'Si è verificato un errore imprevisto'}
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
        >
          Riprova
        </button>
      </div>
    </div>
  );
}

