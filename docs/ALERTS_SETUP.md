# 📢 Configurazione Alert Finanziari Multi-Canale

Sistema di notifiche **completamente gratuito** per alert finanziari con supporto per:

- ✅ **Slack** (Piano Free - gratuito)
- ✅ **Telegram Bot** (gratuito)
- ✅ **Email** (Resend - 100 email/giorno gratuite)

---

## 🎯 Configurazione Vercel Environment Variables

Aggiungi queste variabili in **Vercel → Settings → Environment Variables**:

### Slack (GRATUITO - Piano Free)

```env
SLACK_FINANCIAL_ALERTS_WEBHOOK=https://hooks.slack.com/services/YOUR_TEAM_ID/YOUR_BOT_ID/YOUR_WEBHOOK_TOKEN
```

**Come ottenerlo:**

1. Vai su https://api.slack.com/apps
2. Crea nuova App → "From scratch"
3. Incoming Webhooks → Attiva
4. Aggiungi webhook al canale (es. `#financial-alerts`)
5. Copia l'URL

---

### Telegram Bot (GRATUITO)

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=-1001234567890
```

**Come ottenerlo:**

1. **Crea Bot:**
   - Apri Telegram → Cerca `@BotFather`
   - Invia `/newbot`
   - Segui istruzioni, ottieni il **token**

2. **Ottieni Chat ID:**
   - Crea un gruppo/channel
   - Aggiungi il bot al gruppo
   - Invia un messaggio nel gruppo
   - Visita: `https://api.telegram.org/bot<TOKEN>/getUpdates`
   - Cerca `"chat":{"id":-1001234567890}` → quello è il **chat_id**

---

### Email (GRATUITO - Resend)

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=alerts@spediresicuro.it
EMAIL_ALERT_RECIPIENTS=admin@spediresicuro.it,finance@spediresicuro.it
```

**Come ottenerlo:**

1. Vai su https://resend.com
2. Crea account gratuito (100 email/giorno)
3. Verifica dominio (o usa `onboarding@resend.dev` per test)
4. Copia API Key
5. Aggiungi destinatari separati da virgola

---

## 🚀 Funzionamento

Il sistema invia alert a **TUTTI i canali configurati**:

- Se configuri solo Slack → invia solo a Slack
- Se configuri Slack + Telegram → invia a entrambi
- Se configuri tutti e 3 → invia a tutti e 3

**Nessun costo** se usi:

- Slack Free (illimitato per webhook)
- Telegram Bot (gratuito)
- Resend Free (100 email/giorno)

---

## 📋 Esempio Alert

Quando si verifica un problema, ricevi:

**Slack:**

```
🚨 5 spedizioni con margine CRITICO
Rilevate 5 spedizioni con margine < -50€...
```

**Telegram:**

```
🚨 *5 spedizioni con margine CRITICO*

Rilevate 5 spedizioni con margine < -50€...
```

**Email:**

```
Subject: [CRITICAL] 🚨 5 spedizioni con margine CRITICO

Rilevate 5 spedizioni con margine < -50€...
```

---

## ⚙️ Soglie Configurabili

```env
ALERT_NEGATIVE_MARGIN_THRESHOLD=-10    # Alert se margine < -10€
ALERT_RECONCILIATION_DAYS=7            # Alert se pending > 7 giorni
```

---

## 🔍 Test

Dopo il deploy, testa manualmente:

```bash
curl https://tuo-dominio.vercel.app/api/cron/financial-alerts
```

Verifica che i messaggi arrivino sui canali configurati.
