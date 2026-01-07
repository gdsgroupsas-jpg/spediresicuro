# ⚡ Configurazione Slack - Guida Rapida (5 minuti)

## 🎯 Obiettivo

Configurare webhook Slack **GRATUITO** per ricevere alert finanziari.

---

## 📋 Step 1: Crea App Slack (2 min)

1. Vai su: https://api.slack.com/apps
2. Clicca **"Create New App"** → **"From scratch"**
3. Nome: `SpedireSicuro Alerts` (o altro)
4. Workspace: seleziona il tuo workspace
5. Clicca **"Create App"**

---

## 📋 Step 2: Attiva Incoming Webhooks (1 min)

1. Nel menu sinistra, clicca **"Incoming Webhooks"**
2. Attiva il toggle **"Activate Incoming Webhooks"** (ON)
3. Scorri in basso, clicca **"Add New Webhook to Workspace"**

---

## 📋 Step 3: Scegli Canale (1 min)

1. Seleziona il canale dove vuoi ricevere gli alert
   - Esempio: `#financial-alerts` o `#spediresicuro-monitoring`
   - Puoi creare un nuovo canale prima se vuoi
2. Clicca **"Allow"**

---

## 📋 Step 4: Copia URL Webhook (30 sec)

1. Dopo l'autorizzazione, vedrai un URL webhook
2. **COPIA QUESTO URL** (è il tuo webhook unico)

---

## 📋 Step 5: Configura in Vercel (1 min)

1. Vai su: https://vercel.com → Progetto SpedireSicuro
2. **Settings** → **Environment Variables**
3. Clicca **"Add New"**
4. Compila:
   - **Key:** `SLACK_FINANCIAL_ALERTS_WEBHOOK`
   - **Value:** incolla l'URL copiato
   - **Environment:** seleziona **Production** (e Preview se vuoi testare)
5. Clicca **"Save"**

---

## ✅ Fatto!

Dopo il prossimo deploy, gli alert verranno inviati automaticamente a Slack alle **8:00 AM** ogni giorno.

---

## 🧪 Test Rapido

Dopo il deploy, testa manualmente:

```bash
curl https://tuo-dominio.vercel.app/api/cron/financial-alerts
```

Se tutto ok, vedrai un messaggio nel canale Slack configurato.

---

## ⚠️ Nota Importante

- **Slack Free è GRATUITO** e include webhook illimitati
- Non serve pagare nulla
- Se non configuri Slack, il sistema funziona comunque (solo log nel database)
