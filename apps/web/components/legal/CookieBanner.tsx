/**
 * Cookie Consent Banner - GDPR Compliant
 *
 * Banner per gestione consenso cookie granulare:
 * - Necessari (sempre attivi)
 * - Analitici (opzionali)
 * - Marketing (opzionali)
 *
 * Salva le preferenze in localStorage e blocca script di tracciamento
 * se il consenso non è stato dato.
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Settings, Check, AlertCircle } from 'lucide-react';

// Tipo per le preferenze cookie
export interface CookieConsent {
  necessary: boolean; // Sempre true (non modificabile)
  analytics: boolean;
  marketing: boolean;
  timestamp: string; // Data/ora del consenso
}

// Chiave localStorage
const CONSENT_STORAGE_KEY = 'cookie_consent';

export default function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState<CookieConsent>({
    necessary: true,
    analytics: false,
    marketing: false,
    timestamp: '',
  });

  // Carica preferenze esistenti al mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedConsent = localStorage.getItem(CONSENT_STORAGE_KEY);

    if (savedConsent) {
      try {
        const parsed = JSON.parse(savedConsent) as CookieConsent;
        setConsent(parsed);
        // Se il consenso è già stato dato, non mostrare il banner
        setShowBanner(false);
        // Applica le preferenze ai script
        applyCookiePreferences(parsed);
      } catch (error) {
        console.error('Errore lettura preferenze cookie:', error);
        // Se c'è un errore, mostra il banner
        setShowBanner(true);
      }
    } else {
      // Nessun consenso salvato, mostra il banner
      setShowBanner(true);
    }
  }, []);

  // Applica le preferenze cookie ai script di tracciamento
  const applyCookiePreferences = (prefs: CookieConsent) => {
    // Blocca/abilita Google Analytics (se presente)
    if (typeof window !== 'undefined' && window.gtag) {
      if (prefs.analytics) {
        // Abilita GA
        window.gtag('consent', 'update', {
          analytics_storage: 'granted',
        });
      } else {
        // Blocca GA
        window.gtag('consent', 'update', {
          analytics_storage: 'denied',
        });
      }
    }

    // Blocca/abilita Facebook Pixel (se presente)
    if (typeof window !== 'undefined' && window.fbq) {
      if (prefs.marketing) {
        // Abilita Pixel
        window.fbq('consent', 'grant');
      } else {
        // Blocca Pixel
        window.fbq('consent', 'revoke');
      }
    }

    // Evento personalizzato per altri script
    window.dispatchEvent(new CustomEvent('cookieConsentUpdated', { detail: prefs }));
  };

  // Salva consenso e applica preferenze
  const saveConsent = (newConsent: CookieConsent) => {
    const consentToSave = {
      ...newConsent,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consentToSave));
    setConsent(consentToSave);
    setShowBanner(false);
    setShowSettings(false);
    applyCookiePreferences(consentToSave);
  };

  // Accetta tutti i cookie
  const handleAcceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    });
  };

  // Salva preferenze personalizzate
  const handleSavePreferences = () => {
    saveConsent(consent);
  };

  // Rifiuta tutto (solo necessari)
  const handleRejectAll = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    });
  };

  // Se il banner non deve essere mostrato, non renderizzare nulla
  if (!showBanner && !showSettings) {
    return null;
  }

  return (
    <>
      {/* Banner principale (fisso in basso) */}
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Testo informativo */}
              <div className="flex-1">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      Utilizziamo i cookie per migliorare la tua esperienza
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Utilizziamo cookie necessari per il funzionamento del sito e cookie opzionali
                      per analisi e marketing. Puoi gestire le tue preferenze in qualsiasi momento.{' '}
                      <a
                        href="/cookie-policy"
                        className="text-blue-600 hover:text-blue-700 underline font-medium"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Scopri di più
                      </a>
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottoni azione */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  onClick={handleRejectAll}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Rifiuta
                </button>
                <button
                  onClick={() => setShowSettings(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Personalizza
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Accetta Tutti
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dialog personalizzazione (overlay) */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Gestione Preferenze Cookie</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Contenuto */}
            <div className="px-6 py-6 space-y-6">
              <p className="text-sm text-gray-600">
                Seleziona i tipi di cookie che desideri accettare. I cookie necessari sono sempre
                attivi per garantire il funzionamento del sito.
              </p>

              {/* Cookie Necessari */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold text-gray-900">Cookie Necessari</h3>
                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        Sempre attivi
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Questi cookie sono essenziali per il funzionamento del sito web. Non possono
                      essere disattivati e vengono sempre utilizzati.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-12 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cookie Analitici */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Cookie Analitici</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Questi cookie ci aiutano a capire come i visitatori interagiscono con il sito,
                      fornendoci informazioni su aree visitate, tempo di permanenza, ecc.
                    </p>
                    <p className="text-xs text-gray-500">Esempi: Google Analytics</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent.analytics}
                      onChange={(e) => setConsent({ ...consent, analytics: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Cookie Marketing */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-gray-900 mb-2">Cookie Marketing</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Questi cookie vengono utilizzati per mostrarti annunci pubblicitari rilevanti
                      e tracciare l&apos;efficacia delle campagne pubblicitarie.
                    </p>
                    <p className="text-xs text-gray-500">Esempi: Facebook Pixel, Google Ads</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={consent.marketing}
                      onChange={(e) => setConsent({ ...consent, marketing: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-12 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer con bottoni */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleSavePreferences}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Salva Preferenze
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Estendi Window interface per TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
  }
}
