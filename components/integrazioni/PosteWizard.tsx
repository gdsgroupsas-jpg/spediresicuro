'use client';

import { useState } from 'react';
import {
  Truck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Zap,
  Save,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { saveConfiguration } from '@/actions/configurations';

interface PosteWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = 'welcome' | 'credentials' | 'testing' | 'success';

export default function PosteWizard({ onClose, onSuccess }: PosteWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    baseUrl: 'https://apiw.gp.posteitaliane.it/gp/internet',
    cdc: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    setError(null);

    if (step === 'welcome') {
      setStep('credentials');
      return;
    }

    if (step === 'credentials') {
      if (!formData.clientId.trim() || !formData.clientSecret.trim()) {
        setError('Client ID e Secret ID sono obbligatori');
        return;
      }
      setStep('testing');
      testAndSave();
      return;
    }
  };

  const testAndSave = async () => {
    setIsTesting(true);
    try {
      // Simulate connection test
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Save configuration
      // Mapping: api_key -> client_id, api_secret -> client_secret
      const configInput = {
        name: 'Poste Italiane - API',
        provider_id: 'poste',
        api_key: formData.clientId,
        api_secret: formData.clientSecret,
        base_url: formData.baseUrl,
        contract_mapping: {
          cdc: formData.cdc || 'CDC-DEFAULT',
        },
        is_active: true,
        is_default: true,
        description: 'Configurazione creata tramite Wizard',
      };

      const result = await saveConfiguration(configInput);

      if (result.success) {
        setStep('success');
      } else {
        setError(result.error || 'Errore durante il salvataggio');
        setStep('credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Errore di connessione');
      setStep('credentials');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="bg-yellow-400 p-6 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Truck className="w-8 h-8 text-blue-900" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-blue-900">Configura Poste Italiane</h2>
              <p className="text-blue-900/80 font-medium">Wizard di configurazione automatica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-black/10 rounded-full transition-colors text-blue-900"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[400px] flex flex-col">
          {step === 'welcome' && (
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Pronto per iniziare?</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Questo wizard ti aiuterà a collegare il tuo account Poste Italiane in pochi
                  secondi. Tieni a portata di mano <strong>Client ID</strong> e{' '}
                  <strong>Secret ID</strong>.
                </p>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>📋 Non hai ancora le credenziali?</strong>
                    <br />
                    Devi prima registrare l&apos;applicazione nel portale Poste Delivery Business.
                    Consulta la{' '}
                    <a
                      href="/docs/GUIDA_REGISTRAZIONE_POSTE.md"
                      target="_blank"
                      className="underline font-semibold"
                    >
                      guida completa
                    </a>{' '}
                    per i dettagli.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <ShieldCheck className="w-6 h-6 text-green-600 mb-2" />
                  <h4 className="font-semibold text-gray-900">Sicuro</h4>
                  <p className="text-sm text-gray-500">Credenziali crittografate</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Zap className="w-6 h-6 text-yellow-500 mb-2" />
                  <h4 className="font-semibold text-gray-900">Veloce</h4>
                  <p className="text-sm text-gray-500">Setup istantaneo</p>
                </div>
              </div>
            </div>
          )}

          {step === 'credentials' && (
            <div className="space-y-6 flex-1">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Inserisci Credenziali</h3>
                <p className="text-gray-500 text-sm">
                  Inserisci i dati Client ID e Secret ID forniti dal portale Poste.
                  <br />
                  <a
                    href="/docs/GUIDA_REGISTRAZIONE_POSTE.md"
                    target="_blank"
                    className="text-blue-600 hover:underline text-xs"
                  >
                    📖 Non sai come ottenerli? Leggi la guida
                  </a>
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
                  <input
                    type="url"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 font-mono text-sm"
                    readOnly
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    L&apos;endpoint standard di produzione è preimpostato.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                  <input
                    type="text"
                    placeholder="Incolla il Client ID..."
                    value={formData.clientId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, clientId: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Secret ID</label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      placeholder="Incolla il Secret ID..."
                      value={formData.clientSecret}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, clientSecret: e.target.value }))
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Codice Centro di Costo (CDC)
                  </label>
                  <input
                    type="text"
                    placeholder="Es. CDC-123456"
                    value={formData.cdc}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cdc: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Opzionale. Se non lo conosci, verrà usato il default.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'testing' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-blue-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Truck className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Verifica in corso...</h3>
                <p className="text-gray-500">
                  Stiamo testando la connessione ai server Poste Italiane.
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in zoom-in duration-300">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900">Tutto Pronto!</h3>
                <p className="text-gray-600 max-w-sm mx-auto">
                  La connessione è stata stabilita con successo. Ora puoi creare spedizioni con
                  Poste Italiane.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          {step !== 'success' && step !== 'testing' && (
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annulla
            </button>
          )}

          <div className="ml-auto">
            {step === 'welcome' && (
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 group"
              >
                Inizia Configurazione
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            {step === 'credentials' && (
              <button
                onClick={handleNext}
                disabled={!formData.clientId || !formData.clientSecret}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Verifica & Salva
                <ArrowRight className="w-5 h-5" />
              </button>
            )}

            {step === 'success' && (
              <button
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-8 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-green-500/30 flex items-center gap-2"
              >
                Completa
                <CheckCircle2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
