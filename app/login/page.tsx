/**
 * Pagina Login
 * 
 * Pagina di autenticazione per accedere al dashboard.
 * Design moderno e professionale.
 */

'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, Lock, AlertCircle, Loader2, UserPlus, User, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { LogoHorizontal } from '@/components/logo';

type AuthMode = 'login' | 'register';

// Componente per i pulsanti OAuth
function OAuthButtons({ isLoading }: { isLoading: boolean }) {
  const [oauthProviders, setOauthProviders] = useState<string[]>([]);

  // Verifica quali provider OAuth sono configurati
  useEffect(() => {
    const providers: string[] = [];
    
    // I provider OAuth sono configurati lato server, quindi mostriamo sempre i pulsanti
    // Se non configurati, NextAuth mostrerà un errore appropriato
    providers.push('google', 'github', 'facebook');
    
    setOauthProviders(providers);
  }, []);

  if (oauthProviders.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">Oppure accedi con</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* Google OAuth */}
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span>Continua con Google</span>
        </button>

        {/* GitHub OAuth */}
        <button
          type="button"
          onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-gray-900 border border-gray-900 rounded-xl font-medium text-white hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>Continua con GitHub</span>
        </button>

        {/* Facebook OAuth */}
        <button
          type="button"
          onClick={() => signIn('facebook', { callbackUrl: '/dashboard' })}
          disabled={isLoading}
          className="w-full px-4 py-3 bg-[#1877F2] border border-[#1877F2] rounded-xl font-medium text-white hover:bg-[#166FE5] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Continua con Facebook</span>
        </button>
      </div>

      <div className="relative mt-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">Oppure</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (mode === 'register') {
        // Validazione registrazione
        if (!name.trim()) {
          setError('Il nome è obbligatorio');
          setIsLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          setError('Le password non corrispondono');
          setIsLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('La password deve essere di almeno 6 caratteri');
          setIsLoading(false);
          return;
        }

        // Registrazione
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            name: name.trim(),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Errore durante la registrazione');
          setIsLoading(false);
          return;
        }

        // Registrazione completata, passa al login
        setSuccess('Registrazione completata! Ora puoi accedere.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setIsLoading(false);
      } else {
        // Login
        const result = await signIn('credentials', {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          setError('Credenziali non valide. Riprova.');
        } else if (result?.ok) {
          // Refresh session prima di navigare
          router.refresh();

          // Verifica se i dati cliente sono completati
          try {
            const userDataResponse = await fetch('/api/user/dati-cliente');
            if (userDataResponse.ok) {
              const userData = await userDataResponse.json();
              // Se i dati non sono completati, reindirizza alla pagina dati-cliente
              if (!userData.datiCliente || !userData.datiCliente.datiCompletati) {
                router.push('/dashboard/dati-cliente');
              } else {
                router.push('/dashboard');
              }
            } else {
              // Se non riesce a recuperare i dati, reindirizza comunque al dashboard
              router.push('/dashboard');
            }
          } catch (err) {
            // In caso di errore, reindirizza al dashboard
            router.push('/dashboard');
          }
        }
        setIsLoading(false);
      }
    } catch (err) {
      setError(
        mode === 'register'
          ? 'Errore durante la registrazione. Riprova.'
          : 'Errore durante il login. Riprova.'
      );
      console.error('Errore:', err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <LogoHorizontal
              className="h-16 w-auto mx-auto"
              width={400}
              height={133}
            />
          </Link>
        </div>

        {/* Card Login/Registrazione */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8">
          {/* Toggle Login/Registrazione */}
          <div className="mb-6">
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                  mode === 'login'
                    ? 'bg-white text-[#FF9500] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Accedi
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
                  mode === 'register'
                    ? 'bg-white text-[#FF9500] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Registrati
                </div>
              </button>
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {mode === 'login' ? 'Accedi al Dashboard' : 'Crea il tuo Account'}
            </h1>
            <p className="text-gray-600">
              {mode === 'login'
                ? 'Inserisci le tue credenziali per accedere'
                : 'Registrati per iniziare a gestire le tue spedizioni'}
            </p>
          </div>

          {/* OAuth Providers - Solo per Login */}
          {mode === 'login' && (
            <OAuthButtons isLoading={isLoading} />
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome (solo per registrazione) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={mode === 'register'}
                    placeholder="Mario Rossi"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] transition-all bg-gray-50 hover:bg-white text-gray-900 placeholder:text-gray-400"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="email@esempio.it"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] transition-all bg-gray-50 hover:bg-white text-gray-900 placeholder:text-gray-400"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={mode === 'register' ? 'Minimo 6 caratteri' : '••••••••'}
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] transition-all bg-gray-50 hover:bg-white text-gray-900 placeholder:text-gray-400"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Conferma Password (solo per registrazione) */}
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Conferma Password
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Ripeti la password"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700]/20 focus:border-[#FF9500] transition-all bg-gray-50 hover:bg-white text-gray-900 placeholder:text-gray-400"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {mode === 'register' ? 'Registrazione in corso...' : 'Accesso in corso...'}
                </>
              ) : (
                <>
                  {mode === 'register' ? (
                    <>
                      <UserPlus className="w-5 h-5" />
                      Registrati
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      Accedi
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials (solo per login) */}
          {mode === 'login' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-xs font-semibold text-blue-900 mb-2">
                💡 Credenziali Demo (Sviluppo)
              </p>
              <div className="text-xs text-blue-700 space-y-1">
                <p>
                  <strong>Admin:</strong> admin@spediresicuro.it / admin123
                </p>
                <p>
                  <strong>Demo:</strong> demo@spediresicuro.it / demo123
                </p>
              </div>
            </div>
          )}

          {/* Link Home */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-[#FF9500] transition-colors"
            >
              ← Torna alla home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

