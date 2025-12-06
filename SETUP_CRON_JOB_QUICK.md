# ⚡ QUICK SETUP - Cron Job Vercel

> **Reminder rapido** per configurare il cron job dopo deploy Railway

## ✅ Checklist Veloce

### 1. Variabili Ambiente Vercel (OBBLIGATORIE)

Vai su: **Vercel Dashboard** → **Settings** → **Environment Variables**

Aggiungi:
- ✅ `AUTOMATION_SERVICE_URL` = URL Railway (es: `https://tuo-servizio.up.railway.app`)
- ✅ `AUTOMATION_SERVICE_TOKEN` = Token Railway (stesso di Railway)

### 2. Verifica Configurazione

Il cron job è già configurato in `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/trigger-sync",
    "schedule": "0 * * * *"  // Ogni ora
  }]
}
```

### 3. Test

Dopo deploy, testa manualmente:
```bash
curl https://spediresicuro.vercel.app/api/cron/trigger-sync
```

### 4. Monitora Log

Vercel Dashboard → Deployments → Functions → `/api/cron/trigger-sync`

---

**📖 Per dettagli completi:** Vedi `REMINDER_SETUP_CRON_JOB.md`




