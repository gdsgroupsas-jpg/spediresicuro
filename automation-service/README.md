# 🤖 Automation Service - Spedisci.Online

> **Versione:** 2.0  
> **Data Aggiornamento:** Gennaio 2025  
> **Status:** 🟢 Produzione

Servizio standalone per automation browser con Puppeteer, deployato su Railway.

---

## 📋 INDICE RAPIDO

- [Panoramica](#panoramica)
- [Setup Railway](#setup-railway)
- [Sviluppo Locale](#sviluppo-locale)
- [Endpoints](#endpoints)
- [Variabili d'Ambiente](#variabili-dambiente)
- [Architettura](#architettura)
- [Documentazione Completa](#documentazione-completa)

---

## 🎯 PANORAMICA

L'**Automation Service** è un servizio Express standalone che:

- ✅ Estrae session cookies da Spedisci.Online
- ✅ Gestisce login automatico con 2FA
- ✅ Sincronizza spedizioni dal portale
- ✅ Fornisce endpoint REST per integrazione

**Tecnologie**:
- Express.js (server HTTP)
- Puppeteer (browser automation)
- IMAP (lettura email per 2FA)
- TypeScript

**Deploy**: Railway (Docker container)

---

## 🚂 SETUP RAILWAY

### 1. Crea Nuovo Servizio

1. Vai su Railway Dashboard
2. Aggiungi nuovo servizio al progetto
3. Seleziona "Deploy from GitHub repo"
4. Scegli questo repository

### 2. Configura Root Directory

**IMPORTANTE**: Configura Root Directory!

1. Railway Dashboard → Settings → Service
2. Imposta "Root Directory" a: `automation-service`

### 3. Configura Variabili d'Ambiente

**Variabili obbligatorie**:

```env
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Crittografia (CRITICA)
ENCRYPTION_KEY=64-caratteri-hex

# Autenticazione (CRITICA)
AUTOMATION_SERVICE_TOKEN=token-segreto
CRON_SECRET_TOKEN=token-segreto

# Diagnostics (opzionale)
DIAGNOSTICS_TOKEN=token-segreto

# Ambiente
NODE_ENV=production
PORT=3000
```

**Come generare token**:
```bash
# Genera token casuale (32 caratteri)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 4. Deploy

- Railway rileva automaticamente il Dockerfile
- Build e deploy automatici
- Verifica logs per errori

---

## 💻 SVILUPPO LOCALE

### Prerequisiti

- Node.js 18+
- npm o yarn

### Installazione

```bash
cd automation-service
npm install
```

### Avvio Sviluppo

```bash
npm run dev
```

Il servizio sarà disponibile su `http://localhost:3000`

### Build Produzione

```bash
npm run build
npm start
```

### Variabili d'Ambiente Locali

Crea file `.env` nella cartella `automation-service/`:

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ENCRYPTION_KEY=64-caratteri-hex
AUTOMATION_SERVICE_TOKEN=token-segreto
CRON_SECRET_TOKEN=token-segreto
NODE_ENV=development
```

**⚠️ IMPORTANTE**: Il file `.env` è già in `.gitignore`, non committarlo!

---

## 🔌 ENDPOINTS

### Health Check

```http
GET /health
```

**Risposta**:
```json
{
  "status": "ok",
  "service": "automation-service",
  "timestamp": "2025-01-15T10:00:00Z"
}
```

### Sync Configurazione

```http
POST /api/sync
Authorization: Bearer YOUR_AUTOMATION_SERVICE_TOKEN
Content-Type: application/json

{
  "config_id": "uuid-configurazione",
  "force_refresh": false
}
```

**Risposta**:
```json
{
  "success": true,
  "message": "Sync completata",
  "session_data": { ... },
  "contracts": { ... },
  "timestamp": "2025-01-15T10:00:00Z"
}
```

### Sync Tutte le Configurazioni

```http
POST /api/sync
Authorization: Bearer YOUR_AUTOMATION_SERVICE_TOKEN
Content-Type: application/json

{
  "sync_all": true
}
```

### Sync Spedizioni

```http
POST /api/sync-shipments
Authorization: Bearer YOUR_AUTOMATION_SERVICE_TOKEN
Content-Type: application/json

{
  "configId": "uuid-configurazione"
}
```

**Risposta**:
```json
{
  "success": true,
  "shipments_synced": 10,
  "shipments_updated": 5,
  "shipments_created": 5,
  "errors": [],
  "message": "Sincronizzate 10 spedizioni",
  "timestamp": "2025-01-15T10:00:00Z"
}
```

### Cron Job Sync

```http
GET /api/cron/sync
Authorization: Bearer YOUR_CRON_SECRET_TOKEN
```

### Diagnostics

```http
POST /api/diagnostics
Authorization: Bearer YOUR_DIAGNOSTICS_TOKEN
Content-Type: application/json

{
  "type": "error",
  "severity": "high",
  "context": { ... },
  "correlation_id": "uuid-opzionale",
  "user_id": "uuid-opzionale"
}
```

---

## 🔐 VARIABILI D'AMBIENTE

### Obbligatorie

| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `SUPABASE_URL` | URL Supabase | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | `eyJ...` |
| `ENCRYPTION_KEY` | Chiave crittografia (64 hex) | `abc123...` |
| `AUTOMATION_SERVICE_TOKEN` | Token autenticazione | `token-segreto` |
| `CRON_SECRET_TOKEN` | Token cron job | `token-segreto` |

### Opzionali

| Variabile | Descrizione | Default |
|-----------|-------------|---------|
| `DIAGNOSTICS_TOKEN` | Token diagnostics | `d4t1_d14gn0st1c1_s3gr3t1_2025_x9z` |
| `PORT` | Porta server | `3000` |
| `NODE_ENV` | Ambiente | `production` |

---

## 🏗️ ARCHITETTURA

### Struttura File

```
automation-service/
├── src/
│   ├── agent.ts          # Classe SOA (agent principale)
│   └── index.ts          # Server Express con endpoint
├── Dockerfile            # Configurazione Docker
├── package.json          # Dipendenze
├── tsconfig.json         # Configurazione TypeScript
└── README.md             # Questa documentazione
```

### Classe SOA

**File**: `src/agent.ts`

**Metodi principali**:
- `extractSessionData()` - Estrae session cookie, CSRF token, contratti
- `syncShipmentsFromPortal()` - Sincronizza spedizioni
- `performLogin()` - Esegue login con gestione 2FA
- `read2FACode()` - Legge codice 2FA da email IMAP

### Server Express

**File**: `src/index.ts`

**Funzionalità**:
- Endpoint REST
- Autenticazione Bearer token
- Rate limiting
- Sanitizzazione log
- Gestione errori

---

## 📚 DOCUMENTAZIONE COMPLETA

Per documentazione completa e dettagliata, vedi:

**👉 [`docs/AUTOMATION_AGENT_COMPLETA.md`](../docs/AUTOMATION_AGENT_COMPLETA.md)**

La documentazione completa include:
- ✅ Panoramica completa del sistema
- ✅ Architettura dettagliata
- ✅ Funzionalità complete
- ✅ Database e migrazioni
- ✅ Sicurezza e best practices
- ✅ Utilizzo e troubleshooting
- ✅ Monitoraggio e logs

---

## 🔧 TROUBLESHOOTING

### Errore: "Puppeteer non installato"

```bash
cd automation-service
npm install puppeteer
```

### Errore: "IMAP client non disponibile"

```bash
cd automation-service
npm install imap @types/imap
```

### Errore Build Railway

Verifica:
- Root Directory impostato a `automation-service`
- Variabili d'ambiente configurate
- Dockerfile presente

### Errore: "ENCRYPTION_KEY non configurata"

Genera chiave:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🔗 LINK UTILI

- [Documentazione Completa](../docs/AUTOMATION_AGENT_COMPLETA.md)
- [Sicurezza](./SICUREZZA.md)
- [Deploy Railway](./DEPLOY-RAILWAY.md)
- [Setup Automatico](./SETUP_AUTOMATICO.md)

---

**Ultimo aggiornamento:** Gennaio 2025  
**Versione:** 2.0
