/**
 * Nuova Spedizione - Page Wrapper
 *
 * Auto-detect mode basato su shipments_count:
 * - ≤10 spedizioni: Wizard mode (guidato passo-passo)
 * - >10 spedizioni: Quick mode (form classico)
 *
 * L'utente può sempre switchare tra le due modalità.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wand2, Zap, ArrowRight, Info } from 'lucide-react';
import DashboardNav from '@/components/dashboard-nav';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { ShipmentWizard } from '@/components/shipments/wizard';
import { QuickModeForm } from './QuickModeForm';

// Soglia per auto-detect: utenti con ≤10 spedizioni vedono il wizard
const WIZARD_THRESHOLD = 10;

type ViewMode = 'wizard' | 'quick' | 'loading';

export default function NuovaSpedizionePage() {
  const router = useRouter();
  const [mode, setMode] = useState<ViewMode>('loading');
  const [shipmentsCount, setShipmentsCount] = useState<number | null>(null);
  const [isAutoDetected, setIsAutoDetected] = useState(true);

  // Carica user settings per auto-detect
  useEffect(() => {
    async function loadUserSettings() {
      try {
        // Controlla se c'è una preferenza salvata
        const savedMode = localStorage.getItem('shipment_form_mode') as ViewMode | null;

        // Carica shipments_count dall'API
        const response = await fetch('/api/user/settings');
        const data = response.ok ? await response.json() : null;

        // Se la risposta contiene errore o non è valida, fallback a quick mode
        if (!response.ok || data?.error) {
          // Fallback: quick mode per utenti non autenticati o errori
          setMode('quick');
          return;
        }

        const count = data.shipmentsCount || 0;
        setShipmentsCount(count);

        // Se c'è una preferenza salvata, usala
        if (savedMode && (savedMode === 'wizard' || savedMode === 'quick')) {
          setMode(savedMode);
          setIsAutoDetected(false);
        } else {
          // Auto-detect basato su shipments_count
          setMode(count <= WIZARD_THRESHOLD ? 'wizard' : 'quick');
          setIsAutoDetected(true);
        }
      } catch (error) {
        console.error('Errore caricamento settings:', error);
        // Fallback: quick mode
        setMode('quick');
      }
    }

    loadUserSettings();
  }, []);

  // Salva preferenza quando l'utente switcha manualmente
  const handleModeSwitch = (newMode: 'wizard' | 'quick') => {
    setMode(newMode);
    setIsAutoDetected(false);
    try {
      localStorage.setItem('shipment_form_mode', newMode);
    } catch (e) {
      // Ignora errori localStorage
    }
  };

  // Handler successo wizard
  const handleWizardSuccess = (shipmentId: string) => {
    // Naviga alla lista spedizioni o alla pagina di dettaglio
    router.push(`/dashboard/spedizioni?created=${shipmentId}`);
  };

  // Handler annulla wizard
  const handleWizardCancel = () => {
    router.push('/dashboard/spedizioni');
  };

  // Loading state
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mode Toggle Header - Solo per wizard mode */}
        {mode === 'wizard' && (
          <>
            <DashboardNav
              title="Nuova Spedizione"
              subtitle="Segui la procedura guidata per creare una spedizione"
              showBackButton={true}
            />

            {/* Mode Switcher */}
            <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Wand2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">Modalità Wizard</span>
                      {isAutoDetected && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                          Consigliato
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">Procedura guidata passo-passo</p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleModeSwitch('quick')}
                  className="flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Passa a Modalità Rapida
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Info tooltip per nuovi utenti */}
              {shipmentsCount !== null && shipmentsCount <= WIZARD_THRESHOLD && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2 text-sm text-gray-500">
                  <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Hai creato {shipmentsCount} spedizion{shipmentsCount === 1 ? 'e' : 'i'}. Il
                    wizard ti guida attraverso ogni passaggio. Dopo 10 spedizioni, il sistema
                    passerà automaticamente alla modalità rapida.
                  </span>
                </div>
              )}
            </div>

            {/* Wizard Container */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 min-h-[600px]">
              <ShipmentWizard onSuccess={handleWizardSuccess} onCancel={handleWizardCancel} />
            </div>
          </>
        )}

        {/* Quick Mode - Placeholder, il form viene renderizzato fuori */}
        {mode === 'quick' && null}
      </div>

      {/* Quick Mode - Renderizzato fuori dai container (ha i suoi container interni) */}
      {mode === 'quick' && (
        <>
          {/* Mode Switcher Overlay per Quick Mode - Posizionato sopra il form */}
          <div className="fixed top-20 right-8 z-50">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleModeSwitch('wizard')}
              className="flex items-center gap-2 bg-white shadow-lg border-gray-300 hover:bg-gray-50"
            >
              <Wand2 className="w-4 h-4" />
              Usa Wizard
            </Button>
          </div>

          {/* Form Quick Mode (ha i suoi container interni) */}
          <QuickModeForm />
        </>
      )}
    </div>
  );
}
