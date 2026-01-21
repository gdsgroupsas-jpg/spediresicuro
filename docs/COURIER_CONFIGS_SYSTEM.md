# Sistema Gestione Dinamica API Corrieri - Documentazione

## 📋 Riepilogo

Sistema Multi-Tenant per gestire configurazioni API corrieri dinamicamente dal database, sostituendo la dipendenza da variabili d'ambiente statiche.

**Caratteristiche:**

- ✅ Configurazioni API gestite dal Superadmin nella dashboard
- ✅ Assegnazione configurazioni specifiche per utente
- ✅ Fallback automatico a configurazione default per provider
- ✅ Retrocompatibilità con variabili d'ambiente
- ✅ Generazione LDV interna (PDF/CSV) senza chiamare API corriere

---

## 🏗️ Architettura

### 1. Database Schema

**Tabella `courier_configs`:**

- `id` (UUID) - Primary Key
- `name` (TEXT) - Nome configurazione (es: "Account Standard")
- `provider_id` (TEXT) - ID provider (es: 'spedisci_online')
- `api_key` (TEXT) - Chiave API
- `api_secret` (TEXT) - Secret opzionale
- `base_url` (TEXT) - URL base API
- `contract_mapping` (JSONB) - Mappa contratti per servizio
- `is_active` (BOOLEAN) - Stato attivo/inattivo
- `is_default` (BOOLEAN) - Configurazione default per provider

**Tabella `users`:**

- `assigned_config_id` (UUID) - Configurazione assegnata specificamente

### 2. Factory Pattern

**File:** `lib/couriers/factory.ts`

La factory recupera la configurazione per un utente seguendo questa priorità:

1. Configurazione assegnata specificamente (`assigned_config_id`)
2. Configurazione default per il provider (`is_default = true`)
3. Fallback a variabili d'ambiente (retrocompatibilità)

### 3. Integrazione

Il sistema è integrato in `lib/actions/spedisci-online.ts` nel metodo `createShipmentWithOrchestrator()`.

---

## 🚀 Utilizzo

### Per il Superadmin

#### 1. Creare Configurazione

1. Vai su `/dashboard/admin/configurations`
2. Clicca "Nuova Configurazione"
3. Compila:
   - **Nome**: Es. "Account Standard", "Account VIP"
   - **Provider**: Seleziona provider (es. Spedisci.Online)
   - **API Key**: Inserisci chiave API
   - **Base URL**: URL base API
   - **Mapping Contratti**: Aggiungi contratti per servizio (es. poste → CODE123)
   - **Default**: Spunta se vuoi usarla come fallback
4. Salva

#### 2. Assegnare Configurazione a Utente

Attualmente l'assegnazione avviene tramite SQL o API. In futuro sarà disponibile nella dashboard admin.

```sql
UPDATE users
SET assigned_config_id = 'uuid-configurazione'
WHERE email = 'utente@example.com';
```

### Per l'Utente

#### Creazione LDV tramite API Corriere (Metodo Attuale)

**Nessuna modifica necessaria!** Il sistema funziona esattamente come prima:

1. Clicca sul corriere nella hero o nei dati spedizione
2. Il sistema usa automaticamente:
   - La tua configurazione assegnata (se presente)
   - La configurazione default per il provider
   - Le variabili d'ambiente (fallback)

**Il flusso rimane invariato:**

- Scelta corriere → Chiamata API → LDV generata

#### Generazione LDV Interna (Nuovo Metodo)

Per generare LDV senza chiamare API corriere:

```typescript
import { generateInternalLDV } from '@/actions/ldv-internal';

// Genera PDF
const result = await generateInternalLDV(shipmentId, 'pdf');

if (result.success) {
  // Download file
  const blob = new Blob([result.data!], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename!;
  a.click();
}
```

**Vantaggi LDV Interna:**

- ✅ Nessuna chiamata API (più veloce)
- ✅ Nessun costo API
- ✅ Funziona offline
- ✅ Formato PDF professionale

**Quando usare:**

- Quando non hai bisogno di tracking number reale dal corriere
- Per test o sviluppo
- Quando le API corriere non sono disponibili
- Per risparmiare costi API

---

## 🔧 Configurazione

### Migration Database

Esegui la migration SQL:

```sql
\i supabase/migrations/010_courier_configs_system.sql
```

### Variabili d'Ambiente (Fallback)

Se non ci sono configurazioni nel DB, il sistema usa le variabili d'ambiente:

```env
SPEDISCI_ONLINE_API_KEY=your_key
SPEDISCI_ONLINE_API_SECRET=your_secret
SPEDISCI_ONLINE_BASE_URL=https://api.example.com
```

---

## 📝 Esempi

### Esempio 1: Configurazione Standard

```typescript
// Il Superadmin crea una configurazione "Account Standard"
// con provider_id = 'spedisci_online'

// Quando un utente crea una spedizione:
const result = await createShipmentWithOrchestrator(shipmentData, 'spedisci_online');

// Il sistema:
// 1. Cerca assigned_config_id per l'utente
// 2. Se non trovato, usa config default per 'spedisci_online'
// 3. Istanzia SpedisciOnlineAdapter con credenziali dalla config
// 4. Crea LDV tramite API
```

### Esempio 2: Assegnazione Specifica

```sql
-- Assegna configurazione VIP a utente specifico
UPDATE users
SET assigned_config_id = 'uuid-config-vip'
WHERE email = 'vip@example.com';
```

Ora quando questo utente crea spedizioni, userà sempre la configurazione VIP.

### Esempio 3: LDV Interna

```typescript
// Genera LDV PDF interna (senza chiamare API)
const result = await generateInternalLDV(shipmentId, 'pdf');

// Oppure CSV
const result = await generateInternalLDV(shipmentId, 'csv');
```

---

## 🔒 Sicurezza

- ✅ Solo admin possono creare/modificare configurazioni
- ✅ Policy RLS su `courier_configs` (solo admin)
- ✅ API keys non esposte al client
- ✅ Validazione input server-side

---

## 🐛 Troubleshooting

### Problema: "Configurazione non trovata"

**Soluzione:**

1. Verifica che esista una configurazione default per il provider
2. Controlla che `is_active = true`
3. Verifica che `is_default = true` per almeno una config del provider

### Problema: "Provider non disponibile"

**Soluzione:**

1. Verifica che il provider sia supportato nella factory
2. Controlla che le credenziali siano valide
3. Usa fallback a variabili d'ambiente

### Problema: LDV interna non genera

**Soluzione:**

1. Verifica che la spedizione esista
2. Controlla che l'utente abbia accesso alla spedizione
3. Verifica che i dati spedizione siano completi

---

## 📚 File Chiave

- `supabase/migrations/010_courier_configs_system.sql` - Schema database
- `actions/configurations.ts` - Server actions CRUD
- `app/dashboard/admin/configurations/page.tsx` - Dashboard admin
- `lib/couriers/factory.ts` - Factory provider
- `lib/actions/spedisci-online.ts` - Integrazione orchestrator
- `actions/ldv-internal.ts` - Generazione LDV interna

---

## 🎯 Prossimi Passi

1. **UI Assegnazione Utenti**: Aggiungere interfaccia nella dashboard admin per assegnare configurazioni a utenti
2. **Supporto Altri Provider**: Estendere factory per GLS, BRT, Poste
3. **Crittografia API Keys**: Crittografare API keys nel database
4. **Logging**: Aggiungere log per tracciare quale configurazione viene usata

---

**Ultimo aggiornamento:** [DATA]
**Versione:** 1.0
