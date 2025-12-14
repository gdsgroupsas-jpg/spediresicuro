# 🤖 Agent Automation - Documentazione Completa

> **Versione:** 2.0  
> **Data Aggiornamento:** Gennaio 2025  
> **Status:** 🟢 Produzione

---

## 📋 INDICE

1. [Panoramica](#panoramica)
2. [Architettura](#architettura)
3. [Componenti Principali](#componenti-principali)
4. [Funzionalità](#funzionalità)
5. [Database](#database)
6. [Sicurezza](#sicurezza)
7. [Deploy](#deploy)
8. [Utilizzo](#utilizzo)
9. [Troubleshooting](#troubleshooting)
10. [Riferimenti](#riferimenti)

---

## 🎯 PANORAMICA

L'**Agent Automation** è un sistema intelligente che automatizza l'accesso a **Spedisci.Online** per:

- ✅ **Estrarre session cookies** (per rimanere loggati)
- ✅ **Estrarre CSRF tokens** (per sicurezza nelle richieste)
- ✅ **Estrarre codici contratto** (client_id, vector_contract_id)
- ✅ **Sincronizzare spedizioni** dal portale Spedisci.Online

**Perché è legale:**
- ✅ È il **TUO account** Spedisci.Online
- ✅ I **soldi sono tuoi** (paghi le spedizioni)
- ✅ I **contratti corrieri sono tuoi** (non di Spedisci.Online)
- ✅ Stai solo **automatizzando il tuo account** personale

---

## 🏗️ ARCHITETTURA

### Struttura a Due Componenti

Il sistema è composto da **due implementazioni** dello stesso agent:

#### 1. **Versione Next.js** (Integrata)
- **File**: `lib/automation/spedisci-online-agent.ts`
- **Classe**: `SpedisciOnlineAgent`
- **Uso**: Server Actions, API Routes
- **Deploy**: Vercel (con Next.js)

#### 2. **Versione Standalone** (Servizio Separato)
- **File**: `automation-service/src/agent.ts`
- **Classe**: `SOA` (SpedisciOnlineAgent)
- **Uso**: Servizio Express standalone
- **Deploy**: Railway (Docker container)

### Automation Service (Standalone)

**Cartella**: `automation-service/`

**Tecnologie**:
- Express.js (server HTTP)
- Puppeteer (browser automation)
- IMAP (lettura email per 2FA)
- TypeScript

**Deploy**: Railway (servizio Docker separato)

**Porta**: 3000

---

## 📦 COMPONENTI PRINCIPALI

### 1. Automation Agent (`agent.ts`)

**Classe principale**: `SOA` (SpedisciOnlineAgent)

**Metodi principali**:
- `extractSessionData()` - Estrae session cookie, CSRF token, contratti
- `syncShipmentsFromPortal()` - Sincronizza spedizioni da Spedisci.Online
- `performLogin()` - Esegue login con gestione 2FA
- `read2FACode()` - Legge codice 2FA da email IMAP

**Flusso estrazione**:
1. Verifica lock attivo (se utente sta usando, aspetta)
2. Verifica session esistente nel DB (se valida, riusala)
3. Se session scaduta o mancante:
   - Acquisisci lock
   - Apri browser (Puppeteer)
   - Vai a pagina login
   - Compila form login
   - Gestisci 2FA (leggi email)
   - Estrai cookie di sessione
   - Estrai CSRF token
   - Estrai codici contratto
   - Chiudi browser
   - Rilascia lock

### 2. Automation Service (`index.ts`)

**Servizio Express** con endpoint REST:

- `GET /health` - Health check
- `POST /api/sync` - Sincronizza una configurazione
- `POST /api/sync-shipments` - Sincronizza spedizioni da Spedisci.Online
- `GET /api/cron/sync` - Sync automatico (cron job)
- `POST /api/diagnostics` - Salva eventi diagnostici

**Protezioni**:
- Autenticazione Bearer token (`AUTOMATION_SERVICE_TOKEN`)
- Rate limiting (30 req/min diagnostics, 20 ogni 10min sync)
- Sanitizzazione log (UUID parziali, nessun dato sensibile)

### 3. Server Actions (`actions/automation.ts`)

**Funzioni disponibili**:

- `toggleAutomation()` - Abilita/disabilita automation
- `saveAutomationSettings()` - Salva configurazioni (cripta password)
- `manualSync()` - Sync manuale
- `getAutomationStatus()` - Verifica stato
- `getAutomationSettings()` - Recupera settings (decripta password)
- `acquireManualLock()` - Acquisisce lock manuale
- `releaseManualLock()` - Rilascia lock
- `checkLock()` - Verifica lock attivo

### 4. Dashboard Admin (`app/dashboard/admin/automation/page.tsx`)

**Interfaccia utente** per:
- Visualizzare configurazioni con automation
- Abilitare/disabilitare automation
- Configurare settings (email 2FA, IMAP, credenziali)
- Eseguire sync manuale
- Verificare stato session
- Gestire lock manuale

**Path**: `/dashboard/admin/automation`

---

## ⚙️ FUNZIONALITÀ

### 1. Estrazione Session Data

**Cosa fa**:
- Apre browser headless (Puppeteer)
- Effettua login su Spedisci.Online
- Gestisce 2FA (via email IMAP o manuale)
- Estrae cookie, CSRF token, contratti
- Salva nel database

**Algoritmo intelligente**:
- Verifica lock attivo (se utente sta usando, aspetta)
- Verifica session esistente (se valida, riusala)
- Evita login inutili

### 2. Sistema di Lock (Anti-Conflitto)

**Problema risolto**: Conflitti quando l'utente usa Spedisci.Online manualmente mentre l'agent vuole fare sync.

**Soluzione**: Sistema di lock intelligenti

#### Lock Manuale 🔒
- Quando **TU** stai usando Spedisci.Online
- L'agent **NON interferisce**
- Lock dura 60 minuti (configurabile)
- Puoi rilasciare manualmente quando finisci

#### Lock Agent 🤖
- Quando l'agent sta facendo sync
- Previene doppio sync simultaneo
- Lock scade automaticamente dopo 30 minuti

#### Session Reuse ♻️
- L'agent **verifica prima** se session nel DB è ancora valida
- Se valida, **riusa quella** invece di fare nuovo login
- Evita login inutili

### 3. Sincronizzazione Spedizioni

**Cosa fa**:
- Legge tabella spedizioni da Spedisci.Online
- Estrae tracking number, status, destinatario, prezzo
- Aggiorna database locale
- Retry automatico in caso di errore (max 3 tentativi)

**Dati estratti**:
- Tracking number
- Status (in transito, consegnato, giacenza, ecc.)
- Destinatario (nome, città, CAP)
- Prezzo
- Data spedizione

---

## 🗄️ DATABASE

### Tabelle Coinvolte

#### `courier_configs`

**Campi automation**:
- `automation_enabled` (BOOLEAN) - Abilitazione automation
- `automation_settings` (JSONB) - Credenziali e configurazioni
- `session_data` (JSONB) - Cookie e token estratti
- `last_automation_sync` (TIMESTAMPTZ) - Ultimo sync eseguito
- `automation_encrypted` (BOOLEAN) - Password criptate

**Struttura `session_data`**:
```json
{
  "session_cookie": "laravel_session=...; XSRF-TOKEN=...",
  "csrf_token": "abc123xyz",
  "client_id_internal": "2667",
  "vector_contract_id": "77",
  "expires_at": "2025-12-04T10:00:00Z",
  "extracted_at": "2025-12-03T10:00:00Z"
}
```

**Struttura `automation_settings`**:
```json
{
  "email_2fa": "email@example.com",
  "imap_server": "imap.gmail.com",
  "imap_port": 993,
  "imap_username": "email@example.com",
  "imap_password": "app_password_16_chars",
  "spedisci_online_username": "username",
  "spedisci_online_password": "password",
  "auto_refresh_interval_hours": 24,
  "enabled": true,
  "two_factor_method": "email"
}
```

### Migrazioni Database

**Ordine di applicazione**:
1. `010_courier_configs_system.sql` - Tabella base
2. `015_extend_courier_configs_session_data.sql` - Campi automation
3. `016_automation_locks.sql` - Sistema lock
4. `017_encrypt_automation_passwords.sql` - Crittografia password

**Funzioni SQL**:
- `check_automation_lock()` - Verifica lock attivo
- `acquire_automation_lock()` - Acquisisce lock
- `release_automation_lock()` - Rilascia lock

---

## 🔒 SICUREZZA

### Crittografia Password

**Algoritmo**: AES-256-GCM

**Chiave**: `ENCRYPTION_KEY` (variabile d'ambiente, 64 caratteri hex)

**Cosa viene criptato**:
- Password Spedisci.Online
- Password IMAP

**Come funziona**:
- Password criptate quando salvate (`saveAutomationSettings()`)
- Password decriptate solo quando necessario (server-side)
- Mai esposte nei log o al client

### Autenticazione Endpoint

**Token Bearer obbligatorio**:
- `AUTOMATION_SERVICE_TOKEN` - Per endpoint `/api/sync`
- `CRON_SECRET_TOKEN` - Per endpoint `/api/cron/sync`
- `DIAGNOSTICS_TOKEN` - Per endpoint `/api/diagnostics`

**Validazione**:
- Token verificato ad ogni richiesta
- Tentativi non autorizzati loggati
- Risposta generica (non rivela dettagli)

### Rate Limiting

**Limiti**:
- Diagnostics: 30 richieste al minuto
- Sync: 20 richieste ogni 10 minuti

**Protezione**:
- Prevenzione abusi
- Protezione DDoS

### Sanitizzazione Log

**Cosa viene sanitizzato**:
- UUID parziali (solo primi 8 caratteri)
- Nessun dato sensibile (password, credenziali)
- Error messages generici in produzione

---

## 🚀 DEPLOY

### Railway (Automation Service)

**Dockerfile**: `automation-service/Dockerfile`

**Build**:
- TypeScript compilato in JavaScript
- Dipendenze installate
- Immagine ottimizzata per Puppeteer

**Configurazione Railway**:
1. Root Directory: `automation-service`
2. Variabili d'ambiente (vedi sezione Variabili)
3. Deploy automatico da GitHub

**Variabili d'ambiente obbligatorie**:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ENCRYPTION_KEY=64-caratteri-hex
AUTOMATION_SERVICE_TOKEN=token-segreto
CRON_SECRET_TOKEN=token-segreto
NODE_ENV=production
```

### Vercel (Next.js)

**Integrazione**:
- Chiama automation-service via HTTP
- Usa `AUTOMATION_SERVICE_URL` per endpoint

**Cron Job** (opzionale):
- Path: `/api/cron/automation-sync`
- Configurabile via `vercel.json`

---

## 📖 UTILIZZO

### 1. Configurazione Iniziale

**Passo 1**: Vai su Dashboard Admin
```
/dashboard/admin/automation
```

**Passo 2**: Seleziona configurazione Spedisci.Online

**Passo 3**: Clicca "⚙️ Configura" e compila:
- **Email 2FA**: Email che riceve codici 2FA
- **IMAP Server**: Server IMAP (es: `imap.gmail.com`)
- **IMAP Port**: Porta IMAP (es: `993` per SSL)
- **IMAP Username**: Username email
- **IMAP Password**: App Password (per Gmail, usa App Password)
- **Spedisci.Online Username**: Username account Spedisci.Online
- **Spedisci.Online Password**: Password account
- **Auto Refresh Interval**: Ore tra sync automatici (default: 24)
- **Abilita automation**: Checkbox per attivare

**Passo 4**: Clicca "Salva"

### 2. Sync Manuale

**IMPORTANTE**: Prima di fare sync, verifica che non ci sia lock manuale attivo!

1. Vai su `/dashboard/admin/automation`
2. Verifica Lock:
   - Se vedi "🔒 Manuale" → Rilascia lock prima di sync
   - Se vedi "Libero" → Puoi procedere
3. Clicca "Sync" sulla configurazione desiderata
4. Attendi completamento (può richiedere 30-60 secondi)
5. Verifica stato session nella tabella

**Se sync fallisce con errore "Lock attivo"**:
- Verifica se stai usando Spedisci.Online manualmente
- Rilascia lock manuale se presente
- Oppure usa "Forza Sync" (ignora lock, usa con cautela)

### 3. Sync Automatico (Cron)

**Opzione A: Vercel Cron Jobs**

Aggiungi a `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/automation-sync",
    "schedule": "0 */6 * * *"
  }]
}
```

**Opzione B: Sistema Esterno**

Chiama periodicamente:
```bash
curl -X GET https://tuo-dominio.com/api/cron/automation-sync \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

### 4. Lock Manuale

**Prima di usare Spedisci.Online manualmente**:

1. Vai su `/dashboard/admin/automation`
2. Clicca **"Lock Manuale"** sulla configurazione
3. L'agent **NON interferirà** per 60 minuti
4. Quando finisci, clicca **"Rilascia"** per permettere sync

**Se dimentichi di rilasciare**:
- Lock scade automaticamente dopo 60 minuti
- Oppure usa **"Forza Sync"** per ignorare lock (usa con cautela)

### 5. Configurazione IMAP (Gmail)

**Abilita App Password**:

1. Vai su [Google Account](https://myaccount.google.com/)
2. **Sicurezza** → **Verifica in due passaggi** (deve essere attiva)
3. **App passwords** → **Genera nuova password**
4. Seleziona app: **Mail**
5. Seleziona dispositivo: **Altro (nome personalizzato)**
6. Inserisci nome: **SpedireSicuro Automation**
7. **Genera** e copia password (16 caratteri)

**Usa App Password nel Form**:
- **IMAP Server**: `imap.gmail.com`
- **IMAP Port**: `993`
- **IMAP Username**: La tua email Gmail
- **IMAP Password**: L'App Password generata (16 caratteri)

---

## 🐛 TROUBLESHOOTING

### Problema: "Puppeteer non installato"

**Soluzione**:
```bash
cd automation-service
npm install puppeteer
```

### Problema: "IMAP client non disponibile"

**Soluzione**:
```bash
cd automation-service
npm install imap @types/imap
```

### Problema: "Login fallito"

**Verifica**:
- Credenziali Spedisci.Online corrette
- Account non bloccato
- 2FA configurato correttamente

### Problema: "Codice 2FA non trovato"

**Verifica**:
- Email IMAP configurata correttamente
- App Password valida (Gmail)
- Email 2FA arriva in tempo (attendi 10-30 secondi)

### Problema: "Session scaduta"

**Soluzione**:
- Esegui sync manuale
- Verifica che cron job funzioni
- Riduci `auto_refresh_interval_hours` se necessario

### Problema: "Lock già attivo" o "Account in uso manuale"

**Causa**: Lock manuale attivo (stai usando Spedisci.Online manualmente)

**Soluzione**:
1. Vai su dashboard automation
2. Verifica lock attivo nella colonna "Lock"
3. Se lock manuale:
   - Se hai finito di usare Spedisci.Online → Clicca "Rilascia"
   - Se stai ancora usando → Aspetta o estendi lock
4. Se lock agent:
   - Aspetta che finisca (max 30 minuti)
   - Oppure usa "Forza Sync" per ignorare

### Problema: "Agent interferisce mentre uso manualmente"

**Causa**: Non hai acquisito lock manuale prima di usare Spedisci.Online

**Soluzione**:
1. **SEMPRE** acquisisci lock manuale prima di usare Spedisci.Online
2. Vai su dashboard automation
3. Clicca "Lock Manuale" sulla configurazione
4. L'agent non interferirà per 60 minuti
5. Quando finisci, clicca "Rilascia"

---

## 📊 MONITORAGGIO

### Dashboard Admin

Vai su `/dashboard/admin/automation` per vedere:
- ✅ Stato automation (abilitata/disabilitata)
- ✅ Ultimo sync eseguito
- ✅ Validità session (valida/scaduta)
- ✅ Azioni rapide (Settings, Sync)

### Logs

Controlla logs server per:
- `🚀 [AGENT]` - Avvio estrazione
- `✅ [AGENT]` - Operazione completata
- `❌ [AGENT]` - Errori
- `🔄 [CRON]` - Sync automatico

### Diagnostics

Eventi diagnostici salvati in `diagnostics_events`:
- Errori durante sync
- Warning su session scadute
- Performance metrics

---

## 📚 RIFERIMENTI

### File Chiave

- `automation-service/src/agent.ts` - Classe SOA (agent principale)
- `automation-service/src/index.ts` - Server Express con endpoint
- `lib/automation/spedisci-online-agent.ts` - Versione Next.js
- `actions/automation.ts` - Server Actions
- `app/dashboard/admin/automation/page.tsx` - Dashboard UI

### Documentazione Correlata

- `docs/AUTOMATION_SPEDISCI_ONLINE.md` - Guida operativa
- `automation-service/README.md` - Setup Railway
- `automation-service/SICUREZZA.md` - Sicurezza
- `automation-service/DEPLOY-RAILWAY.md` - Deploy Railway

### Variabili d'Ambiente

Vedi sezione [Deploy](#deploy) per lista completa variabili.

---

## ⚠️ LIMITAZIONI

- ⚠️ Session cookies scadono dopo ~24h (auto-refresh necessario)
- ⚠️ 2FA via email richiede accesso IMAP
- ⚠️ Browser automation richiede risorse (CPU/memoria)
- ⚠️ Lock manuale necessario quando usi Spedisci.Online manualmente

---

## 🎯 BEST PRACTICES

1. **Usa App Password per IMAP** (Gmail)
2. **Acquisisci lock manuale** prima di usare Spedisci.Online
3. **Rilascia lock** quando finisci
4. **Monitora log** per errori
5. **Verifica session valida** prima di creare spedizioni

---

**Ultimo aggiornamento:** Gennaio 2025  
**Versione:** 2.0  
**Autore:** Sistema Automation SpedireSicuro
