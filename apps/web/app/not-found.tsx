import Link from 'next/link';

/**
 * 404 Not Found Page
 *
 * Pagina mostrata quando una route non viene trovata
 */

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Pagina non trovata</h2>
        <p className="text-gray-600 mb-6">
          La pagina che stai cercando non esiste o è stata spostata.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-lg hover:shadow-lg transition-all"
        >
          Torna alla Home
        </Link>
      </div>
    </div>
  );
}
