'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWA_INSTALL_PROMPT_DISMISSED_KEY = 'pwaInstallPromptDismissed';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Safety checks per browser APIs
    if (typeof window === 'undefined') return;
    
    // Controlla se l'utente ha già rifiutato il prompt
    const wasDismissed = localStorage.getItem(PWA_INSTALL_PROMPT_DISMISSED_KEY) === 'true';
    
    // Ascolta l'evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      
      // Mostra il prompt solo se:
      // 1. L'app non è già installata
      // 2. L'utente non ha già rifiutato il prompt
      if (window.matchMedia && 
          !window.matchMedia('(display-mode: standalone)').matches && 
          !wasDismissed) {
        setShowPrompt(true);
      }
    };

    // Ascolta l'evento appinstalled
    const handleAppInstalled = () => {
      console.log('App installata!');
      setInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    // Controlla se è già in modalità standalone (installata)
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('App installazione accettata');
        setInstalled(true);
        setShowPrompt(false);
        // Se installata, rimuovi il flag dismissed
        localStorage.removeItem(PWA_INSTALL_PROMPT_DISMISSED_KEY);
      } else {
        // Se rifiutata, salva che l'utente ha rifiutato
        localStorage.setItem(PWA_INSTALL_PROMPT_DISMISSED_KEY, 'true');
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Errore installazione app:', error);
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleClose = () => {
    // Salva che l'utente ha chiuso il prompt
    localStorage.setItem(PWA_INSTALL_PROMPT_DISMISSED_KEY, 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || installed) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-[#FF9500] to-[#FFB84D] text-white p-4 shadow-lg animate-slide-up z-50">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Download className="w-6 h-6 flex-shrink-0" />
          <div>
            <h3 className="font-semibold">Installa SpedireSicuro</h3>
            <p className="text-sm text-orange-100">Accedi ovunque - Web, Android, iOS</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="bg-white text-[#FF9500] px-6 py-2 rounded-lg font-semibold hover:bg-orange-50 transition-colors"
          >
            Installa
          </button>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default PWAInstallPrompt;
