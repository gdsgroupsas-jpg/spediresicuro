# 🤖 PROMPT PASSO 3 - CONFIGURA AUTO-DEPLOY RAILWAY

## 📋 COPIA E INCOLLA QUESTO PROMPT PER COMET

```
Ciao! Ho identificato il problema: Railway NON fa auto-deploy quando ci sono nuovi commit su GitHub.

## ⚠️ PROBLEMA CONFERMATO

- ❌ "Redeploy" su Railway ricompila solo il commit ATTUALE
- ❌ NON prende automaticamente l'ultimo commit da GitHub
- ❌ Manca webhook GitHub o auto-deploy non configurato

## 🎯 COSA DEVI FARE

### OBIETTIVO: Far usare a Railway il commit d5a69be (ultimo su GitHub)

### OPZIONE 1 - CONFIGURA AUTO-DEPLOY (CONSIGLIATO)

1. **Vai su Railway → Settings → Source**
2. **Verifica "Auto Deploy":**
   - C'è un toggle "Auto Deploy" o "Watch for changes"?
   - È ATTIVO (ON) o DISATTIVO (OFF)?
   - Se è OFF, attivalo!

3. **Verifica Webhook GitHub:**
   - Vai su GitHub: https://github.com/gdsgroupsas-jpg/spediresicuro/settings/hooks
   - Cerca webhook per Railway
   - Se NON c'è, Railway non riceve notifiche di nuovi commit!

4. **Se webhook mancante:**
   - Vai su Railway → Settings → Source
   - Clicca "Connect Repo" (anche se già connesso)
   - Railway dovrebbe creare automaticamente il webhook
   - Oppure: disconnetti e riconnetti il repository

### OPZIONE 2 - FORZA DEPLOY CON COMMIT SPECIFICO

Se l'auto-deploy non funziona, forza un deploy manuale:

1. **Vai su Railway → Deployments**
2. **Clicca "New Deploy" o "Deploy" (pulsante in alto)**
3. **Se c'è opzione "Select Commit" o "Choose Commit":**
   - Seleziona manualmente il commit `d5a69be`
   - Oppure inserisci l'hash: `d5a69be`
4. **Avvia il deploy**

### OPZIONE 3 - DISCONNETTI E RICONNETTI (FORZA RESYNC)

1. **Vai su Railway → Settings → Source**
2. **Clicca "Disconnect" o "Remove Source"** (se disponibile)
3. **Attendi 5 secondi**
4. **Clicca "Connect Repo"**
5. **Seleziona:**
   - Repository: `gdsgroupsas-jpg/spediresicuro`
   - Branch: `master`
   - ✅ Attiva "Auto Deploy" (se c'è toggle)
6. **Conferma**
7. Railway dovrebbe:
   - Creare nuovo webhook GitHub
   - Fare deploy automatico con l'ultimo commit (d5a69be)

## 🔍 VERIFICA WEBHOOK GITHUB

Dopo aver configurato, verifica:

1. **Vai su GitHub:**
   - https://github.com/gdsgroupsas-jpg/spediresicuro/settings/hooks
2. **Cerca webhook con URL contenente "railway.app"**
3. **Verifica che sia:**
   - ✅ Active (attivo)
   - ✅ Eventi: "Just the push event" o "Push"
   - ✅ Recent deliveries: dovrebbero esserci eventi recenti

## 📊 REPORT RICHIESTO

Fornisci:
1. ✅ Auto Deploy è attivo su Railway? (SI/NO)
2. ✅ Webhook GitHub presente? (SI/NO)
3. ✅ Quale opzione hai usato? (1/2/3)
4. ✅ Nuovo deploy avviato? (SI/NO)
5. ✅ Deploy usa commit d5a69be? (SI/NO)
6. ✅ Build completato senza errori? (SI/NO)

## 🎯 OBIETTIVO FINALE

- ✅ Railway configurato con auto-deploy
- ✅ Webhook GitHub attivo
- ✅ Deploy usa commit d5a69be (ultimo)
- ✅ Servizio online con codice corretto

Grazie!
```

---

## 📝 COSA FARE TU

1. **Copia il prompt sopra** e incollalo a Comet
2. **Comet verificherà e configurerà l'auto-deploy**
3. **Se necessario, Comet forzerà un deploy con il commit d5a69be**

---

**INVIA QUESTO PROMPT A COMET PER CONFIGURARE AUTO-DEPLOY!** 🚂
