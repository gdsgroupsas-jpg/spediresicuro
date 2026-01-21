# 🔧 Fix Errore "Configuration" - NextAuth

## 🎯 Problema

Dopo il login con Google, vedi questo errore:

```
❌ [LOGIN] Errore OAuth rilevato: { error: "Configuration", description: null }
```

## 🔍 Causa

L'errore "Configuration" di NextAuth indica che **manca una configurazione obbligatoria**. Le cause più comuni sono:

1. ❌ **NEXTAUTH_SECRET non configurato** su Vercel (MOST COMMON)
2. ❌ **NEXTAUTH_URL non configurato** correttamente
3. ❌ **GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET** non configurati
4. ❌ Problema con la configurazione di **trustHost**

## ✅ Soluzione Passo-Passo

### PASSO 1: Verifica NEXTAUTH_SECRET su Vercel

**⚠️ IMPORTANTE: Questo è il problema più comune!**

1. **Vai su Vercel Dashboard**
   - Apri: https://vercel.com/dashboard
   - Seleziona il progetto **spediresicuro**

2. **Vai alle Impostazioni**
   - Clicca su **Settings** (Impostazioni)
   - Vai su **Environment Variables** (Variabili d'Ambiente)

3. **Verifica NEXTAUTH_SECRET**
   - Cerca la variabile `NEXTAUTH_SECRET` nella lista
   - Se **NON esiste**, devi aggiungerla:
     - Clicca su **Add New**
     - **Name:** `NEXTAUTH_SECRET`
     - **Value:** Genera una nuova chiave segreta (vedi sotto)
     - **Environment:** Seleziona **Production** (e opzionalmente **Preview**)

4. **Genera una Nuova Chiave Segreta**

   **Metodo 1: Usa Node.js (CONSIGLIATO)**

   Se hai Node.js installato, apri un terminale e esegui:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

   **Metodo 2: Usa PowerShell (Windows)**

   Se sei su Windows, apri PowerShell e esegui:

   ```powershell
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   ```

   Poi aggiungi caratteri speciali manualmente se necessario.

   **Metodo 3: Generatore Online**

   Vai su uno di questi siti e genera una chiave di almeno 32 caratteri:
   - https://www.random.org/strings/?num=1&len=64&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new
   - https://1password.com/password-generator/ (genera una password lunga)

   **Metodo 4: Usa questa chiave pre-generata (usa solo se gli altri metodi non funzionano)**

   ```
   RYOyoxCYzF5IL4eChY0ESaMvCUYIUk9EBnEGFETpNeI=
   ```

   ⚠️ **IMPORTANTE**: Questa è una chiave di esempio. In produzione, genera sempre una chiave unica!

   **Esempio di chiave segreta valida (deve essere almeno 32 caratteri):**

   ```
   RYOyoxCYzF5IL4eChY0ESaMvCUYIUk9EBnEGFETpNeI=
   ```

5. **Salva e Riavvia**
   - Clicca su **Save**
   - Vai su **Deployments** e fai un nuovo deploy (o aspetta il prossimo push)

### PASSO 2: Verifica NEXTAUTH_URL

1. **Vai su Vercel Dashboard** → **Settings** → **Environment Variables**

2. **Verifica NEXTAUTH_URL**
   - Cerca la variabile `NEXTAUTH_URL`
   - Deve essere: `https://spediresicuro.vercel.app`
   - **NON** deve essere `http://localhost:3000`

3. **Se non esiste o è sbagliato:**
   - Clicca su **Add New** o **Edit**
   - **Name:** `NEXTAUTH_URL`
   - **Value:** `https://spediresicuro.vercel.app`
   - **Environment:** Seleziona **Production**

### PASSO 3: Verifica Google OAuth

1. **Vai su Vercel Dashboard** → **Settings** → **Environment Variables**

2. **Verifica queste variabili:**
   - `GOOGLE_CLIENT_ID` - Deve essere presente
   - `GOOGLE_CLIENT_SECRET` - Deve essere presente

3. **Se mancano:**
   - Vai su [Google Cloud Console](https://console.cloud.google.com/)
   - Crea o recupera le credenziali OAuth
   - Aggiungi le variabili su Vercel

### PASSO 4: Fai un Nuovo Deploy

**⚠️ IMPORTANTE: Dopo aver modificato le variabili d'ambiente, devi fare un nuovo deploy!**

1. **Opzione 1: Push su GitHub**
   - Fai un commit e push su GitHub
   - Vercel farà il deploy automaticamente

2. **Opzione 2: Redeploy Manuale**
   - Vai su Vercel Dashboard → **Deployments**
   - Clicca sui tre puntini (...) sull'ultimo deploy
   - Seleziona **Redeploy**

## 🔍 Verifica che Funzioni

### 1. Controlla i Log di Vercel

1. Vai su Vercel Dashboard → **Deployments**
2. Clicca sull'ultimo deploy
3. Vai alla tab **Logs**
4. Cerca questi messaggi:

```
🔍 [AUTH CONFIG] OAuth Config Check: {
  google: '✅ Configurato',
  nextAuthUrl: 'https://spediresicuro.vercel.app',
  hasNextAuthSecret: true,
  ...
}
✅ [AUTH CONFIG] NEXTAUTH_SECRET configurato correttamente
✅ [AUTH CONFIG] Configurazione OAuth valida
```

### 2. Controlla la Console del Browser

1. Vai su `https://spediresicuro.vercel.app/login`
2. Premi **F12** per aprire la console
3. Prova il login con Google
4. **NON** dovresti vedere più l'errore "Configuration"

## ❌ Se Ancora Non Funziona

### Verifica Checklist Completa

- [ ] `NEXTAUTH_SECRET` è configurato su Vercel (obbligatorio!)
- [ ] `NEXTAUTH_URL` è configurato su `https://spediresicuro.vercel.app`
- [ ] `GOOGLE_CLIENT_ID` è configurato su Vercel
- [ ] `GOOGLE_CLIENT_SECRET` è configurato su Vercel
- [ ] Hai fatto un nuovo deploy dopo aver modificato le variabili
- [ ] I log di Vercel mostrano che la configurazione è valida

### Controlla i Log di Vercel per Errori

1. Vai su Vercel Dashboard → **Deployments** → **Logs**
2. Cerca messaggi che iniziano con `❌ [AUTH CONFIG]`
3. Questi ti diranno esattamente cosa manca

### Genera una Nuova Chiave Segreta

Se `NEXTAUTH_SECRET` è configurato ma non funziona, prova a generarne una nuova:

```bash
openssl rand -base64 32
```

Poi:

1. Vai su Vercel → Settings → Environment Variables
2. Modifica `NEXTAUTH_SECRET` con la nuova chiave
3. Fai un nuovo deploy

## 📞 Supporto

Se dopo aver seguito tutti questi passaggi il problema persiste:

1. **Copia i log di Vercel** (Dashboard → Deployments → Logs)
2. **Copia i log del browser** (F12 → Console)
3. **Verifica** che tutte le variabili d'ambiente siano configurate correttamente

---

**Ultimo aggiornamento:** Questa guida risolve l'errore "Configuration" di NextAuth causato da configurazione mancante.
