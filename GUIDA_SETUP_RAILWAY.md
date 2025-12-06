# 🚀 Guida Setup Railway - Automation Service

**Tempo stimato:** 10 minuti

---

## 📋 STEP 1: Configurazione Railway

### 1.1 Crea Nuovo Servizio

1. Vai su [Railway Dashboard](https://railway.app)
2. Seleziona il progetto `spediresicuro`
3. Clicca **"New"** → **"Service"**
4. Seleziona **"Deploy from GitHub repo"**
5. Scegli il repository `spediresicuro`

### 1.2 Configura Root Directory

1. Vai su **Settings** del servizio
2. Trova **"Root Directory"**
3. Imposta: `automation-service`
4. Salva

### 1.3 Configura Variabili d'Ambiente

Vai su **Variables** e aggiungi:

```env
# Database Supabase
SUPABASE_URL=https://xxx.supabase.co
# Oppure usa:
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co

SUPABASE_SERVICE_ROLE_KEY=eyJ... (chiave service role)

# Criptazione (CRITICA)
ENCRYPTION_KEY=64-caratteri-hex (stessa di Vercel)

# Ambiente
NODE_ENV=production

# Opzionali (per sicurezza)
AUTOMATION_SERVICE_TOKEN=token-segreto-per-autenticazione
CRON_SECRET_TOKEN=token-segreto-per-cron
```

**⚠️ IMPORTANTE:**
- `ENCRYPTION_KEY` deve essere **IDENTICA** a quella su Vercel
- `SUPABASE_SERVICE_ROLE_KEY` è la chiave service role (non anon key)

### 1.4 Deploy

Railway rileva automaticamente il `Dockerfile` e fa deploy.

**Verifica:**
- Vai su **Deployments**
- Attendi che build completi (2-3 minuti)
- Verifica che status sia "Active"

---

## 📋 STEP 2: Ottieni URL Railway

1. Vai su **Settings** → **Networking**
2. Clicca **"Generate Domain"**
3. Copia l'URL (es. `automation-spedisci-production.up.railway.app`)
4. **Salva questo URL** - ti servirà per Vercel

---

## 📋 STEP 3: Configura Vercel

### 3.1 Aggiungi Variabile d'Ambiente

1. Vai su [Vercel Dashboard](https://vercel.com)
2. Seleziona progetto `spediresicuro`
3. Vai su **Settings** → **Environment Variables**
4. Aggiungi:

```env
AUTOMATION_SERVICE_URL=https://automation-spedisci-production.up.railway.app
```

5. Seleziona **Production**, **Preview**, **Development**
6. Salva

### 3.2 (Opzionale) Aggiungi Token Autenticazione

Se hai configurato `AUTOMATION_SERVICE_TOKEN` su Railway:

```env
AUTOMATION_SERVICE_TOKEN=stesso-token-di-railway
```

---

## 📋 STEP 4: Test

### 4.1 Test Health Check

Apri browser e vai su:
```
https://automation-spedisci-production.up.railway.app/health
```

Dovresti vedere:
```json
{
  "status": "ok",
  "service": "automation-service",
  "timestamp": "2025-12-03T...",
  "uptime": 123.45
}
```

### 4.2 Test da Vercel

1. Vai su dashboard admin: `/dashboard/admin/automation`
2. Clicca "Sync Manuale"
3. Verifica che funzioni

---

## ✅ CHECKLIST FINALE

- [ ] Servizio Railway creato
- [ ] Root directory impostata a `automation-service`
- [ ] Variabili d'ambiente configurate
- [ ] Deploy completato con successo
- [ ] URL Railway copiato
- [ ] Variabile `AUTOMATION_SERVICE_URL` aggiunta a Vercel
- [ ] Health check funziona
- [ ] Test sync manuale funziona

---

## 🐛 TROUBLESHOOTING

### Errore: "Puppeteer non installato"

**Soluzione:** Verifica che il Dockerfile installi Chromium correttamente. Railway dovrebbe rilevarlo automaticamente.

### Errore: "ENCRYPTION_KEY non configurata"

**Soluzione:** Aggiungi `ENCRYPTION_KEY` nelle variabili d'ambiente Railway.

### Errore: "Supabase connection failed"

**Soluzione:** Verifica che `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` siano corrette.

### Deploy fallisce

**Soluzione:**
1. Verifica logs Railway (Deployments → View Logs)
2. Verifica che Root Directory sia `automation-service`
3. Verifica che Dockerfile sia presente

---

## 📞 SUPPORTO

- **Railway Docs:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway

---

**Setup completato!** 🎉

Ora l'automation agent gira su Railway con:
- ✅ No cold start
- ✅ Latenza < 1 secondo
- ✅ Costo €5/mese
- ✅ Stabilità 99.9%





