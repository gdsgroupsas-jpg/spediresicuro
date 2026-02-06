/**
 * Pagina: Accept Workspace Invitation
 *
 * Pagina pubblica per accettare inviti al workspace
 * - Verifica validità token
 * - Mostra info workspace
 * - Auto-accept quando utente è loggato
 * - Permette di accettare l'invito (richiede login)
 *
 * @module app/invite/[token]
 */

'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Shield,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { shouldAutoAccept } from '@/lib/invite-flow-helpers';
import { WelcomeGate } from '@/components/invite/welcome-gate';
import { getRoleLabel } from '@/lib/welcome-gate-helpers';

interface InvitationInfo {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  organization: {
    name: string;
    branding: {
      logo_url?: string;
      primary_color?: string;
    };
  };
}

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptResult, setAcceptResult] = useState<{
    success: boolean;
    message: string;
    workspaceId?: string;
  } | null>(null);
  const [showWelcomeGate, setShowWelcomeGate] = useState(false);

  // useRef per guard auto-accept: non causa re-render, semanticamente corretto
  const autoAcceptedRef = useRef(false);

  // Fetch invitation info
  useEffect(() => {
    async function fetchInvitation() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/invite/${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Invito non valido');
          return;
        }

        if (!data.valid) {
          setError('Questo invito non è più valido');
          return;
        }

        setInvitation(data.invitation);
      } catch (err: any) {
        console.error('Error fetching invitation:', err);
        setError("Errore nel caricamento dell'invito");
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      fetchInvitation();
    }
  }, [token]);

  // Logica interna di accettazione (memoizzata, stabile tra render)
  const handleAcceptInternal = useCallback(async () => {
    setIsAccepting(true);

    try {
      const response = await fetch(`/api/invite/${token}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        setAcceptResult({
          success: false,
          message: data.error || "Errore durante l'accettazione",
        });
        return;
      }

      setAcceptResult({
        success: true,
        message: data.message,
        workspaceId: data.workspace?.id,
      });

      // Mostra WelcomeGate animato (il redirect avviene dal suo onComplete)
      setShowWelcomeGate(true);
    } catch (err: any) {
      setAcceptResult({
        success: false,
        message: err.message || 'Errore sconosciuto',
      });
    } finally {
      setIsAccepting(false);
    }
  }, [token, router]);

  // Auto-accept: quando l'utente è loggato e l'invito è valido, accetta automaticamente
  useEffect(() => {
    if (
      shouldAutoAccept({
        sessionStatus,
        hasSession: !!session,
        hasInvitation: !!invitation,
        hasAcceptResult: !!acceptResult,
        isAccepting,
        autoAccepted: autoAcceptedRef.current,
      })
    ) {
      autoAcceptedRef.current = true;
      handleAcceptInternal();
    }
  }, [sessionStatus, session, invitation, acceptResult, isAccepting, handleAcceptInternal]);

  // Accept invitation (click manuale - fallback se auto-accept non parte)
  const handleAccept = useCallback(async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/invite/${token}`);
      return;
    }

    handleAcceptInternal();
  }, [session, router, token, handleAcceptInternal]);

  // Reset per "Riprova" dopo errore
  const handleRetry = useCallback(() => {
    setAcceptResult(null);
    autoAcceptedRef.current = false;
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Verifica invito in corso...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invito Non Valido</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/">
            <Button variant="outline" className="w-full">
              Torna alla Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // WelcomeGate — schermata cinematografica dopo accept
  if (showWelcomeGate && acceptResult?.success && invitation) {
    return (
      <WelcomeGate
        userName={session?.user?.name || ''}
        workspaceName={invitation.workspace.name}
        organizationName={invitation.organization.name}
        role={invitation.role}
        onComplete={() => router.push('/dashboard')}
      />
    );
  }

  // Success state (fallback se WelcomeGate non scatta)
  if (acceptResult?.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Benvenuto!</h1>
          <p className="text-gray-600 mb-6">{acceptResult.message}</p>
          <p className="text-sm text-gray-500">Reindirizzamento alla dashboard...</p>
        </div>
      </div>
    );
  }

  // Failed accept state
  if (acceptResult && !acceptResult.success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Errore</h1>
          <p className="text-gray-600 mb-6">{acceptResult.message}</p>
          <Button onClick={handleRetry} variant="outline" className="w-full">
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  // Invitation card
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full">
        {/* Logo/Branding */}
        <div className="text-center mb-6">
          {invitation?.organization?.branding?.logo_url ? (
            <img
              src={invitation.organization.branding.logo_url}
              alt={invitation.organization.name}
              className="h-12 mx-auto mb-4"
            />
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-[#FF9500] to-[#FF6B35] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900">Sei stato invitato!</h1>
        </div>

        {/* Invitation Details */}
        <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Building2 className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Organizzazione</p>
              <p className="font-medium text-gray-900">{invitation?.organization.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Users className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Workspace</p>
              <p className="font-medium text-gray-900">{invitation?.workspace.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Shield className="w-5 h-5 text-[#FF9500]" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Ruolo assegnato</p>
              <p className="font-medium text-gray-900">{getRoleLabel(invitation?.role || '')}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        {session ? (
          // Auto-accept in corso
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF9500] mx-auto mb-3" />
            <p className="text-gray-600">Accettazione in corso...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-center text-gray-600">
              Per accettare l&apos;invito devi effettuare l&apos;accesso
            </p>
            <Button
              onClick={() => router.push(`/login?callbackUrl=/invite/${token}`)}
              className="w-full bg-gradient-to-r from-[#FF9500] to-[#FF6B35] hover:from-[#E88500] hover:to-[#E55A2B] shadow-lg"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Accedi per continuare
            </Button>
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => router.push(`/login?mode=register&callbackUrl=/invite/${token}`)}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Crea un nuovo account
            </Button>
          </div>
        )}

        {/* Expiry notice */}
        {invitation?.expires_at && (
          <p className="text-xs text-center text-gray-500 mt-4">
            Questo invito scade il{' '}
            {new Date(invitation.expires_at).toLocaleDateString('it-IT', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
