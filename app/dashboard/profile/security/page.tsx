/**
 * Pagina: Sicurezza Account
 *
 * Permette all'utente di cambiare la propria password.
 */

'use client';

import { useState } from 'react';
import { Lock, Eye, EyeOff, Shield, CheckCircle, AlertCircle, Loader2, Key } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validazioni
  const newPasswordValid = newPassword.length >= 8;
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const passwordsDifferent = currentPassword !== newPassword || newPassword.length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPasswordValid) {
      setError('La nuova password deve essere di almeno 8 caratteri');
      return;
    }

    if (!passwordsMatch) {
      setError('Le password non corrispondono');
      return;
    }

    if (!passwordsDifferent) {
      setError('La nuova password deve essere diversa da quella attuale');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante il cambio password');
      }

      setSuccess(true);
      // Reset form
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Nascondi messaggio successo dopo 5 secondi
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      setError(err.message || 'Errore durante il cambio password. Riprova.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DashboardNav
        title="Sicurezza Account"
        subtitle="Gestisci la tua password e le impostazioni di sicurezza"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Sicurezza', href: '/dashboard/profile/security' },
        ]}
      />

      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header informativo */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-semibold text-blue-900 mb-2">
                  Proteggi il tuo account
                </h2>
                <p className="text-sm text-blue-800 leading-relaxed">
                  Per la tua sicurezza, utilizza una password forte con almeno 8 caratteri,
                  combinando lettere, numeri e simboli. Non condividere mai la tua password.
                </p>
              </div>
            </div>
          </div>

          {/* Form Cambio Password */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Key className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Cambia Password</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Inserisci la tua password attuale e scegli una nuova password sicura.
                </p>
              </div>
            </div>

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Password cambiata con successo!
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    Abbiamo inviato una conferma via email.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Password Attuale */}
              <div>
                <label
                  htmlFor="currentPassword"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Password attuale
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    id="currentPassword"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Inserisci la password attuale"
                    required
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <hr className="border-gray-200" />

              {/* Nuova Password */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Nuova password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimo 8 caratteri"
                    required
                    minLength={8}
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-amber-500 transition-all ${
                      newPassword && !newPasswordValid ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {newPassword && !newPasswordValid && (
                  <p className="text-red-500 text-xs mt-1.5">
                    La password deve avere almeno 8 caratteri
                  </p>
                )}
                {newPassword && !passwordsDifferent && (
                  <p className="text-red-500 text-xs mt-1.5">
                    La nuova password deve essere diversa
                  </p>
                )}
              </div>

              {/* Conferma Nuova Password */}
              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1.5"
                >
                  Conferma nuova password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ripeti la nuova password"
                    required
                    className={`w-full pl-10 pr-12 py-3 border rounded-xl focus:ring-2 focus:ring-amber-500 transition-all ${
                      confirmPassword && !passwordsMatch ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-red-500 text-xs mt-1.5">Le password non corrispondono</p>
                )}
                {passwordsMatch && confirmPassword && (
                  <p className="text-green-500 text-xs mt-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Password corrispondenti
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  isLoading ||
                  !currentPassword ||
                  !newPasswordValid ||
                  !passwordsMatch ||
                  !passwordsDifferent
                }
                className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Key className="w-5 h-5" />
                    Cambia password
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Link a Privacy */}
          <div className="text-center">
            <a
              href="/dashboard/profile/privacy"
              className="text-sm text-gray-600 hover:text-amber-600 transition-colors"
            >
              Vai a Privacy & Dati Personali →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
