# Automation Service - Spedisci.Online

Servizio standalone per automation browser con Puppeteer, deployato su Railway.

## Setup Railway

1. **Crea nuovo servizio in Railway**
   - Vai su Railway Dashboard
   - Aggiungi nuovo servizio al progetto
   - Seleziona "Deploy from GitHub repo"
   - Scegli questo repository

2. **Configura Root Directory**
   - In Railway Dashboard → Settings → Service
   - Imposta "Root Directory" a: `automation-service`

3. **Configura Variabili d'Ambiente**
   - `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ENCRYPTION_KEY`
   - `AUTOMATION_SERVICE_TOKEN` (opzionale, per autenticazione)
   - `CRON_SECRET_TOKEN` (opzionale, per cron jobs)
   - `NODE_ENV=production`

4. **Deploy**
   - Railway rileva automaticamente il Dockerfile
   - Build e deploy automatici

## Endpoints

- `GET /health` - Health check
- `POST /api/sync` - Sync automation
- `GET /api/cron/sync` - Cron job sync

## Sviluppo Locale

```bash
cd automation-service
npm install
npm run dev
```

## Build

```bash
npm run build
npm start
```
