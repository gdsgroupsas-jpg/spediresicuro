# PWA + Push Notifications - Setup Guide

## 🚀 Configurazione Iniziale

### 1. Genera Chiavi VAPID

Per abilitare le notifiche push, hai bisogno di una coppia di chiavi VAPID (Voluntary Application Server Identification).

**Opzione A: Usa un tool online**
1. Vai su https://tools.bagwanpankaj.com/vapid-key-generator
2. Clicca "Generate Keys"
3. Copia le chiavi

**Opzione B: Usa Node.js**
```bash
npm install -g web-push
web-push generate-vapid-keys
```

### 2. Configura le Chiavi nel .env.local

```env
# Chiave pubblica (visibile al client)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BKxxxxxxxxxxxx...

# Chiave privata (solo server, SEGRETA!)
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxx...

# Email per notifiche di errore
VAPID_SUBJECT=mailto:support@spediresicuro.it
```

### 3. Installa web-push

```bash
npm install web-push
npm install --save-dev @types/web-push
```

### 4. Configura Database

Crea una tabella per le sottoscrizioni push:

```sql
-- Crea tabella push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email VARCHAR(255) NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  auth TEXT,
  p256dh TEXT,
  user_agent TEXT,
  subscribed_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  FOREIGN KEY (user_email) REFERENCES auth.users(email)
);

-- Indice per query veloci
CREATE INDEX idx_push_subscriptions_email 
ON push_subscriptions(user_email);

-- Abilita RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users possono leggere le loro subscriptions
CREATE POLICY "Users can read their own subscriptions"
ON push_subscriptions
FOR SELECT
USING (user_email = auth.jwt()->>'email');

-- Policy: Service può inserire subscriptions
CREATE POLICY "Service can insert subscriptions"
ON push_subscriptions
FOR INSERT
WITH CHECK (true);

-- Policy: Service può eliminare subscriptions
CREATE POLICY "Service can delete subscriptions"
ON push_subscriptions
FOR DELETE
USING (true);
```

### 5. Abilita i Componenti PWA

Nel tuo root layout (`app/layout.tsx`), aggiungi i componenti:

```tsx
import PWAInstallPrompt from '@/components/pwa/pwa-install-prompt';
import NotificationPrompt from '@/components/pwa/notification-prompt';

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        {/* Il manifest è già configurato nei metadata */}
      </head>
      <body>
        {children}
        <PWAInstallPrompt />
        <NotificationPrompt />
      </body>
    </html>
  );
}
```

## 📱 Come Installare l'App

### Su Android/Chrome
1. Apri https://spediresicuro.vercel.app
2. Clicca l'icona "Installa" (in basso a destra del browser)
3. Oppure: Menu → "Installa app"

### Su iOS/Safari
1. Apri https://spediresicuro.vercel.app
2. Tap "Share" (icona freccia)
3. Seleziona "Add to Home Screen"
4. Inserisci il nome "SpedireSicuro"
5. Tap "Add"

## 🔔 Funzionalità Disponibili

✅ **Installazione come app nativa**
- Icone sul home screen
- Splash screen personalizzato
- Theme color del browser

✅ **Offline Support**
- Visualizza dati in cache
- Sincronizza automaticamente al ritorno online
- Pagina offline personalizzata

✅ **Push Notifications**
- Notifiche sullo stato delle spedizioni
- Messaggi dall'assistente AI Anne
- Avvisi importanti
- Azioni quick (Open/Close dalle notifiche)

✅ **Background Sync**
- Sincronizzazione dati in background
- Funziona anche con app chiusa

✅ **Shortcut dall'Home Screen**
- Accesso veloce a Tracking
- Accesso veloce a Chat Anne

## 🧪 Test Notifiche

Nel componente di admin o chat, puoi inviare una notifica di test:

```tsx
// Nel tuo componente
const { showTestNotification } = useServiceWorker();

<button onClick={showTestNotification}>
  Invia Notifica Test
</button>
```

## 🚨 Troubleshooting

### Notifiche non arrivano
- ✓ Controlla che VAPID_PRIVATE_KEY sia configurato
- ✓ Verifica che l'utente abbia abilitato le notifiche
- ✓ Controlla la console del browser per errori

### Service Worker non registra
- ✓ Assicurati che `/sw.js` sia in public/
- ✓ Controlla che il browser supporti Service Workers
- ✓ In dev mode, potrebbe richiedere hard refresh (Ctrl+Shift+R)

### App non installabile
- ✓ HTTPS obbligatorio (vercel ha HTTPS di default)
- ✓ Manifest.json deve essere valido
- ✓ Icone devono esistere in public/icons/

## 📊 API Disponibili

### POST /api/notifications/subscribe
Iscriviti a push notifications

```json
{
  "subscription": {
    "endpoint": "https://...",
    "keys": {
      "auth": "...",
      "p256dh": "..."
    }
  }
}
```

### POST /api/notifications/unsubscribe
Disiscriviti da push notifications

```json
{
  "endpoint": "https://..."
}
```

## 🎯 Prossimi Step

1. ✅ Genera VAPID keys
2. ✅ Configura .env.local
3. ✅ Crea tabella database
4. ✅ Installa web-push
5. ✅ Usa useServiceWorker hook nei tuoi componenti
6. ✅ Invia notifiche push dal backend

## 📚 Risorse Utili

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web Push Protocol](https://tools.ietf.org/html/draft-thomson-webpush-protocol)
- [VAPID Specification](https://tools.ietf.org/html/draft-thomson-webpush-vapid)
