'use client';

/**
 * Componente per selezionare il provider AI (Anthropic/DeepSeek)
 * Solo Superadmin può modificare
 */

import { useState, useEffect } from 'react';
import { Bot, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  getAIProviderSetting, 
  updateAIProviderSetting, 
  getAvailableAIProviders 
} from '@/actions/ai-settings';
import { toast } from 'sonner';

export function AIProviderSelector() {
  const [currentProvider, setCurrentProvider] = useState<string>('anthropic');
  const [availableProviders, setAvailableProviders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setIsLoading(true);
      const [settingsResult, providersResult] = await Promise.all([
        getAIProviderSetting(),
        getAvailableAIProviders(),
      ]);

      if (settingsResult.success && settingsResult.data) {
        setCurrentProvider(settingsResult.data.provider);
      }

      if (providersResult.success && providersResult.data) {
        setAvailableProviders(providersResult.data);
      }
    } catch (error: any) {
      console.error('Errore caricamento settings AI:', error);
      toast.error('Errore caricamento impostazioni AI');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleProviderChange(providerId: string) {
    if (providerId === currentProvider) return;

    try {
      setIsSaving(true);
      const result = await updateAIProviderSetting(
        providerId as 'anthropic' | 'deepseek' | 'gemini'
      );

      if (result.success) {
        setCurrentProvider(providerId);
        const providerNames: Record<string, string> = {
          anthropic: 'Anthropic Claude',
          deepseek: 'DeepSeek',
          gemini: 'Google Gemini',
        };
        toast.success(`Provider AI cambiato a ${providerNames[providerId] || providerId}`);
      } else {
        toast.error(result.error || 'Errore aggiornamento provider');
      }
    } catch (error: any) {
      console.error('Errore aggiornamento provider:', error);
      toast.error('Errore aggiornamento provider AI');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
          <span className="text-gray-600">Caricamento impostazioni AI...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Provider AI per Anne
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Seleziona quale provider AI utilizzare per Anne
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="space-y-4">
          {availableProviders.map((provider) => {
            const isSelected = currentProvider === provider.id;
            const hasApiKey = provider.hasApiKey;

            return (
              <div
                key={provider.id}
                className={`
                  relative border-2 rounded-xl p-4 transition-all cursor-pointer
                  ${isSelected 
                    ? 'border-purple-500 bg-purple-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                  ${!hasApiKey ? 'opacity-60' : ''}
                `}
                onClick={() => hasApiKey && !isSaving && handleProviderChange(provider.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">
                        {provider.name}
                      </h3>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {provider.description}
                    </p>
                    <div className="mt-2 flex items-center gap-4">
                      <span className="text-xs text-gray-500">
                        Modello: <span className="font-mono">{provider.model}</span>
                      </span>
                      {!hasApiKey && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="w-3 h-3" />
                          API Key non configurata
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="ml-4">
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isSaving && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Salvataggio in corso...</span>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Nota:</strong> Il cambio di provider richiede che le variabili d&apos;ambiente 
            (<code className="bg-blue-100 px-1 rounded">ANTHROPIC_API_KEY</code> o{' '}
            <code className="bg-blue-100 px-1 rounded">DEEPSEEK_API_KEY</code>) 
            siano configurate correttamente su Vercel.
          </p>
        </div>
      </div>
    </div>
  );
}

