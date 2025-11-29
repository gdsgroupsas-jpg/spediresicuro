# ✅ Configurazione Nuovo Client OAuth Google

## 🔧 Credenziali Aggiornate

Ho aggiornato le credenziali in `.env.local`:

- ✅ **GOOGLE_CLIENT_ID:** `***REMOVED_GOOGLE_CLIENT_ID***.apps.googleusercontent.com`
- ✅ **GOOGLE_CLIENT_SECRET:** `***REMOVED_GOOGLE_SECRET***`
- ✅ **NEXTAUTH_URL:** `http://localhost:3000`
- ✅ **NEXTAUTH_SECRET:** Generato automaticamente

---

## 📋 CONFIGURAZIONE NECESSARIA IN GOOGLE CLOUD CONSOLE

### ⚠️ IMPORTANTE: Devi configurare il nuovo Client OAuth!

#### Passo 1: Configura Callback URL

1. Vai su: **https://console.cloud.google.com/**
2. Seleziona progetto: **"spedire-sicuro-geocoding"** (o il tuo progetto)
3. Menu → **APIs & Services** → **Credentials**
4. Clicca sul tuo **OAuth 2.0 Client ID** (quello con Client ID: `***REMOVED_GOOGLE_CLIENT_ID***`)
5. Scorri fino a **"Authorized redirect URIs"**
6. Clicca **"+ ADD URI"**
7. Inserisci ESATTAMENTE:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
8. **Nessuno spazio, nessun carattere extra**
9. Clicca **"SAVE"**
10. ⚠️ **Aspetta 1-2 minuti** per la propagazione

#### Passo 2: Aggiungi Utente di Prova

1. Menu → **APIs & Services** → **OAuth consent screen**
2. Scorri fino a **"Test users"**
3. Clicca **"+ ADD USERS"**
4. Inserisci: `gdsgroupsas@gmail.com`
5. Clicca **"ADD"**

#### Passo 3: Verifica Tipo di App

1. Nella stessa pagina **OAuth consent screen**
2. Verifica:
   - **User Type:** "External" (per testing)
   - **Publishing status:** "Testing" (OK per sviluppo)

---

## 🧪 Test

### 1. Riavvia il Server

```bash
npm run dev
```

### 2. Verifica Log

All'avvio del server, dovresti vedere:
```
🔍 Google OAuth Config Check: {
  hasClientId: true,
  clientIdEndsWith: '...vodu8',
  hasSecret: true,
  ...
}
```

### 3. Testa OAuth

1. Vai su: `http://localhost:3000/login`
2. Clicca "Continua con Google"
3. **Dovresti vedere:**
   - Schermata di autorizzazione Google
   - Richiesta di permessi per l'app
   - **NON più l'errore "invalid_client"**

---

## ✅ Checklist Finale

Prima di testare, verifica:

- [x] Credenziali aggiornate in `.env.local`
- [x] `NEXTAUTH_SECRET` generato (non più placeholder)
- [ ] Callback URL configurato in Google Cloud Console: `http://localhost:3000/api/auth/callback/google`
- [ ] `gdsgroupsas@gmail.com` aggiunto come Test user
- [ ] Server riavviato dopo modifiche
- [ ] Aspettato 1-2 minuti dopo modifiche in Google Cloud Console

---

## 🆘 Se Non Funziona

### Errore: "redirect_uri_mismatch"

**Causa:** Callback URL non corrisponde

**Soluzione:**
1. Verifica che il callback URL in Google Cloud Console sia ESATTAMENTE:
   ```
   http://localhost:3000/api/auth/callback/google
   ```
2. Nessuno spazio, nessun carattere extra
3. Porta corretta (3000, non 3001)

### Errore: "Access denied"

**Causa:** Email non è nella lista Test users

**Soluzione:**
1. Aggiungi `gdsgroupsas@gmail.com` in OAuth Consent Screen → Test users
2. Oppure pubblica l'app (richiede verifica Google)

### Errore: "invalid_client"

**Causa:** Client ID o Secret non corrispondono

**Soluzione:**
1. Verifica che Client ID e Secret in `.env.local` corrispondano a quelli in Google Cloud Console
2. Riavvia il server dopo modifiche

---

**Ultimo aggiornamento:** Configurazione nuovo Client OAuth ✅



