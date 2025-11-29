# 🔧 Risoluzione Errore "GeneralOAuthFlow"

## 🔍 Problema

Messaggio visualizzato:
```
Richiedi dettagli: flowName=GeneralOAuthFlow
```

## 🔎 Cause Possibili

1. **Credenziali OAuth non completamente configurate**
2. **Callback URL non corrispondente**
3. **NextAuth v5 richiede configurazione aggiuntiva**
4. **App OAuth in modalità Testing senza utenti di prova**

---

## ✅ Soluzioni

### Soluzione 1: Verifica Credenziali Google OAuth

1. **Apri** `.env.local`
2. **Verifica** che le credenziali siano reali (non placeholder):
   ```env
   GOOGLE_CLIENT_ID=TUO_CLIENT_ID.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=TUO_CLIENT_SECRET
   ```
3. **Se vedi ancora** `your-google-client-id`, sostituisci con i valori reali

### Soluzione 2: Verifica Callback URL in Google Cloud Console

**IMPORTANTE:** Il callback URL deve corrispondere esattamente!

1. Vai su: **https://console.cloud.google.com/**
2. **APIs & Services** → **Credentials**
3. Clicca sul tuo **OAuth 2.0 Client ID**
4. Verifica **"Authorized redirect URIs"**:
   ```
   http://localhost:3001/api/auth/callback/google
   ```
5. **Se non c'è o è diverso:**
   - Aggiungi/modifica con: `http://localhost:3001/api/auth/callback/google`
   - Salva le modifiche

### Soluzione 3: Aggiungi Utente di Prova (CRITICO!)

Se l'app è in modalità **Testing**, devi aggiungere il tuo email:

1. **OAuth Consent Screen:**
   - Menu → **APIs & Services** → **OAuth consent screen**
2. **Test users:**
   - Scorri fino a **"Test users"**
   - Clicca **"+ ADD USERS"**
   - Inserisci: `gdsgroupsas@gmail.com`
   - Clicca **"ADD"**

### Soluzione 4: Verifica Configurazione NextAuth

Ho già aggiunto `basePath` e `trustHost` nella configurazione. Verifica che il file sia aggiornato.

### Soluzione 5: Riavvia il Server

Dopo ogni modifica a `.env.local` o Google Cloud Console:

1. **Ferma** il server (Ctrl+C)
2. **Riavvia:**
   ```bash
   npm run dev
   ```

---

## 🧪 Test Step-by-Step

### 1. Verifica Credenziali
```bash
Get-Content .env.local | Select-String "GOOGLE_CLIENT"
```

Dovresti vedere valori reali (non `your-google-client-id`)

### 2. Verifica Callback URL
- In Google Cloud Console, verifica che il callback URL sia:
  ```
  http://localhost:3001/api/auth/callback/google
  ```

### 3. Verifica Utenti di Prova
- In OAuth Consent Screen, verifica che il tuo email sia nella lista

### 4. Testa OAuth
1. Vai su `http://localhost:3001/login`
2. Clicca "Continua con Google"
3. **Se vedi schermata Google:** ✅ Funziona!
4. **Se vedi errore:** Controlla i log del server

---

## 🐛 Troubleshooting Avanzato

### Errore: "redirect_uri_mismatch"
- Verifica che il callback URL in Google Cloud Console corrisponda esattamente
- Nessuno spazio, nessun carattere extra
- Porta corretta (3001 se il server è su 3001)

### Errore: "Access denied"
- Aggiungi il tuo email come utente di prova
- Oppure pubblica l'app (richiede verifica Google)

### Errore: "Invalid client"
- Verifica che Client ID e Client Secret siano corretti
- Verifica che non ci siano spazi extra
- Riavvia il server

---

## ✅ Checklist Completa

- [ ] `GOOGLE_CLIENT_ID` contiene valore reale (non placeholder)
- [ ] `GOOGLE_CLIENT_SECRET` contiene valore reale (non placeholder)
- [ ] Callback URL in Google Cloud Console: `http://localhost:3001/api/auth/callback/google`
- [ ] Email aggiunta come utente di prova in OAuth Consent Screen
- [ ] `NEXTAUTH_URL=http://localhost:3001` in `.env.local`
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3001` in `.env.local`
- [ ] Server riavviato dopo modifiche

---

**Ultimo aggiornamento:** Risoluzione errore GeneralOAuthFlow ✅



