/**
 * Pagina: Fix Admin Access
 * 
 * UI per sistemare permessi admin con un click
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Shield, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'

export default function FixAdminPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFix() {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/debug/fix-my-admin', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Errore durante il fix')
      }

      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Errore durante il fix')
    } finally {
      setIsLoading(false)
    }
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Fix Permessi Admin
            </h1>
            <p className="text-gray-600">
              Sistema i tuoi permessi a superadmin e riporta la sezione Admin
            </p>
          </div>

          {/* Info */}
          {!result && !error && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                ℹ️ Questa funzione sistema automaticamente i permessi del tuo account:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-blue-700">
                <li>• Imposta <strong>role = admin</strong></li>
                <li>• Imposta <strong>account_type = superadmin</strong></li>
                <li>• Imposta <strong>admin_level = 0</strong></li>
                <li>• Mantiene tutte le tue spedizioni</li>
                <li>• NON crea duplicati</li>
              </ul>
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
                    ✅ {result.message}
                  </h3>
                  <p className="text-sm text-green-700">
                    Azione: {result.action === 'created' ? 'Utente creato' : 'Permessi aggiornati'}
                  </p>
                </div>
              </div>

              {/* Changes Before/After */}
              {result.changes && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-3">Modifiche applicate:</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-semibold text-gray-700 mb-2">Prima:</p>
                      <ul className="space-y-1 text-gray-600">
                        <li>• role: <code className="bg-gray-100 px-2 py-0.5 rounded">{result.changes.before.role}</code></li>
                        <li>• account_type: <code className="bg-gray-100 px-2 py-0.5 rounded">{result.changes.before.account_type}</code></li>
                        <li>• admin_level: <code className="bg-gray-100 px-2 py-0.5 rounded">{result.changes.before.admin_level || 'null'}</code></li>
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-green-700 mb-2">Dopo:</p>
                      <ul className="space-y-1 text-green-600">
                        <li>• role: <code className="bg-green-100 px-2 py-0.5 rounded font-semibold">{result.changes.after.role}</code></li>
                        <li>• account_type: <code className="bg-green-100 px-2 py-0.5 rounded font-semibold">{result.changes.after.account_type}</code></li>
                        <li>• admin_level: <code className="bg-green-100 px-2 py-0.5 rounded font-semibold">{result.changes.after.admin_level}</code></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* User Info */}
              {result.user && (
                <div className="mt-4 p-4 bg-white rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2">Info Account:</h4>
                  <ul className="space-y-1 text-sm text-green-700">
                    <li>• Email: <strong>{result.user.email}</strong></li>
                    <li>• Spedizioni: <strong>{result.user.shipments_count || 0}</strong></li>
                    <li>• Ruolo: <strong className="text-red-600">👑 SUPERADMIN</strong></li>
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {result.nextSteps && result.nextSteps.length > 0 && (
                <div className="mt-6 pt-4 border-t border-green-200">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Prossimi Passi:
                  </h4>
                  <ol className="space-y-2">
                    {result.nextSteps.map((step: string, index: number) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-green-700">
                        <span className="font-bold text-green-600">{index + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Pulsante Logout */}
              <div className="mt-6">
                <button
                  onClick={() => {
                    window.location.href = '/api/auth/signout?callbackUrl=/login'
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-lg transition-colors shadow-lg"
                >
                  Logout e Riaccedi ORA
                </button>
              </div>
            </div>
          )}

          {/* Pulsante Fix */}
          {!result && (
            <button
              onClick={handleFix}
              disabled={isLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-lg transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sistemazione in corso...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Sistema Permessi Admin
                </>
              )}
            </button>
          )}
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
  )
}
