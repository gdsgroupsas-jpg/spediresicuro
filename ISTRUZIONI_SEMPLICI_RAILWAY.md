# 🎯 ISTRUZIONI SEMPLICI - Cosa Fare ORA

**Tempo:** 5 minuti  
**Difficoltà:** ⭐ Facile

---

## 📋 COSA VEDO NELLO SCHERMO

Stai nella sezione **"Config-as-code"** di Railway.  
Per ora, **IGNORA questa sezione** e segui questi passi:

---

## ✅ PASSO 1: Vai su "Source" (2 minuti)

1. **Guarda la barra laterale DESTRA** (quella con "Source", "Networking", ecc.)
2. **Clicca su "Source"** (prima voce in alto)
3. Trova **"Root Directory"**
4. **Clicca sul campo** e scrivi:
   ```
   automation-service
   ```
5. **Salva** (premi Enter o clicca "Save")

**✅ Fatto!** Ora Railway sa dove trovare il codice.

---

## ✅ PASSO 2: Vai su "Variables" (2 minuti)

1. **Clicca su "Variables"** nella barra in alto (accanto a "Settings")
2. **Clicca "New Variable"** (o "+" o "Add")
3. **Aggiungi queste 4 variabili** (una alla volta):

   **Variabile 1:**
   - Name: `SUPABASE_URL`
   - Value: (copia da `.env.local` → `NEXT_PUBLIC_SUPABASE_URL`)
   - Clicca "Add"

   **Variabile 2:**
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: (copia da `.env.local`)
   - Clicca "Add"

   **Variabile 3:**
   - Name: `ENCRYPTION_KEY`
   - Value: (copia da `.env.local`)
   - Clicca "Add"

   **Variabile 4:**
   - Name: `NODE_ENV`
   - Value: `production`
   - Clicca "Add"

**✅ Fatto!** Variabili configurate.

---

## ✅ PASSO 3: Vai su "Networking" (1 minuto)

1. **Clicca su "Networking"** nella barra laterale DESTRA
2. **Clicca "Generate Domain"** (o "Create Domain")
3. **Copia l'URL** che appare (es. `automation-spedisci-production.up.railway.app`)
4. **Salvalo da qualche parte** (ti servirà dopo)

**✅ Fatto!** Domain creato.

---

## ✅ PASSO 4: Deploy Automatico

Railway dovrebbe fare deploy automaticamente.

**Verifica:**
1. Vai su **"Deployments"** (barra in alto)
2. Dovresti vedere un deploy in corso o completato
3. Se c'è un errore, clicca e leggi i log

**✅ Fatto!** Deploy completato.

---

## ✅ PASSO 5: Test (30 secondi)

1. **Apri l'URL** che hai copiato prima
2. Aggiungi `/health` alla fine:
   ```
   https://tuo-url-railway.app/health
   ```
3. Dovresti vedere:
   ```json
   {
     "status": "ok",
     "service": "automation-service"
   }
   ```

**✅ Fatto!** Servizio funziona!

---

## ✅ PASSO 6: Configura Vercel (2 minuti)

1. Vai su [Vercel Dashboard](https://vercel.com)
2. Seleziona progetto `spediresicuro`
3. Vai su **Settings** → **Environment Variables**
4. **Clicca "Add"**
5. Name: `AUTOMATION_SERVICE_URL`
6. Value: `https://tuo-url-railway.app` (quello copiato prima)
7. Seleziona **Production**, **Preview**, **Development**
8. **Save**
9. **Redeploy** (se necessario)

**✅ Fatto!** Vercel configurato.

---

## 🎉 FINITO!

Ora tutto dovrebbe funzionare!

**Test finale:**
1. Vai su `/dashboard/admin/automation`
2. Clicca "Sync Manuale"
3. Dovrebbe funzionare! 🎉

---

## 🐛 SE QUALCOSA NON FUNZIONA

### Errore: "Root Directory not found"

**Soluzione:**
- Verifica di aver scritto esattamente: `automation-service`
- Verifica che la cartella esista nel repository

### Errore: "Build failed"

**Soluzione:**
- Vai su "Deployments" → Clicca sul deploy fallito
- Leggi i log per vedere l'errore
- Spesso è un problema di variabili d'ambiente mancanti

### Health check non funziona

**Soluzione:**
- Verifica che il deploy sia completato
- Verifica che le variabili d'ambiente siano configurate
- Controlla i log su Railway

---

## 📞 AIUTO

Se hai problemi, dimmi:
1. Quale passo stai facendo
2. Cosa vedi sullo schermo
3. Quale errore appare

**Ti aiuto subito!** 🚀





