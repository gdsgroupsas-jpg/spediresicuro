# ⏰ REMINDER: Setup Cron Job Vercel

> **⚠️ IMPORTANTE:** Questo documento serve come reminder per configurare il cron job su Vercel dopo il deploy del servizio Railway.

---

## 📋 Stato Attuale

### ✅ Già Configurato (nel codice)

Il cron job è **già configurato** in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/trigger-sync",
      "schedule": "0 * * * *"  // Ogni ora (es: 10:00, 11:00, 12:00...)
    }
  ]
}
```

**Endpoint:** `/api/cron/trigger-sync`  
**Schedule:** `0 * * * *` (ogni ora allo scoccare dell'ora)  
**File:** `app/api/cron/trigger-sync/route.ts`

### ⚠️ DA CONFIGURARE (su Vercel Dashboard)

Il cron job **NON funzionerà** finché non configuri le variabili ambiente su Vercel.

---

## 🔧 SETUP OBBLIGATORIO - Variabili Ambiente Vercel

### Passo 1: Accedi a Vercel Dashboard

1. Vai su: **https://vercel.com/dashboard**
2. Seleziona il progetto **`spediresicuro`**
3. Vai su **Settings** → **Environment Variables**

### Passo 2: Aggiungi Variabili OBBLIGATORIE

Aggiungi queste variabili **OBBLIGATORIE** per il cron job:

| Nome Variabile | Descrizione | Esempio | Ambiente |
|----------------|-------------|---------|----------|
| `AUTOMATION_SERVICE_URL` | URL del servizio Railway | `https://spediresicuro-automation.up.railway.app` | **Production** |
| `AUTOMATION_SERVICE_TOKEN` | Token per autenticazione con Railway | `token-segreto-railway` | **Production** |

**⚠️ IMPORTANTE:**
- `AUTOMATION_SERVICE_URL` = URL del tuo servizio Railway (es: `https://tuo-servizio.up.railway.app`)
- `AUTOMATION_SERVICE_TOKEN` = Token che hai configurato su Railway (variabile `AUTOMATION_SERVICE_TOKEN`)

### Passo 3: Aggiungi Variabili OPZIONALI (Sicurezza)

Aggiungi queste variabili per **proteggere** il cron job (opzionale ma consigliato):

| Nome Variabile | Descrizione | Esempio | Ambiente |
|----------------|-------------|---------|----------|
| `CRON_SECRET` | Token segreto per proteggere endpoint cron | `token-segreto-cron` | **Production** |
| `VERCEL_CRON_SECRET` | Token alternativo (se usi Vercel Cron) | `token-vercel-cron` | **Production** |

**Nota:** Se non configuri questi token, il cron job funzionerà comunque, ma sarà meno sicuro.

---

## 🚀 Verifica Setup Cron Job

### Metodo 1: Dashboard Vercel

1. Vai su **Vercel Dashboard** → Il tuo progetto
2. Vai su **Settings** → **Cron Jobs**
3. Dovresti vedere:
   - **Path:** `/api/cron/trigger-sync`
   - **Schedule:** `0 * * * *`
   - **Status:** Attivo (dopo il primo deploy)

### Metodo 2: Test Manuale

Puoi testare manualmente il cron job chiamando l'endpoint:

```bash
# Sostituisci con il tuo dominio Vercel
curl https://spediresicuro.vercel.app/api/cron/trigger-sync
```

**Risposta attesa:**
```json
{
  "success": true,
  "message": "Sync completato: X/Y configurazioni, Z spedizioni",
  "configs_processed": 1,
  "configs_successful": 1,
  "total_shipments_synced": 5,
  "timestamp": "2025-12-03T10:00:00.000Z"
}
```

### Metodo 3: Log Vercel

1. Vai su **Vercel Dashboard** → Il tuo progetto
2. Vai su **Deployments** → Seleziona ultimo deploy
3. Vai su **Functions** → Cerca `/api/cron/trigger-sync`
4. Controlla i log per vedere se il cron job viene eseguito

**Log attesi:**
```
🔄 [CRON SYNC] Avvio sync automatico spedizioni...
📊 [CRON SYNC] Trovate 1 configurazioni da sincronizzare
✅ [CRON SYNC] Config abc12345: 5 spedizioni sincronizzate
✅ [CRON SYNC] Completato: 1/1 config sincronizzate, 5 spedizioni totali
```

---

## ⚙️ Configurazione Schedule (Opzionale)

Se vuoi cambiare la frequenza del cron job, modifica `vercel.json`:

### Esempi Schedule

| Schedule | Descrizione | Esempio |
|----------|-------------|---------|
| `0 * * * *` | Ogni ora (attuale) | 10:00, 11:00, 12:00... |
| `0 */2 * * *` | Ogni 2 ore | 10:00, 12:00, 14:00... |
| `0 9,17 * * *` | Alle 9:00 e 17:00 | 9:00, 17:00 |
| `*/30 * * * *` | Ogni 30 minuti | 10:00, 10:30, 11:00... |
| `0 0 * * *` | Una volta al giorno (mezzanotte) | 00:00 |

**Formato Cron:** `minuto ora giorno mese giorno-settimana`

Dopo aver modificato `vercel.json`, fai commit e push:
```bash
git add vercel.json
git commit -m "chore: Modificato schedule cron job"
git push
```

Vercel aggiornerà automaticamente il cron job.

---

## 🔒 Sicurezza Cron Job

### Protezione con Token (Consigliato)

Il cron job supporta autenticazione tramite token. Se configuri `CRON_SECRET` o `VERCEL_CRON_SECRET`, il cron job richiederà l'header:

```
Authorization: Bearer <token>
```

**Vercel Cron Jobs** aggiunge automaticamente l'header `x-vercel-cron` quando chiama l'endpoint, quindi se usi Vercel Cron Jobs nativi, non serve configurare token aggiuntivi.

### Verifica Sicurezza

1. **Test senza token** (dovrebbe fallire se configurato):
   ```bash
   curl https://spediresicuro.vercel.app/api/cron/trigger-sync
   # Dovrebbe restituire 401 Unauthorized
   ```

2. **Test con token** (dovrebbe funzionare):
   ```bash
   curl -H "Authorization: Bearer <tuo-token>" \
        https://spediresicuro.vercel.app/api/cron/trigger-sync
   # Dovrebbe restituire 200 OK con risultati
   ```

---

## 📊 Monitoraggio Cron Job

### Log Vercel

I log del cron job sono disponibili in:
- **Vercel Dashboard** → **Deployments** → **Functions** → `/api/cron/trigger-sync`

### Metriche da Monitorare

- ✅ **Success Rate:** Quante configurazioni vengono sincronizzate con successo
- ✅ **Shipments Synced:** Quante spedizioni vengono sincronizzate per ciclo
- ✅ **Errori:** Se ci sono errori, controlla i log per dettagli

### Alert (Opzionale)

Puoi configurare alert su Vercel per:
- Errori ripetuti nel cron job
- Timeout (se il cron job impiega troppo tempo)
- Fallimenti consecutivi

---

## ✅ Checklist Setup Completo

Prima di considerare il cron job configurato, verifica:

- [ ] **Railway Service deployato** e funzionante
- [ ] **AUTOMATION_SERVICE_URL** configurato su Vercel (URL Railway)
- [ ] **AUTOMATION_SERVICE_TOKEN** configurato su Vercel (token Railway)
- [ ] **CRON_SECRET** configurato su Vercel (opzionale ma consigliato)
- [ ] **vercel.json** contiene configurazione cron job
- [ ] **Deploy Vercel** completato dopo aggiunta variabili
- [ ] **Test manuale** endpoint cron job funziona
- [ ] **Log Vercel** mostrano esecuzione cron job
- [ ] **Configurazioni attive** con `automation_enabled = true` nel database

---

## 🆘 Troubleshooting

### ❌ Errore: "AUTOMATION_SERVICE_URL non configurato"

**Causa:** Variabile ambiente non configurata su Vercel

**Soluzione:**
1. Vai su Vercel Dashboard → Settings → Environment Variables
2. Aggiungi `AUTOMATION_SERVICE_URL` con l'URL del tuo servizio Railway
3. Fai un nuovo deploy o aspetta che Vercel lo faccia automaticamente

### ❌ Errore: "AUTOMATION_SERVICE_TOKEN non configurato"

**Causa:** Token non configurato su Vercel

**Soluzione:**
1. Verifica che il token sia configurato su Railway (variabile `AUTOMATION_SERVICE_TOKEN`)
2. Aggiungi lo stesso token su Vercel come `AUTOMATION_SERVICE_TOKEN`
3. Fai un nuovo deploy

### ❌ Cron Job non viene eseguito

**Possibili cause:**
1. Variabili ambiente non configurate
2. Deploy non completato dopo aggiunta variabili
3. Schedule errato in `vercel.json`
4. Progetto Vercel su piano gratuito (limiti cron jobs)

**Soluzione:**
1. Verifica che tutte le variabili siano configurate
2. Fai un nuovo deploy manuale
3. Controlla i log Vercel per errori
4. Verifica che il progetto sia su un piano che supporta cron jobs

### ❌ Cron Job fallisce con 500

**Possibili cause:**
1. Servizio Railway non raggiungibile
2. Token Railway errato
3. Timeout (cron job troppo lento)

**Soluzione:**
1. Verifica che Railway sia online: `curl https://tuo-servizio.up.railway.app/health`
2. Verifica che i token siano corretti
3. Controlla i log Railway per errori
4. Considera di aumentare `maxDuration` in `vercel.json` (attualmente 300 secondi)

---

## 📝 Note Importanti

1. **Cron Job attivo solo in Production:** I cron jobs Vercel funzionano solo su deploy di produzione, non su preview/development

2. **Primo esecuzione:** Il cron job viene eseguito per la prima volta dopo il primo deploy di produzione con `vercel.json` configurato

3. **Timezone:** I cron jobs Vercel usano UTC. Se vuoi eseguire a un'ora specifica in un altro timezone, calcola l'offset UTC

4. **Limiti Piano Gratuito:** Vercel Hobby ha limiti sui cron jobs. Verifica i limiti sul sito Vercel

5. **Railway deve essere online:** Se Railway è offline, il cron job fallirà. Assicurati che Railway sia sempre attivo

---

## 🔗 Link Utili

- **Vercel Cron Jobs Docs:** https://vercel.com/docs/cron-jobs
- **Railway Dashboard:** https://railway.app/dashboard
- **Cron Schedule Generator:** https://crontab.guru/

---

**Data creazione:** 2025-12-03  
**Ultimo aggiornamento:** 2025-12-03  
**Stato:** ⚠️ **DA CONFIGURARE** su Vercel Dashboard

---

## 🎯 PROSSIMI PASSI

1. ✅ Deploy servizio Railway (se non già fatto)
2. ⏳ Configura variabili ambiente su Vercel (questo documento)
3. ⏳ Verifica cron job funziona
4. ⏳ Monitora log per prime esecuzioni

**Ricorda:** Il cron job è già configurato nel codice, devi solo aggiungere le variabili ambiente su Vercel! 🚀



