'use client';

import { savePersonalConfiguration } from '@/actions/configurations';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  Info,
  Package,
  ShieldCheck,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';

interface SpediamoProWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

type WizardStep = 'welcome' | 'credentials' | 'testing' | 'success';

export default function SpediamoProWizard({ onClose, onSuccess }: SpediamoProWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [formData, setFormData] = useState({
    authCode: '',
    baseUrl: 'https://core.spediamopro.com', // Default produzione
    environment: 'production' as 'production' | 'test',
    configName: '',
  });
  const [showAuthCode, setShowAuthCode] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testDetails, setTestDetails] = useState<string | null>(null);
  const [validationData, setValidationData] = useState<{
    credit: number | null;
    carriersAvailable: string[];
  } | null>(null);

  const handleEnvironmentChange = (env: 'production' | 'test') => {
    const baseUrl =
      env === 'production' ? 'https://core.spediamopro.com' : 'https://core.spediamopro.it';
    setFormData((prev) => ({ ...prev, environment: env, baseUrl }));
  };

  const handleNext = async () => {
    setError(null);
    setTestDetails(null);

    if (step === 'welcome') {
      setStep('credentials');
      return;
    }

    if (step === 'credentials') {
      if (!formData.authCode.trim()) {
        setError('AuthCode obbligatorio');
        return;
      }
      setStep('testing');
      testAndSave();
      return;
    }
  };

  const testAndSave = async () => {
    setIsTesting(true);
    setError(null);
    setTestDetails(null);

    try {
      // Test connessione
      setTestDetails('Verifica credenziali SpediamoPro...');

      const response = await fetch('/api/integrations/validate-spediamopro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authCode: formData.authCode.trim(),
          baseUrl: formData.baseUrl.trim(),
        }),
      });

      const testResult = await response.json();

      if (!testResult.success) {
        throw new Error(testResult.error || 'Errore durante il test di connessione');
      }

      // Salva dati validazione per mostrarli nel success
      setValidationData({
        credit: testResult.data?.credit ?? null,
        carriersAvailable: testResult.data?.carriersAvailable || [],
      });

      setTestDetails('Connessione verificata! Salvataggio configurazione...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Genera contract_mapping dai corrieri disponibili
      // SpediamoPro restituisce codici come BRTEXP, SDASTD, UPSSTD
      const contractMapping: Record<string, string> = {};
      if (testResult.data?.carriersAvailable) {
        for (const carrierCode of testResult.data.carriersAvailable) {
          // Mappa codici SpediamoPro a nomi display
          const displayName = getCarrierDisplayName(carrierCode);
          contractMapping[carrierCode] = displayName;
        }
      }

      // Salva configurazione
      const session = await fetch('/api/auth/session')
        .then((r) => r.json())
        .catch(() => null);
      const userName = session?.user?.name || session?.user?.email || 'Utente';

      const configInput = {
        name: formData.configName.trim() || `SpediamoPro - ${userName}`,
        provider_id: 'spediamopro',
        api_key: formData.authCode.trim(), // authCode salvato come api_key (cifrato)
        base_url: formData.baseUrl.trim(),
        contract_mapping: contractMapping,
        is_active: true,
        description: `Configurazione SpediamoPro (${formData.environment === 'production' ? 'Produzione' : 'Test'}) - Corrieri: ${Object.values(contractMapping).join(', ') || 'auto-detect'}`,
      };

      setTestDetails('Salvataggio configurazione...');
      const saveResult = await savePersonalConfiguration(configInput);

      if (saveResult.success) {
        setStep('success');
      } else {
        setError(saveResult.error || 'Errore durante il salvataggio');
        setStep('credentials');
      }
    } catch (err: any) {
      console.error('Errore test connessione SpediamoPro:', err);
      setError(err.message || 'Errore di connessione. Verifica AuthCode e Base URL.');
      setStep('credentials');
    } finally {
      setIsTesting(false);
      setTestDetails(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-300 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 flex justify-between items-start rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Configura SpediamoPro</h2>
              <p className="text-white/90 font-medium">Wizard di configurazione automatica</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 min-h-[400px] flex flex-col overflow-y-auto flex-1">
          {step === 'welcome' && (
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Zap className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">Pronto per iniziare?</h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Questo wizard ti aiutera a collegare il tuo account SpediamoPro in pochi secondi.
                  Tieni a portata di mano il tuo <strong>AuthCode</strong>.
                </p>
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <p className="text-sm text-emerald-800">
                    <strong>Non hai ancora l&apos;AuthCode?</strong>
                    <br />
                    L&apos;AuthCode viene fornito direttamente da SpediamoPro al momento
                    dell&apos;attivazione del tuo account. Contatta il tuo referente SpediamoPro per
                    ottenerlo.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-8">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <ShieldCheck className="w-6 h-6 text-green-600 mb-2" />
                  <h4 className="font-semibold text-gray-900">Sicuro</h4>
                  <p className="text-sm text-gray-500">Credenziali crittografate</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Zap className="w-6 h-6 text-yellow-500 mb-2" />
                  <h4 className="font-semibold text-gray-900">Veloce</h4>
                  <p className="text-sm text-gray-500">Setup automatico</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <Truck className="w-6 h-6 text-blue-500 mb-2" />
                  <h4 className="font-semibold text-gray-900">Multi-corriere</h4>
                  <p className="text-sm text-gray-500">SDA, BRT, UPS, InPost</p>
                </div>
              </div>
            </div>
          )}

          {step === 'credentials' && (
            <div className="space-y-6 flex-1">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">Inserisci Credenziali</h3>
                <p className="text-gray-500 text-sm">
                  Inserisci l&apos;AuthCode fornito da SpediamoPro e seleziona l&apos;ambiente.
                </p>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800 animate-in slide-in-from-top-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {/* Ambiente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ambiente <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleEnvironmentChange('production')}
                      className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                        formData.environment === 'production'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <span className="block font-semibold">Produzione</span>
                      <span className="text-xs opacity-70">core.spediamopro.com</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEnvironmentChange('test')}
                      className={`px-4 py-3 rounded-lg border-2 transition-all text-left ${
                        formData.environment === 'test'
                          ? 'border-orange-500 bg-orange-50 text-orange-900 font-semibold'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <span className="block font-semibold">Test</span>
                      <span className="text-xs opacity-70">core.spediamopro.it</span>
                    </button>
                  </div>
                </div>

                {/* Nome configurazione */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Configurazione
                  </label>
                  <input
                    type="text"
                    value={formData.configName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, configName: e.target.value }))
                    }
                    placeholder="es. SpediamoPro Principale, Account Test"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Dai un nome a questo account per riconoscerlo (utile se ne hai piu di uno).
                  </p>
                </div>

                {/* Base URL (read-only, auto da ambiente) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endpoint (generato automaticamente)
                  </label>
                  <input
                    type="url"
                    value={formData.baseUrl}
                    readOnly
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg outline-none font-mono text-sm text-gray-600"
                  />
                </div>

                {/* AuthCode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    AuthCode <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showAuthCode ? 'text' : 'password'}
                      placeholder="Incolla qui il tuo AuthCode..."
                      value={formData.authCode}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, authCode: e.target.value }))
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all font-mono text-sm pr-10"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowAuthCode(!showAuthCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showAuthCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    L&apos;AuthCode ti viene fornito da SpediamoPro. E una stringa alfanumerica
                    lunga (es. 1644084641669B1A8903E41C...).
                  </p>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-emerald-800">
                      <strong>Nota:</strong> I corrieri disponibili verranno rilevati
                      automaticamente durante la verifica. Non serve configurare contratti
                      manualmente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'testing' && (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-gray-100 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Package className="w-8 h-8 text-emerald-600 animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Verifica in corso...</h3>
                <p className="text-gray-500">
                  {testDetails || 'Stiamo testando la connessione ai server SpediamoPro.'}
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
                  La connessione con SpediamoPro e stata stabilita con successo.
                </p>
              </div>

              {/* Info credito e corrieri */}
              {validationData && (
                <div className="w-full max-w-md space-y-3 mt-4">
                  {validationData.credit !== null && (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                      <div className="text-left">
                        <p className="text-sm font-semibold text-blue-900">Credito disponibile</p>
                        <p className="text-lg font-bold text-blue-700">
                          {typeof validationData.credit === 'number'
                            ? `€ ${validationData.credit.toFixed(2)}`
                            : 'N/D'}
                        </p>
                      </div>
                    </div>
                  )}

                  {validationData.carriersAvailable.length > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="w-5 h-5 text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-900">
                          Corrieri disponibili ({validationData.carriersAvailable.length})
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {validationData.carriersAvailable.map((carrier) => (
                          <span
                            key={carrier}
                            className="px-2 py-1 bg-white border border-emerald-200 rounded-md text-xs font-medium text-emerald-800"
                          >
                            {getCarrierDisplayName(carrier)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center flex-shrink-0 sticky bottom-0 rounded-b-2xl">
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
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2 group"
              >
                Inizia Configurazione
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            )}

            {step === 'credentials' && (
              <button
                onClick={handleNext}
                disabled={!formData.authCode.trim()}
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

/**
 * Mappa codici corriere SpediamoPro a nomi display leggibili
 */
function getCarrierDisplayName(carrierCode: string): string {
  const map: Record<string, string> = {
    SDASTD: 'SDA Standard',
    SDAEXP: 'SDA Express',
    BRTEXP: 'BRT Express',
    BRTPUDO: 'BRT Fermopoint',
    BRTDPD: 'BRT/DPD',
    BRTEUEXP: 'BRT EU Express',
    UPSSTD: 'UPS Standard',
    UPSEXPSAVER: 'UPS Express Saver',
    UPSENVEXPSAVER: 'UPS Envelope Express Saver',
    INPOSTSTD: 'InPost Standard',
  };

  return map[carrierCode?.toUpperCase()] || carrierCode;
}
