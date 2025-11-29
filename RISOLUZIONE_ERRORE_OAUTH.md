# 🔧 Risoluzione Errore OAuth: "The OAuth client was not found"

## ❌ Errore Visualizzato

```
Accesso bloccato: errore di autorizzazione
Errore 401: invalid_client
The OAuth client was not found.
```

## 🔍 Cosa Significa

Questo errore indica che:
1. **Le credenziali Google OAuth non sono configurate** in `.env.local`
2. **Le credenziali sono sbagliate** (Client ID o Client Secret errati)
3. **Il Client ID non esiste** o è stato eliminato su Google Cloud Console

## ✅ Soluzione Passo-Passo

### Passo 1: Verifica .env.local

1. **Apri** il file `.env.local` nel progetto (nella root del progetto)
2. **Cerca** queste righe (dovrebbero essere intorno alla riga 70-80):
   ```env
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

3. **Verifica lo stato:**
   
   **❌ Se vedi ancora i valori placeholder:**
   ```
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```
   → Le credenziali NON sono state configurate
   → **Segui il Passo 2** per configurarle
   
   **✅ Se vedi valori reali (esempio):**
   ```
   GOOGLE_CLIENT_ID=123456789-abc123def456.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456ghi789
   ```
   → Le credenziali sono configurate, ma potrebbero essere errate
   → Verifica che:
     - Non ci siano spazi prima o dopo il `=`
     - Il Client ID esista ancora su Google Cloud Console
     - Il callback URL sia corretto (porta 3001 se il server è su 3001)

### Passo 2: Configura Google OAuth (se non l'hai fatto)

**Segui la guida completa:** `GUIDA_CONFIGURAZIONE_OAUTH.md`

**Riassunto rapido:**

1. **Vai su:** https://console.cloud.google.com/
2. **Crea un progetto** o seleziona uno esistente
3. **Vai su:** APIs & Services → Credentials
4. **Clicca:** Create Credentials → OAuth client ID
5. **Tipo:** Web application
6. **Authorized redirect URIs:** 
   ```
   http://localhost:3001/api/auth/callback/google
   ```
   ⚠️ **IMPORTANTE:** Usa la porta 3001 (non 3000) se il tuo server è su 3001!
7. **Copia** Client ID e Client Secret
8. **Aggiungi** a `.env.local`:
   ```env
   GOOGLE_CLIENT_ID=il-tuo-client-id-qui
   GOOGLE_CLIENT_SECRET=il-tuo-client-secret-qui
   ```

### Passo 3: Verifica il Callback URL

⚠️ **ATTENZIONE:** Se il tuo server è su **porta 3001** (non 3000), devi usare:

**In Google Cloud Console:**
- **Authorized redirect URIs:** `http://localhost:3001/api/auth/callback/google`

**Nel file `.env.local`:**
- Non serve modificare nulla, NextAuth usa automaticamente la porta corretta

### Passo 4: Riavvia il Server

1. **Ferma** il server (Ctrl+C nel terminale)
2. **Riavvia:**
   ```bash
   npm run dev
   ```

### Passo 5: Testa di Nuovo

1. Vai su `http://localhost:3001/login`
2. Clicca su "Continua con Google"
3. Dovresti vedere la schermata di login Google (non l'errore)

---

## 🐛 Altri Problemi Comuni

### Problema: "redirect_uri_mismatch"

**Causa:** Il callback URL nel provider non corrisponde

**Soluzione:**
1. Vai su Google Cloud Console → Credentials
2. Modifica il tuo OAuth Client ID
3. Aggiungi esattamente: `http://localhost:3001/api/auth/callback/google`
4. Salva e riprova

### Problema: Credenziali corrette ma errore persiste

**Soluzione:**
1. Verifica che non ci siano **spazi** nelle credenziali in `.env.local`
2. Verifica che le credenziali siano su **righe separate** (non sulla stessa riga)
3. **Riavvia** il server dopo aver modificato `.env.local`
4. Verifica che il Client ID esista ancora su Google Cloud Console

### Problema: Server su porta diversa

**Se il server è su porta 3001:**
- Usa `http://localhost:3001/api/auth/callback/google` nei provider

**Se il server è su porta 3000:**
- Usa `http://localhost:3000/api/auth/callback/google` nei provider

---

## ✅ Checklist di Verifica

- [ ] File `.env.local` contiene `GOOGLE_CLIENT_ID` con un valore reale (non `your-google-client-id`)
- [ ] File `.env.local` contiene `GOOGLE_CLIENT_SECRET` con un valore reale (non `your-google-client-secret`)
- [ ] Le credenziali non hanno spazi extra
- [ ] Il callback URL in Google Cloud Console è: `http://localhost:3001/api/auth/callback/google` (o 3000 se usi quella porta)
- [ ] Il server è stato riavviato dopo aver modificato `.env.local`
- [ ] Il Client ID esiste ancora su Google Cloud Console

---

## 💡 Nota Importante

**Le credenziali OAuth sono opzionali!** 

Se non vuoi configurare OAuth ora, puoi comunque usare:
- ✅ Login/Registrazione con email e password
- ✅ Le credenziali demo: `admin@spediresicuro.it` / `admin123`

I pulsanti OAuth funzioneranno solo dopo aver configurato le credenziali.

---

**Ultimo aggiornamento:** Guida risoluzione errore OAuth Google ✅

