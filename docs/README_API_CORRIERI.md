# 📚 Guida Completa: Sistema API Corrieri

## 🎯 Panoramica

Sistema completo per gestire configurazioni API corrieri in modo dinamico, sicuro e monitorato.

**Caratteristiche principali:**

- ✅ Gestione multi-tenant delle credenziali
- ✅ Criptazione AES-256-GCM delle credenziali
- ✅ Audit logging completo
- ✅ Versionamento e monitoraggio API
- ✅ Interfaccia admin intuitiva

---

## 🚀 Quick Start

### 1. Configurazione Iniziale

#### Step 1: Genera Chiave di Criptazione

```bash
# Genera chiave sicura (64 caratteri hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Step 2: Configura su Vercel

1. Vai su **Vercel Dashboard** → **Settings** → **Environment Variables**
2. Aggiungi:
   - **Name:** `ENCRYPTION_KEY`
   - **Value:** La chiave generata
   - **Environment:** ✅ Production, ✅ Preview

#### Step 3: Esegui Migrations

```bash
# Esegui migrations SQL su Supabase
# 1. 010_courier_configs_system.sql
# 2. 013_security_audit_logs.sql
# 3. 014_api_versioning_monitoring.sql
```

### 2. Configurare Prima API Corriere

1. Accedi come **Admin** al dashboard
2. Vai su **Integrazioni** → **Configurazione API Corrieri**
3. Seleziona corriere (es: **Spedisci.Online**)
4. Inserisci credenziali:
   - **API Key:** Copia dalla dashboard corriere
   - **Dominio:** Es: `ecommerceitalia.spedisci.online`
   - **Endpoint:** Es: `https://ecommerceitalia.spedisci.online/api/v2/`
   - **Mapping Contratti:** Copia dalla tabella contratti
5. Clicca **Salva Configurazione**

---

## 📖 Guida Utente

### Per Admin

#### Creare Nuova Configurazione

1. Vai su `/dashboard/integrazioni`
2. Sezione **"Configurazione API Corrieri"**
3. Seleziona corriere
4. Compila form con credenziali
5. Salva

#### Visualizzare Configurazioni Esistenti

- Vai su `/dashboard/admin/configurations`
- Vedi lista completa con stato (attivo/inattivo)
- Clicca su configurazione per dettagli

#### Assegnare Configurazione a Utente

1. Vai su `/dashboard/admin/configurations`
2. Trova configurazione
3. Usa funzione "Assegna a Utente"
4. Seleziona utente dalla lista

### Per Utenti

Le credenziali API sono gestite automaticamente dal sistema. Non è necessario configurare nulla manualmente.

---

## 🔐 Sicurezza

### Criptazione Credenziali

Tutte le credenziali sono criptate usando **AES-256-GCM**:

- ✅ Criptazione automatica al salvataggio
- ✅ Decriptazione automatica al recupero (solo per admin)
- ✅ Chiave di criptazione in variabile d'ambiente

**⚠️ IMPORTANTE:**

- Non condividere mai `ENCRYPTION_KEY`
- Non committare la chiave nel repository
- Ruota periodicamente la chiave

### Audit Logging

Tutti gli accessi alle credenziali sono tracciati:

- Visualizzazione credenziali
- Copia credenziali
- Creazione/aggiornamento/eliminazione
- Decriptazione

**Accesso log:** Solo admin possono visualizzare i log di audit.

---

## 🔄 Versionamento API

### Registrare Nuova Versione

Quando un corriere rilascia una nuova versione API:

1. Registra versione nel sistema
2. Indica se ci sono breaking changes
3. Configura data deprecazione versione vecchia
4. Migra gradualmente le configurazioni

### Monitoraggio Salute API

Il sistema monitora automaticamente:

- Stato API (healthy/degraded/down)
- Tempo di risposta
- Errori e timeout

**Alert:** Configurare notifiche quando API va in stato "down".

---

## 🛠️ Manutenzione

### Migrare Credenziali Esistenti

Se hai credenziali non criptate:

```typescript
// Esegui script di migrazione
import { migrateCredentials } from '@/scripts/migrate-credentials';
await migrateCredentials();
```

### Ruotare Chiave di Criptazione

1. Genera nuova chiave
2. Re-cripta tutte le credenziali
3. Aggiorna `ENCRYPTION_KEY` su Vercel
4. Riavvia deployment

### Backup Credenziali

```sql
-- Backup tabella configurazioni
COPY courier_configs TO '/backup/courier_configs.csv';
```

**⚠️ IMPORTANTE:** Backup deve essere criptato e protetto!

---

## 📊 Monitoraggio

### Dashboard Stato API

Query per verificare stato API:

```sql
SELECT
  provider_id,
  status,
  last_check,
  response_time_ms
FROM api_monitors
ORDER BY last_check DESC;
```

### Report Audit

```sql
-- Ultimi accessi a credenziali
SELECT
  action,
  user_email,
  resource_id,
  created_at
FROM audit_logs
WHERE resource_type = 'courier_config'
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🚨 Troubleshooting

### Credenziali Non Funzionano

1. Verifica che credenziali siano corrette
2. Controlla stato API (healthy/degraded/down)
3. Verifica log errori per dettagli
4. Contatta supporto corriere se necessario

### Errore Decriptazione

1. Verifica che `ENCRYPTION_KEY` sia configurata
2. Controlla che chiave sia corretta
3. Se necessario, re-inserisci credenziali

### API Sempre Down

1. Verifica URL base nella configurazione
2. Testa manualmente con `curl`
3. Controlla firewall/network
4. Verifica con supporto corriere

---

## 📚 Documentazione Aggiuntiva

- [Sicurezza Credenziali](./SECURITY_CREDENTIALS.md)
- [Versionamento API](./API_VERSIONING.md)
- [Sistema Configurazioni](./COURIER_CONFIGS_SYSTEM.md)

---

## 🤝 Supporto

Per problemi o domande:

1. Controlla questa documentazione
2. Verifica log di audit e monitoraggio
3. Contatta team sviluppo

---

**Ultimo aggiornamento:** Dicembre 2024
