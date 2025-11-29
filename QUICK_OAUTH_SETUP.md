# ⚡ Setup Rapido OAuth - Credenziali

## ✅ NEXTAUTH_SECRET
**Già configurato!** ✅
- Generato automaticamente e aggiunto a `.env.local`
- Non modificare questo valore

---

## 🔐 Credenziali OAuth (Opzionali)

Le credenziali OAuth sono **opzionali**. L'app funziona anche senza di esse (puoi usare login/registrazione normale).

### 📋 Come Ottenere le Credenziali

#### 1. Google OAuth

1. Vai su: https://console.cloud.google.com/
2. Crea un nuovo progetto o seleziona uno esistente
3. Vai su **APIs & Services** → **Credentials**
4. Clicca **Create Credentials** → **OAuth client ID**
5. Tipo: **Web application**
6. **Authorized redirect URIs:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. Copia **Client ID** e **Client Secret**
8. Aggiungi a `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=tuo-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=tuo-client-secret
   ```

#### 2. GitHub OAuth

1. Vai su: https://github.com/settings/developers
2. Clicca **New OAuth App**
3. Compila:
   - **Application name:** `SpedireSicuro`
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback/github`
4. Copia **Client ID** e **Client Secret**
5. Aggiungi a `.env.local`:
   ```env
   GITHUB_CLIENT_ID=tuo-client-id
   GITHUB_CLIENT_SECRET=tuo-client-secret
   ```

---

## 🚀 Dopo aver Configurato

1. **Riavvia il server di sviluppo:**
   ```bash
   # Ferma con Ctrl+C e riavvia
   npm run dev
   ```

2. **Testa i provider OAuth:**
   - Vai su `http://localhost:3000/login`
   - I pulsanti OAuth appariranno solo se configurati
   - Clicca su un provider per testare

---

## ⚠️ Note Importanti

- **Non committare** `.env.local` nel repository
- Le credenziali OAuth sono **opzionali** - l'app funziona senza
- Per produzione, usa URL di produzione nei callback
- Mantieni le credenziali segrete e sicure

---

## 📚 Documentazione Completa

Vedi `docs/OAUTH_SETUP.md` per la guida dettagliata con screenshot.

