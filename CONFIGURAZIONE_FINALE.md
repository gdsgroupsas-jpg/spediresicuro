# ✅ Configurazione Finale - Railway URL

**URL Railway:** `spediresicuro.up.railway.app`

---

## ✅ STEP 1: Test Health Check (30 secondi)

Apri nel browser:

```
https://spediresicuro.up.railway.app/health
```

**Dovresti vedere:**
```json
{
  "status": "ok",
  "service": "automation-service"
}
```

**✅ Se vedi questo, il servizio funziona!**

---

## ✅ STEP 2: Configura Vercel (2 minuti)

1. **Vai su [Vercel Dashboard](https://vercel.com)**
2. **Seleziona progetto** `spediresicuro`
3. **Settings** → **Environment Variables**
4. **Clicca "Add"** (o "+")
5. **Aggiungi:**
   - **Name:** `AUTOMATION_SERVICE_URL`
   - **Value:** `https://spediresicuro.up.railway.app`
   - **Seleziona:** ✅ Production, ✅ Preview, ✅ Development
6. **Clicca "Save"**

**✅ Fatto!**

---

## ✅ STEP 3: Redeploy Vercel (opzionale)

Se Vercel non fa deploy automatico:

1. **Vai su "Deployments"** su Vercel
2. **Clicca sui 3 puntini** dell'ultimo deploy
3. **Clicca "Redeploy"**

**✅ Fatto!**

---

## ✅ STEP 4: Test Finale (1 minuto)

1. **Vai su** `/dashboard/admin/automation` (nella tua app)
2. **Clicca "Sync Manuale"** (o "Test Sync")
3. **Dovrebbe funzionare!** 🎉

**✅ Se funziona, TUTTO COMPLETATO!**

---

## 🎯 Checklist Finale

- [ ] Health check funziona: `https://spediresicuro.up.railway.app/health`
- [ ] `AUTOMATION_SERVICE_URL` configurato su Vercel
- [ ] Test sync dalla dashboard funziona

---

## 🐛 Se Qualcosa Non Funziona

### Health Check Non Funziona
- Verifica che il domain sia attivo
- Controlla che il deploy sia completato
- Verifica le variabili d'ambiente su Railway

### Sync Non Funziona
- Verifica `AUTOMATION_SERVICE_URL` su Vercel
- Controlla che l'URL sia: `https://spediresicuro.up.railway.app` (con `https://`)
- Verifica che health check funzioni

---

## 🎉 FINE!

**Se tutti i check sono ✅, TUTTO È COMPLETATO!**

Il servizio automation è ora su Railway e funziona! 🚀

---

**URL Railway:** `https://spediresicuro.up.railway.app`  
**Health Check:** `https://spediresicuro.up.railway.app/health`


