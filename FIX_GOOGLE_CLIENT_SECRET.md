# 🔧 Fix GOOGLE_CLIENT_SECRET - Guida Passo-Passo

**Problema trovato:** Il `GOOGLE_CLIENT_SECRET` nel tuo `.env.local` sembra incompleto o troppo corto.

---

## 🎯 COSA FARE

### Step 1: Apri Google Cloud Console

1. **Vai su:** https://console.cloud.google.com/apis/credentials
2. **Accedi** con il tuo account Google
3. **Seleziona progetto:** "spedire-sicuro-geocoding" (o il tuo progetto)

---

### Step 2: Trova il Client Secret

1. **Vai su:** APIs & Services → **Credentials**
2. **Cerca** il tuo OAuth 2.0 Client ID con questo ID:
   ```
   345930037956-4uidhddtahek6ug3nsvb90fsu0fvodu8
   ```
3. **Clicca** sul Client ID per aprirlo

---

### Step 3: Copia il Client Secret Completo

1. **Scorri** fino a **"Client secret"**
2. **Clicca** sull'icona dell'occhio 👁️ per mostrare il secret (se nascosto)
3. **Clicca** sul pulsante **"Copy"** o seleziona tutto e copia (Ctrl+C)

**⚠️ IMPORTANTE:** 
- Il Client Secret dovrebbe essere lungo (40-60 caratteri dopo `GOCSPX-`)
- Formato: `GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- Copia TUTTO, non solo una parte

---

### Step 4: Aggiorna .env.local

1. **Apri** il file `.env.local` nella cartella:
   ```
   D:\spediresicuro-master\.env.local
   ```

2. **Trova** questa riga (circa alla fine del file):
   ```env
   GOOGLE_CLIENT_SECRET=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
   ```

3. **Sostituisci** con il valore completo che hai copiato:
   ```env
   GOOGLE_CLIENT_SECRET=GOCSPX-[incolla-qui-il-valore-completo]
   ```

4. **Esempio** di come dovrebbe essere (con valore completo):
   ```env
   GOOGLE_CLIENT_SECRET=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xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

5. **Salva** il file (Ctrl+S)

---

### Step 5: Verifica Formato

Il Client Secret dovrebbe:
- ✅ Iniziare con `GOCSPX-`
- ✅ Essere lungo almeno 40-60 caratteri dopo `GOCSPX-`
- ✅ Non avere spazi
- ✅ Essere tutto su una riga

**Esempio corretto:**
```env
GOOGLE_CLIENT_SECRET=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xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Esempio sbagliato (troppo corto):**
```env
GOOGLE_CLIENT_SECRET=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
```

---

### Step 6: Riavvia il Server

1. **Ferma** il server se è in esecuzione (Ctrl+C nel terminale)
2. **Riavvia:**
   ```bash
   npm run dev
   ```

---

### Step 7: Test Login Google

1. **Vai su:** http://localhost:3000/login
2. **Clicca** "Continua con Google"
3. **Dovrebbe:**
   - ✅ Aprire la schermata di autorizzazione Google
   - ✅ Non mostrare errori "invalid_client"
   - ✅ Permettere il login

---

## 🆘 SE IL CLIENT SECRET NON ESISTE O È STATO ELIMINATO

Se il Client Secret è stato eliminato o non lo trovi:

### Opzione 1: Rigenera il Client Secret

1. **Vai su:** Google Cloud Console → APIs & Services → Credentials
2. **Clicca** sul tuo OAuth 2.0 Client ID
3. **Scorri** fino a "Client secret"
4. **Clicca** "RESET SECRET" o "GENERATE NEW SECRET"
5. **Copia** il nuovo secret generato
6. **Aggiorna** `.env.local` con il nuovo valore

### Opzione 2: Crea Nuovo Client OAuth

Se non riesci a rigenerare, crea un nuovo Client OAuth:

1. **Vai su:** Google Cloud Console → APIs & Services → Credentials
2. **Clicca** "+ CREATE CREDENTIALS" → "OAuth client ID"
3. **Tipo applicazione:** Web application
4. **Nome:** SpedireSicuro (o quello che preferisci)
5. **Authorized redirect URIs:**
   ```
   http://localhost:3000/api/auth/callback/google
   ```
6. **Clicca** "CREATE"
7. **Copia** Client ID e Client Secret
8. **Aggiorna** `.env.local` con i nuovi valori

---

## ✅ VERIFICA FINALE

Dopo aver fixato, verifica che:

- [ ] `GOOGLE_CLIENT_SECRET` in `.env.local` è lungo (40-60 caratteri dopo `GOCSPX-`)
- [ ] Il server è stato riavviato
- [ ] Login Google funziona senza errori
- [ ] Non ci sono errori nella console del browser
- [ ] Non ci sono errori nella console del server

---

## 📝 NOTA IMPORTANTE

**Se hai già invalidato i vecchi Client ID** (come abbiamo fatto prima), assicurati di:
1. Usare un Client ID e Secret **NUOVI** e **ATTIVI**
2. Verificare che il Client ID sia ancora attivo su Google Cloud Console
3. Se necessario, creare nuove credenziali OAuth

---

**Dopo aver completato questi step, il problema dovrebbe essere risolto!** ✅

