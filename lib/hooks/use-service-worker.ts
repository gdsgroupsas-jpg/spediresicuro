/**
 * Hook per gestire PWA, Service Worker e notifiche push
 * Uso: useServiceWorker() nell'app principale
 */

import { useEffect, useState } from 'react';

export interface ServiceWorkerStatus {
  ready: boolean;
  registered: boolean;
  updateAvailable: boolean;
  notificationsSupported: boolean;
  notificationsEnabled: boolean;
}

export function useServiceWorker() {
  const [status, setStatus] = useState<ServiceWorkerStatus>({
    ready: false,
    registered: false,
    updateAvailable: false,
    notificationsSupported: typeof window !== 'undefined' && 'Notification' in window,
    notificationsEnabled: false,
  });

  useEffect(() => {
    // Safety checks
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return;
    }
    
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers non supportati');
      return;
    }

    // Registra il service worker
    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        console.log('Service Worker registrato:', registration);
        setStatus((prev) => ({ ...prev, registered: true }));

        // Controlla aggiornamenti
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Aggiornamento disponibile');
                setStatus((prev) => ({ ...prev, updateAvailable: true }));
                // Mostra notifica all'utente
                showUpdateNotification();
              }
            });
          }
        });

        // Setup push notification handler
        registration.addEventListener('push', (event) => {
          console.log('Push ricevuto:', event);
        });
      } catch (error) {
        console.error('Errore registrazione Service Worker:', error);
      }
    };

    registerServiceWorker();
    setStatus((prev) => ({ ...prev, ready: true }));

    // Controlla stato notifiche
    if ('Notification' in window) {
      setStatus((prev) => ({
        ...prev,
        notificationsEnabled: Notification.permission === 'granted',
      }));
    }
  }, []);

  // Richiedi permesso notifiche
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.warn('Notifiche non supportate');
      return false;
    }

    try {
      if (Notification.permission === 'granted') {
        setStatus((prev) => ({ ...prev, notificationsEnabled: true }));
        return true;
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setStatus((prev) => ({ ...prev, notificationsEnabled: true }));

          // Registra push subscription
          if ('serviceWorker' in navigator && 'PushManager' in window) {
            await subscribeToPushNotifications();
          }
          return true;
        }
      }
    } catch (error) {
      console.error('Errore richiesta notifiche:', error);
    }

    return false;
  };

  // Iscriviti a push notifications
  const subscribeToPushNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;

      // Verifica se è già iscritto
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Crea una nuova subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });

        console.log('Iscritto a push notifications:', subscription);

        // Salva la subscription nel server
        await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
          }),
        });
      }

      return subscription;
    } catch (error) {
      console.error('Errore iscrizione push:', error);
    }
  };

  // Mostra notifica test
  const showTestNotification = async () => {
    if (!status.notificationsEnabled) {
      await requestNotificationPermission();
    }

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification('SpedireSicuro', {
        body: 'Questa è una notifica di test 🎉',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'test-notification',
      });
    }
  };

  // Aggiorna il service worker
  const updateServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistrations();
      for (const reg of registration) {
        await reg.update();
      }
    }
  };

  // Disiscriviti dalle notifiche
  const unsubscribeFromNotifications = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notifica al server
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
          }),
        });

        setStatus((prev) => ({ ...prev, notificationsEnabled: false }));
      }
    } catch (error) {
      console.error('Errore discrizione notifiche:', error);
    }
  };

  return {
    status,
    requestNotificationPermission,
    subscribeToPushNotifications,
    showTestNotification,
    updateServiceWorker,
    unsubscribeFromNotifications,
  };
}

// Notifica di aggiornamento disponibile
function showUpdateNotification() {
  const message = document.createElement('div');
  message.className = 'update-notification';
  message.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #FF9500;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      font-size: 14px;
      z-index: 9999;
    ">
      <div style="margin-bottom: 8px;">📦 Aggiornamento disponibile!</div>
      <button onclick="location.reload()" style="
        background: white;
        color: #FF9500;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        font-size: 12px;
      ">
        Aggiorna
      </button>
    </div>
  `;
  document.body.appendChild(message);
}

export default useServiceWorker;
