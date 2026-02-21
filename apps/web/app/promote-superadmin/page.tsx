/**
 * Pagina: Auto-Promozione Superadmin
 *
 * Permette agli utenti autorizzati di promuoversi a superadmin
 * senza accesso diretto al database Supabase
 */

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Shield, CheckCircle2, AlertCircle, LogOut, ArrowRight } from 'lucide-react';

export default function PromoteSuperadminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    action?: string;
    nextSteps?: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePromote() {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/auth/promote-superadmin', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Errore durante la promozione');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Errore durante la promozione');
    } finally {
      setIsLoading(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Promozione Superadmin</h1>
            <p className="text-gray-600">
              Email corrente: <strong>{session.user?.email || 'Non disponibile'}</strong>
            </p>
          </div>

          {/* Info */}
          {!result && !error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                ℹ️ Questa funzione promuove automaticamente il tuo account a{' '}
                <strong>Superadmin</strong>
                se la tua email è nella lista autorizzata.
              </p>
            </div>
          )}

          {/* Errore */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 mb-1">Errore</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {/* Successo */}
          {result?.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 text-lg mb-1">
                    ✅ Promozione Completata!
                  </h3>
                  <p className="text-sm text-green-700">{result.message}</p>
                  {result.action && (
                    <p className="text-xs text-green-600 mt-1">
                      Azione: {result.action === 'created' ? 'Utente creato' : 'Utente aggiornato'}
                    </p>
                  )}
                </div>
              </div>

              {/* Next Steps */}
              {result.nextSteps && result.nextSteps.length > 0 && (
                <div className="mt-4 pt-4 border-t border-green-200">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Prossimi Passi:
                  </h4>
                  <ol className="space-y-2">
                    {result.nextSteps.map((step, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-green-700">
                        <span className="font-bold text-green-600">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Pulsanti Azione */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    // Logout completo e redirect
                    window.location.href = '/api/auth/signout?callbackUrl=/login';
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg transition-colors shadow-lg"
                >
                  <LogOut className="w-5 h-5" />
                  Logout e Riaccedi ORA
                </button>
              </div>
              <div className="mt-4 bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                <p className="text-sm text-amber-900 font-bold text-center">
                  ⚠️ IMPORTANTE: Devi fare logout completo e login di nuovo per applicare i permessi
                  superadmin!
                </p>
              </div>
            </div>
          )}

          {/* Pulsante Promozione */}
          {!result && (
            <button
              onClick={handlePromote}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Promozione in corso...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Promuovi a Superadmin
                </>
              )}
            </button>
          )}

          {/* Email Autorizzate */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">📧 Email Autorizzate:</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• sigorn@hotmail.it</li>
              <li>• gdsgroupsas@gmail.com</li>
              <li>• admin@spediresicuro.it</li>
              <li>• salvatore.squillante@gmail.com</li>
            </ul>
          </div>
        </div>

        {/* Back */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            ← Torna alla Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
