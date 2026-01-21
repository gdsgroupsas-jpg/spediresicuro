'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import useServiceWorker from '@/lib/hooks/use-service-worker';

const NOTIFICATION_PROMPT_DISMISSED_KEY = 'notificationPromptDismissed';

export function NotificationPrompt() {
  const { status, requestNotificationPermission, unsubscribeFromNotifications } =
    useServiceWorker();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Safety check
    if (typeof window === 'undefined') return;

    // Controlla se l'utente ha già rifiutato il prompt
    const wasDismissed = localStorage.getItem(NOTIFICATION_PROMPT_DISMISSED_KEY) === 'true';

    // Mostra il prompt solo se:
    // 1. Le notifiche sono supportate
    // 2. Non sono ancora abilitate
    // 3. L'utente non ha già rifiutato il prompt
    if (status.notificationsSupported && !status.notificationsEnabled && !wasDismissed) {
      // Delay per non sovrapporre con altri prompt
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [status.notificationsSupported, status.notificationsEnabled]);

  const handleEnable = async () => {
    const granted = await requestNotificationPermission();
    if (granted) {
      setShowPrompt(false);
      // Se abilitate, rimuovi il flag dismissed (così se disabilita può rivederlo)
      localStorage.removeItem(NOTIFICATION_PROMPT_DISMISSED_KEY);
    }
  };

  const handleDisable = async () => {
    if (status.notificationsEnabled) {
      await unsubscribeFromNotifications();
    }
    // Salva che l'utente ha rifiutato il prompt
    localStorage.setItem(NOTIFICATION_PROMPT_DISMISSED_KEY, 'true');
    setShowPrompt(false);
  };

  if (!status.notificationsSupported) {
    return null;
  }

  // Se le notifiche sono già abilitate, non mostrare il prompt
  if (status.notificationsEnabled) {
    return null;
  }

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 bg-white rounded-lg shadow-xl p-4 max-w-sm z-50 animate-slide-in">
      <div className="flex items-start gap-3">
        <div className="mt-1">
          <Bell className="w-5 h-5 text-[#FF9500]" />
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Abilita Notifiche</h3>
          <p className="text-sm text-gray-600 mt-1">
            Ricevi aggiornamenti sulle tue spedizioni, messaggi di Anne e avvisi importanti in tempo
            reale.
          </p>

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleEnable}
              className="flex-1 bg-[#FF9500] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#E68A00] transition-colors text-sm"
            >
              Abilita
            </button>
            <button
              onClick={handleDisable}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              Dopo
            </button>
          </div>
        </div>

        <button
          onClick={handleDisable}
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
          aria-label="Chiudi"
        >
          ✕
        </button>
      </div>

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export default NotificationPrompt;
