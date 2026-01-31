# 🤖 Automation Spedisci.Online - Documentazione Completa

**Data Creazione:** 2025-12-03  
**Versione:** 1.0  
**Status:** ✅ Pronto per implementazione

---

## 📋 COSA FA QUESTO SISTEMA

Sistema di **automazione intelligente** per estrarre e aggiornare automaticamente:

- ✅ **Session cookies** da Spedisci.Online
- ✅ **CSRF tokens** per autenticazione
- ✅ **Codici contratto** (client_id, vector_contract_id)
- ✅ **Dati configurazione** necessari per creare spedizioni

**Perché è legale:**

- ✅ È il **TUO account** Spedisci.Online
- ✅ I **soldi sono tuoi** (paghi le spedizioni)
- ✅ I **contratti corrieri sono tuoi** (non di Spedisci.Online)
- ✅ Stai solo **automatizzando il tuo account** personale

---

## 🏗️ ARCHITETTURA

### **Componenti Principali:**

1. **Database Extension** (`015_extend_courier_configs_session_data.sql`)
   - Estende `courier_configs` con campi per automation
   - `session_data` (JSONB): Cookie, CSRF token, contratti
   - `automation_settings` (JSONB): Impostazioni agent
   - `automation_enabled` (BOOLEAN): Abilitazione
   - `last_automation_sync` (TIMESTAMPTZ): Ultimo sync

2. **Automation Agent** (`lib/automation/spedisci-online-agent.ts`)
   - Classe `SpedisciOnlineAgent` per estrazione dati
   - Gestione 2FA via email (IMAP)
   - Browser automation con Puppeteer
   - Estrazione cookie, CSRF, contratti

3. **Server Actions** (`actions/automation.ts`)
   - `toggleAutomation()`: Abilita/disabilita
   - `saveAutomationSettings()`: Salva settings
   - `manualSync()`: Sync manuale
   - `getAutomationStatus()`: Verifica stato

4. **Dashboard Admin** (`app/dashboard/admin/automation/page.tsx`)
   - Interfaccia per gestione automation
   - Configurazione settings
   - Sync manuale
   - Verifica stato session

5. **Cron Job** (`app/api/cron/automation-sync/route.ts`)
   - Sync automatico periodico
   - Configurabile via Vercel Cron

---

## 🚀 INSTALLAZIONE

### **1. Installa Dipendenze**

```bash
npm install puppeteer imapflow cheerio qs
```

**Note:**

- `puppeteer`: Browser automation (installa anche Chromium)
- `imapflow`: Lettura email per 2FA (sostituisce `imap`, Promise-based, zero vulnerabilità)
- `cheerio`: Parsing HTML (opzionale, già usato)
- `qs`: Query string encoding (opzionale, già usato)

### **2. Esegui Migration Database**

```bash
# Via Supabase CLI
supabase migration up 015_extend_courier_configs_session_data

# Oppure via SQL Editor in Supabase Dashboard
# Copia e incolla contenuto di:
# supabase/migrations/015_extend_courier_configs_session_data.sql
```

### **3. Configura Variabili d'Ambiente**

Aggiungi a `.env.local` (opzionale, per protezione cron):

```env
CRON_SECRET_TOKEN=your-secret-token-here
```

---

## 📖 UTILIZZO

### **1. Configurazione Iniziale**

1. **Vai su Dashboard Admin:**

   ```
   /dashboard/admin/automation
   ```

2. **Seleziona configurazione Spedisci.Online**

3. **Clicca "Settings"** e compila:
   - **Email 2FA**: Email che riceve codici 2FA
   - **IMAP Server**: Server IMAP (es: `imap.gmail.com`)
   - **IMAP Port**: Porta IMAP (es: `993` per SSL)
   - **IMAP Username**: Username email
   - **IMAP Password**: App Password (per Gmail, usa App Password)
   - **Spedisci.Online Username**: Username account Spedisci.Online
   - **Spedisci.Online Password**: Password account
   - **Auto Refresh Interval**: Ore tra sync automatici (default: 24)
   - **Abilita automation**: Checkbox per attivare

4. **Clicca "Salva"**

### **2. Sync Manuale**

**IMPORTANTE:** Prima di fare sync, verifica che non ci sia lock manuale attivo!

1. **Vai su Dashboard Admin:**

   ```
   /dashboard/admin/automation
   ```

2. **Verifica Lock:**
   - Se vedi "🔒 Manuale" → Rilascia lock prima di sync
   - Se vedi "Libero" → Puoi procedere

3. **Clicca "Sync"** sulla configurazione desiderata

4. **Attendi completamento** (può richiedere 30-60 secondi)

5. **Verifica stato session** nella tabella

**Se sync fallisce con errore "Lock attivo":**

- Verifica se stai usando Spedisci.Online manualmente
- Rilascia lock manuale se presente
- Oppure usa "Forza Sync" (ignora lock, usa con cautela)

### **3. Sync Automatico (Cron)**

**Opzione A: Vercel Cron Jobs**

Aggiungi a `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/automation-sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Opzione B: Sistema Esterno**

Chiama periodicamente:

```bash
curl -X GET https://tuo-dominio.com/api/cron/automation-sync \
  -H "Authorization: Bearer YOUR_SECRET_TOKEN"
```

---

## 🔧 CONFIGURAZIONE IMAP (Gmail)

### **1. Abilita App Password**

1. Vai su [Google Account](https://myaccount.google.com/)
2. **Sicurezza** → **Verifica in due passaggi** (deve essere attiva)
3. **App passwords** → **Genera nuova password**
4. Seleziona app: **Mail**
5. Seleziona dispositivo: **Altro (nome personalizzato)**
6. Inserisci nome: **SpedireSicuro Automation**
7. **Genera** e copia password (16 caratteri)

### **2. Usa App Password nel Form**

- **IMAP Server**: `imap.gmail.com`
- **IMAP Port**: `993`
- **IMAP Username**: La tua email Gmail
- **IMAP Password**: L'App Password generata (16 caratteri)

---

## 📊 STRUTTURA DATI

### **Session Data (JSONB)**

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

### **Automation Settings (JSONB)**

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
  "enabled": true
}
```

---

## 🔒 SISTEMA ANTI-CONFLITTO (LOCK)

### **Problema Risolto:**

**Scenario:** Tu stai usando manualmente Spedisci.Online mentre l'agent vuole fare sync.  
**Risultato:** Conflitto, loop infiniti, session invalide.

### **Soluzione: Sistema di Lock**

Il sistema previene conflitti con **lock intelligenti**:

1. **Lock Manuale** 🔒
   - Quando **TU** stai usando Spedisci.Online
   - L'agent **NON interferisce**
   - Lock dura 60 minuti (configurabile)
   - Puoi rilasciare manualmente quando finisci

2. **Lock Agent** 🤖
   - Quando l'agent sta facendo sync
   - Previene doppio sync simultaneo
   - Lock scade automaticamente dopo 30 minuti

3. **Session Reuse** ♻️
   - L'agent **verifica prima** se session nel DB è ancora valida
   - Se valida, **riusa quella** invece di fare nuovo login
   - Evita login inutili

### **Come Usare Lock Manuale:**

**Prima di usare Spedisci.Online manualmente:**

1. Vai su `/dashboard/admin/automation`
2. Clicca **"Lock Manuale"** sulla configurazione
3. L'agent **NON interferirà** per 60 minuti
4. Quando finisci, clicca **"Rilascia"** per permettere sync

**Se dimentichi di rilasciare:**

- Lock scade automaticamente dopo 60 minuti
- Oppure usa **"Forza Sync"** per ignorare lock (usa con cautela)

### **Best Practices:**

1. **Lock Manuale Prima di Usare**: Acquisisci lock prima di lavorare manualmente
2. **Rilascia Quando Finisci**: Rilascia lock quando hai finito
3. **Verifica Lock Attivo**: Controlla dashboard prima di sync manuale
4. **Forza Sync Solo se Necessario**: Usa solo se sei sicuro che nessuno sta usando

---

## 🔒 SICUREZZA

### **Best Practices:**

1. **App Password**: Usa sempre App Password per IMAP (non password normale)
2. **Cron Secret**: Configura `CRON_SECRET_TOKEN` per proteggere endpoint cron
3. **RLS Policies**: Solo admin possono vedere/modificare automation settings
4. **Crittografia**: Considera crittografare password nel database (futuro)
5. **Lock Management**: Usa lock manuale quando lavori su Spedisci.Online

### **Limitazioni:**

- ⚠️ Session cookies scadono dopo ~24h (auto-refresh necessario)
- ⚠️ 2FA via email richiede accesso IMAP
- ⚠️ Browser automation richiede risorse (CPU/memoria)
- ⚠️ Lock manuale necessario quando usi Spedisci.Online manualmente

---

## 🐛 TROUBLESHOOTING

### **Problema: "Puppeteer non installato"**

**Soluzione:**

```bash
npm install puppeteer
```

### **Problema: "IMAP client non disponibile"**

**Soluzione:**

```bash
npm install imapflow
```

### **Problema: "Login fallito"**

**Verifica:**

- Credenziali Spedisci.Online corrette
- Account non bloccato
- 2FA configurato correttamente

### **Problema: "Codice 2FA non trovato"**

**Verifica:**

- Email IMAP configurata correttamente
- App Password valida (Gmail)
- Email 2FA arriva in tempo (attendi 10-30 secondi)

### **Problema: "Session scaduta"**

**Soluzione:**

- Esegui sync manuale
- Verifica che cron job funzioni
- Riduci `auto_refresh_interval_hours` se necessario

### **Problema: "Lock già attivo" o "Account in uso manuale"**

**Causa:** Lock manuale attivo (stai usando Spedisci.Online manualmente)

**Soluzione:**

1. Vai su dashboard automation
2. Verifica lock attivo nella colonna "Lock"
3. Se lock manuale:
   - Se hai finito di usare Spedisci.Online → Clicca "Rilascia"
   - Se stai ancora usando → Aspetta o estendi lock
4. Se lock agent:
   - Aspetta che finisca (max 30 minuti)
   - Oppure usa "Forza Sync" per ignorare

### **Problema: "Agent interferisce mentre uso manualmente"**

**Causa:** Non hai acquisito lock manuale prima di usare Spedisci.Online

**Soluzione:**

1. **SEMPRE** acquisisci lock manuale prima di usare Spedisci.Online
2. Vai su dashboard automation
3. Clicca "Lock Manuale" sulla configurazione
4. L'agent non interferirà per 60 minuti
5. Quando finisci, clicca "Rilascia"

---

## 📈 MONITORAGGIO

### **Dashboard Admin**

Vai su `/dashboard/admin/automation` per vedere:

- ✅ Stato automation (abilitata/disabilitata)
- ✅ Ultimo sync eseguito
- ✅ Validità session (valida/scaduta)
- ✅ Azioni rapide (Settings, Sync)

### **Logs**

Controlla logs server per:

- `🚀 [AGENT]` - Avvio estrazione
- `✅ [AGENT]` - Operazione completata
- `❌ [AGENT]` - Errori
- `🔄 [CRON]` - Sync automatico

---

## 🎯 PROSSIMI PASSI

### **Miglioramenti Futuri:**

1. **Crittografia Password**: Crittografare password nel database
2. **Retry Logic**: Retry automatico in caso di errore
3. **Notifiche**: Alert email se sync fallisce
4. **Analytics**: Dashboard con statistiche sync
5. **Multi-Account**: Supporto per più account Spedisci.Online

---

## 📝 NOTE LEGALI

**⚠️ IMPORTANTE:**

- Questo sistema automatizza il **TUO account** Spedisci.Online
- È legale perché:
  - ✅ Account personale
  - ✅ Soldi tuoi
  - ✅ Contratti tuoi
- **NON** usare per:
  - ❌ Account di altri utenti
  - ❌ Violare Terms of Service
  - ❌ Scraping massivo o abusivo

**Raccomandazione:**

- Usa con moderazione
- Rispetta rate limits
- Monitora uso risorse

---

**Ultimo aggiornamento:** 2025-12-03  
**Versione:** 1.0  
**Autore:** Sistema Automation SpedireSicuro
