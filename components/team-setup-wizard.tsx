'use client';

/**
 * TeamSetupWizard - Wizard guidato per primo setup team reseller
 *
 * Mostrato quando il reseller ha solo se stesso nel workspace.
 * Guida l'utente a invitare il primo operatore/membro.
 *
 * Steps:
 * 1. Benvenuto - Spiega i vantaggi del team
 * 2. Invita - Form email + ruolo
 * 3. Risultato - Conferma successo o errore
 *
 * @module components/team-setup-wizard
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Users,
  UserPlus,
  Mail,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Copy,
  Package,
  Shield,
  Eye,
  UserCog,
  Loader2,
  SkipForward,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface TeamSetupWizardProps {
  workspaceId: string;
  workspaceName: string;
  /** Callback quando wizard completato (invito inviato o skip) */
  onComplete: () => void;
  /** Callback per saltare il wizard */
  onSkip: () => void;
}

type WizardStep = 'welcome' | 'invite' | 'result';

interface InviteResult {
  success: boolean;
  message: string;
  url?: string;
}

// ============================================
// COMPONENT
// ============================================

export function TeamSetupWizard({
  workspaceId,
  workspaceName,
  onComplete,
  onSkip,
}: TeamSetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'operator' | 'admin' | 'viewer'>('operator');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);

  // ============================================
  // HANDLERS
  // ============================================

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          message: data.error || "Errore durante l'invito",
        });
      } else {
        setResult({
          success: true,
          message: data.message || 'Invito inviato con successo!',
          url: data.invitation?.invite_url,
        });
      }

      setStep('result');
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Errore di connessione',
      });
      setStep('result');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiato negli appunti!');
  };

  // ============================================
  // STEP INDICATORS
  // ============================================

  const steps = [
    { key: 'welcome', label: 'Benvenuto', icon: Users },
    { key: 'invite', label: 'Invita', icon: UserPlus },
    { key: 'result', label: 'Fatto', icon: CheckCircle2 },
  ] as const;

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentStepIndex;
          const isCompleted = i < currentStepIndex;

          return (
            <div key={s.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#FF9500] to-[#FF6B35] text-white shadow-lg'
                      : isCompleted
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`text-xs mt-1 ${isActive ? 'text-[#FF9500] font-semibold' : 'text-gray-500'}`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-16 h-0.5 mx-2 mb-5 ${
                    i < currentStepIndex ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {step === 'welcome' && (
        <StepWelcome
          workspaceName={workspaceName}
          onNext={() => setStep('invite')}
          onSkip={onSkip}
        />
      )}

      {step === 'invite' && (
        <StepInvite
          email={email}
          setEmail={setEmail}
          role={role}
          setRole={setRole}
          isSubmitting={isSubmitting}
          onSubmit={handleInvite}
          onBack={() => setStep('welcome')}
        />
      )}

      {step === 'result' && (
        <StepResult
          result={result}
          onCopyLink={copyToClipboard}
          onInviteAnother={() => {
            setEmail('');
            setRole('operator');
            setResult(null);
            setStep('invite');
          }}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}

// ============================================
// STEP: WELCOME
// ============================================

function StepWelcome({
  workspaceName,
  onNext,
  onSkip,
}: {
  workspaceName: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="text-center">
      {/* Icona hero */}
      <div className="w-20 h-20 bg-gradient-to-br from-[#FF9500]/20 to-[#FF6B35]/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <Users className="w-10 h-10 text-[#FF9500]" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-3">Configura il tuo Team</h2>
      <p className="text-gray-600 mb-8 max-w-md mx-auto">
        Invita i tuoi collaboratori nel workspace &quot;{workspaceName}&quot; per gestire le
        spedizioni insieme.
      </p>

      {/* Vantaggi */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <Package className="w-8 h-8 text-blue-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-blue-900 mb-1">Operatori</h4>
          <p className="text-xs text-blue-700">Possono creare e gestire spedizioni</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          <Shield className="w-8 h-8 text-amber-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-amber-900 mb-1">Amministratori</h4>
          <p className="text-xs text-amber-700">Gestiscono team e impostazioni</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <Eye className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-emerald-900 mb-1">Visualizzatori</h4>
          <p className="text-xs text-emerald-700">Monitorano spedizioni e statistiche</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          onClick={onNext}
          className="bg-gradient-to-r from-[#FF9500] to-[#FF6B35] hover:from-[#E88500] hover:to-[#E55A2B] text-white px-8"
          size="lg"
        >
          Invita il primo membro
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
        <Button variant="ghost" onClick={onSkip} className="text-gray-500">
          <SkipForward className="w-4 h-4 mr-2" />
          Faro dopo
        </Button>
      </div>
    </div>
  );
}

// ============================================
// STEP: INVITE
// ============================================

function StepInvite({
  email,
  setEmail,
  role,
  setRole,
  isSubmitting,
  onSubmit,
  onBack,
}: {
  email: string;
  setEmail: (v: string) => void;
  role: 'operator' | 'admin' | 'viewer';
  setRole: (v: 'operator' | 'admin' | 'viewer') => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  const roles = [
    {
      value: 'operator' as const,
      label: 'Operatore',
      description: 'Crea e gestisce spedizioni per i clienti',
      icon: UserCog,
      recommended: true,
    },
    {
      value: 'admin' as const,
      label: 'Amministratore',
      description: 'Gestisce team, impostazioni e fatturazione',
      icon: Shield,
      recommended: false,
    },
    {
      value: 'viewer' as const,
      label: 'Visualizzatore',
      description: 'Solo consultazione dati e statistiche',
      icon: Eye,
      recommended: false,
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Invita un membro</h2>
      <p className="text-gray-600 mb-6 text-center">
        Inserisci l&apos;email del collaboratore e scegli il suo ruolo
      </p>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email del collaboratore <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="nome@azienda.it"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF9500] focus:border-[#FF9500] disabled:opacity-50 text-sm"
            />
          </div>
        </div>

        {/* Ruolo con card selezionabili */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">Ruolo</label>
          <div className="space-y-2">
            {roles.map((r) => {
              const Icon = r.icon;
              const isSelected = role === r.value;

              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRole(r.value)}
                  disabled={isSubmitting}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? 'border-[#FF9500] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  } disabled:opacity-50`}
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-[#FF9500] text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${isSelected ? 'text-[#FF9500]' : 'text-gray-900'}`}
                      >
                        {r.label}
                      </span>
                      {r.recommended && (
                        <span className="text-[10px] bg-[#FF9500] text-white px-1.5 py-0.5 rounded-full font-medium">
                          Consigliato
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{r.description}</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-[#FF9500]' : 'border-gray-300'
                    }`}
                  >
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#FF9500]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !email}
            className="bg-gradient-to-r from-[#FF9500] to-[#FF6B35] hover:from-[#E88500] hover:to-[#E55A2B] text-white px-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Invio in corso...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Invia Invito
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ============================================
// STEP: RESULT
// ============================================

function StepResult({
  result,
  onCopyLink,
  onInviteAnother,
  onComplete,
}: {
  result: InviteResult | null;
  onCopyLink: (url: string) => void;
  onInviteAnother: () => void;
  onComplete: () => void;
}) {
  if (!result) return null;

  return (
    <div className="text-center">
      {result.success ? (
        <>
          {/* Successo */}
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Invito Inviato!</h2>
          <p className="text-gray-600 mb-6">{result.message}</p>

          {/* Link invito */}
          {result.url && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-gray-500 mb-2">
                Link invito (puoi anche condividerlo direttamente):
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={result.url}
                  readOnly
                  className="flex-1 text-xs p-2 bg-white border border-gray-200 rounded-lg"
                />
                <Button size="sm" variant="outline" onClick={() => onCopyLink(result.url!)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={onComplete}
              className="bg-gradient-to-r from-[#FF9500] to-[#FF6B35] hover:from-[#E88500] hover:to-[#E55A2B] text-white px-6"
            >
              Vai al Team
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" onClick={onInviteAnother}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invita un altro
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Errore */}
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Errore nell&apos;invio</h2>
          <p className="text-red-600 mb-6">{result.message}</p>

          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={onInviteAnother}
              className="bg-gradient-to-r from-[#FF9500] to-[#FF6B35] hover:from-[#E88500] hover:to-[#E55A2B] text-white px-6"
            >
              Riprova
            </Button>
            <Button variant="outline" onClick={onComplete}>
              Vai al Team
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default TeamSetupWizard;
