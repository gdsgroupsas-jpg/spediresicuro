/**
 * Callback Supabase Auth - Auto-login dopo Conferma Email
 * 
 * Gestisce il redirect dopo click link conferma email.
 * Imposta sessione Supabase, sincronizza con NextAuth, pulisce URL e reindirizza a dashboard.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Elaborazione conferma email...');

  useEffect(() => {
    async function handleCallback() {
      try {
        // Leggi hash dall'URL (Supabase passa token qui)
        const hash = window.location.hash;
        
        console.log('🔐 [AUTH CALLBACK] Hash ricevuto:', hash ? 'presente' : 'assente');
        
        // Verifica se contiene token Supabase
        const hasAccessToken = hash.includes('access_token=');
        const hasRefreshToken = hash.includes('refresh_token=');
        const isSignup = hash.includes('type=signup') || hash.includes('type=recovery');
        
        if (!hasAccessToken && !hasRefreshToken && !isSignup) {
          console.log('ℹ️ [AUTH CALLBACK] Nessun token rilevato, redirect a /login');
          router.replace('/login');
          return;
        }

        console.log('✅ [AUTH CALLBACK] Token Supabase rilevato, impostazione sessione...');
        setMessage('Conferma email in corso...');

        // ⚠️ CRITICO: Estrai token dal hash
        const hashParams = new URLSearchParams(hash.substring(1)); // Rimuovi #
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        
        if (!accessToken || !refreshToken) {
          throw new Error('Token mancanti nel hash');
        }

        console.log('✅ [AUTH CALLBACK] Token estratti dal hash');

        // Imposta sessione Supabase
        const { data: { session: supabaseSession }, error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (setError || !supabaseSession?.user) {
          console.error('❌ [AUTH CALLBACK] Errore impostazione sessione Supabase:', setError);
          throw setError || new Error('Sessione non disponibile');
        }

        const userEmail = supabaseSession.user.email;
        if (!userEmail) {
          throw new Error('Email utente non disponibile');
        }

        console.log('✅ [AUTH CALLBACK] Email confermata per:', userEmail);
        setMessage('Email confermata! Accesso in corso...');

        // ⚠️ CRITICO: Pulisci URL PRIMA di fare login NextAuth
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
        console.log('✅ [AUTH CALLBACK] URL pulito');

        // ⚠️ CRITICO: Ottieni token temporaneo per auto-login NextAuth
        console.log('🔄 [AUTH CALLBACK] Richiesta token temporaneo per auto-login...');
        
        const response = await fetch('/api/auth/supabase-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: accessToken,
            refreshToken: refreshToken,
            email: userEmail,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ [AUTH CALLBACK] Errore richiesta token temporaneo:', errorData);
          throw new Error(errorData.error || 'Errore durante accesso');
        }

        const { success, tempToken, redirectTo } = await response.json();
        
        if (!success || !tempToken) {
          throw new Error('Token temporaneo non disponibile');
        }

        console.log('✅ [AUTH CALLBACK] Token temporaneo ricevuto, login NextAuth...');

        // ⚠️ CRITICO: Usa token temporaneo come password per signIn NextAuth
        const signInResult = await signIn('credentials', {
          email: userEmail,
          password: tempToken, // Token temporaneo riconosciuto da verifyUserCredentials
          redirect: false,
        });

        if (signInResult?.error) {
          console.error('❌ [AUTH CALLBACK] Errore signIn NextAuth:', signInResult.error);
          throw new Error(signInResult.error);
        }

        if (!signInResult?.ok) {
          throw new Error('Login fallito');
        }

        console.log('✅ [AUTH CALLBACK] Auto-login completato, redirect a:', redirectTo);
        setStatus('success');
        setMessage('Email confermata ✅ Accesso effettuato');

        // Forza refresh sessione
        const { getSession } = await import('next-auth/react');
        await getSession();

        // ⚠️ P0 FIX: Usa window.location.href per forzare redirect (bypass NextAuth redirect automatico)
        // Questo evita che NextAuth faccia redirect a / anche con redirect: false
        const finalRedirect = redirectTo || '/dashboard/dati-cliente';
        console.log('🔄 [AUTH CALLBACK] Redirect forzato a:', finalRedirect);
        window.location.href = finalRedirect;

      } catch (error: any) {
        console.error('❌ [AUTH CALLBACK] Errore:', error);
        setStatus('error');
        setMessage('Errore durante conferma email. Riprova il login.');
        
        // Redirect a login dopo 2 secondi
        setTimeout(() => {
          router.replace('/login?error=callback_failed');
        }, 2000);
      }
    }

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
      <div className="text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-[#FF9500] mx-auto mb-4" />
            <p className="text-gray-600">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-4" />
            <p className="text-green-700 font-semibold">{message}</p>
            <p className="text-sm text-gray-600 mt-2">Reindirizzamento in corso...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-8 h-8 text-red-600 mx-auto mb-4">⚠️</div>
            <p className="text-red-700">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}

