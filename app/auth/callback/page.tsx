/**
 * Callback Supabase Auth - Conferma Email
 * 
 * Gestisce il redirect dopo click link conferma email.
 * Pulisce URL da token e reindirizza a /login con messaggio.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Leggi hash dall'URL (Supabase passa token qui)
    const hash = window.location.hash;
    
    console.log('🔐 [AUTH CALLBACK] Hash ricevuto:', hash ? 'presente' : 'assente');
    
    // Verifica se contiene token Supabase
    const hasAccessToken = hash.includes('access_token=');
    const hasRefreshToken = hash.includes('refresh_token=');
    const isSignup = hash.includes('type=signup') || hash.includes('type=recovery');
    
    if (hasAccessToken || hasRefreshToken || isSignup) {
      console.log('✅ [AUTH CALLBACK] Token Supabase rilevato, pulizia URL...');
      
      // ⚠️ CRITICO: Rimuovi hash dall'URL (pulisce token)
      // Usa replaceState per non aggiungere entry alla history
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search
      );
      
      console.log('✅ [AUTH CALLBACK] URL pulito, redirect a /login?confirmed=1');
      
      // Redirect a /login con flag confirmed=1
      router.replace('/login?confirmed=1');
    } else {
      // Se non c'è hash/token, redirect diretto a login
      console.log('ℹ️ [AUTH CALLBACK] Nessun token rilevato, redirect a /login');
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF9500] mx-auto mb-4" />
        <p className="text-gray-600">Elaborazione conferma email...</p>
      </div>
    </div>
  );
}

