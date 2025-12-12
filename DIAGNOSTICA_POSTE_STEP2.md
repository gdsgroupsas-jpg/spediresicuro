# DIAGNOSTICA POSTE ITALIANE - STEP 2: Verifica Database

## SCHEMA DATABASE

### Tabella `courier_configs` (DDL Completo)

```sql
CREATE TABLE IF NOT EXISTS public.courier_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificazione
  name TEXT NOT NULL, -- Es: "Account Standard", "Account VIP", "Account Dropshipping"
  provider_id TEXT NOT NULL, -- Es: 'spedisci_online', 'gls', 'brt', etc.
  
  -- Credenziali API
  api_key TEXT NOT NULL, -- Chiave API segreta (crittografare in produzione)
  api_secret TEXT, -- Secret opzionale (se richiesto dal provider)
  base_url TEXT NOT NULL, -- Es: 'https://ecommerceitalia.spedisci.online/api/v2'
  
  -- Configurazione Contratti
  contract_mapping JSONB DEFAULT '{}', -- Mappa dinamica servizi/contratti
  -- Esempio: { "poste": "CODE123", "gls": "CODE456", "brt": "CODE789" }
  
  -- Stato e Priorità
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Se true, usata come fallback per utenti senza assegnazione
  
  -- Metadata
  description TEXT, -- Descrizione opzionale della configurazione
  notes TEXT, -- Note interne per admin
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT, -- Email dell'admin che ha creato la configurazione
  
  -- Vincoli
  CONSTRAINT valid_contract_mapping CHECK (jsonb_typeof(contract_mapping) = 'object')
);
```

### Indici

```sql
CREATE INDEX IF NOT EXISTS idx_courier_configs_provider ON public.courier_configs(provider_id);
CREATE INDEX IF NOT EXISTS idx_courier_configs_active ON public.courier_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_courier_configs_default ON public.courier_configs(is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_courier_configs_provider_active ON public.courier_configs(provider_id, is_active);

-- Unique index parziale: solo una config default per provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_courier_configs_unique_default 
  ON public.courier_configs(provider_id) 
  WHERE is_default = true;
```

### Funzioni Helper

```sql
-- Funzione: Ottieni configurazione corriere per utente
CREATE OR REPLACE FUNCTION get_courier_config_for_user(
  p_user_id UUID,
  p_provider_id TEXT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  provider_id TEXT,
  api_key TEXT,
  api_secret TEXT,
  base_url TEXT,
  contract_mapping JSONB,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cc.id,
    cc.name,
    cc.provider_id,
    cc.api_key,
    cc.api_secret,
    cc.base_url,
    cc.contract_mapping,
    cc.is_active
  FROM public.courier_configs cc
  WHERE cc.provider_id = p_provider_id
    AND cc.is_active = true
    AND (
      -- Caso 1: Configurazione assegnata specificamente all'utente
      cc.id = (SELECT assigned_config_id FROM public.users WHERE id = p_user_id)
      OR
      -- Caso 2: Configurazione default (solo se utente non ha assegnazione)
      (cc.is_default = true AND (SELECT assigned_config_id FROM public.users WHERE id = p_user_id) IS NULL)
    )
  ORDER BY 
    -- Priorità: prima assigned, poi default
    CASE WHEN cc.id = (SELECT assigned_config_id FROM public.users WHERE id = p_user_id) THEN 0 ELSE 1 END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**File Migration:** `supabase/migrations/010_courier_configs_system.sql`

---

## CONFIGURAZIONI ESISTENTI

### Script Creato: `scripts/check-poste-config.ts`

**Per eseguire lo script:**

```bash
# Opzione 1: Con tsx (se installato globalmente)
npx tsx scripts/check-poste-config.ts

# Opzione 2: Con node e ts-node (se configurato)
npm run ts-node scripts/check-poste-config.ts

# Opzione 3: Eseguire manualmente la query SQL in Supabase Studio
```

**Query SQL Manuale (da eseguire in Supabase SQL Editor):**

```sql
SELECT 
  id,
  name,
  provider_id,
  base_url,
  is_active,
  is_default,
  CASE WHEN api_key IS NOT NULL THEN '✅ Presente' ELSE '❌ Mancante' END as api_key_status,
  CASE WHEN api_secret IS NOT NULL THEN '✅ Presente' ELSE '❌ Mancante' END as api_secret_status,
  contract_mapping->>'cdc' as cdc,
  created_at,
  updated_at,
  created_by
FROM courier_configs
WHERE provider_id = 'poste'
ORDER BY created_at DESC;
```

**Output Atteso:**

Lo script verificherà:
- ✅ Numero di configurazioni Poste trovate
- ✅ Dettagli di ogni configurazione (ID, nome, base_url, stato)
- ✅ Presenza di api_key e api_secret (criptati)
- ✅ Valore CDC nel contract_mapping
- ⚠️ Avvisi se nessuna configurazione attiva o default

---

## TEST DECRYPTION

### Script Creato: `scripts/test-decrypt.ts`

**Per eseguire lo script:**

```bash
# Assicurati che ENCRYPTION_KEY sia configurata in .env.local
npx tsx scripts/test-decrypt.ts
```

**Requisiti:**
- ✅ `ENCRYPTION_KEY` deve essere presente in `.env.local`
- ✅ Deve essere la stessa chiave usata per criptare le credenziali
- ✅ Deve esserci almeno una configurazione Poste attiva nel database

**Output Atteso:**

```
🔐 Test decriptazione credenziali Poste...

📋 Configurazione trovata: Poste Italiane - API
ID: [uuid]

✅ API Key decriptata con successo
Client ID (primi 15 caratteri): [primi caratteri]...
Lunghezza totale: [numero] caratteri

✅ API Secret decriptata con successo
Client Secret (primi 15 caratteri): [primi caratteri]...
Lunghezza totale: [numero] caratteri

✅ Test decriptazione completato
```

**Possibili Errori:**

1. **"ENCRYPTION_KEY non configurata"**
   - Soluzione: Aggiungi `ENCRYPTION_KEY` in `.env.local`

2. **"Errore decriptazione: Formato dati criptati non valido"**
   - Causa: Credenziali non criptate o formato corrotto
   - Soluzione: Ricrea la configurazione tramite wizard

3. **"Errore decriptazione: Errore durante la decriptazione"**
   - Causa: `ENCRYPTION_KEY` diversa da quella usata per criptare
   - Soluzione: Usa la stessa chiave o ricrea la configurazione

---

## NOTE IMPORTANTI

1. **Criptazione Credenziali:**
   - Le credenziali vengono criptate automaticamente quando salvate tramite `saveConfiguration()`
   - Funzione: `encryptCredential()` in `lib/security/encryption.ts`
   - Algoritmo: AES-256-GCM
   - Formato: `iv:salt:tag:encrypted` (tutti in base64)

2. **Mapping Database → Adapter:**
   - `api_key` (DB) → `client_id` (Adapter Poste)
   - `api_secret` (DB) → `client_secret` (Adapter Poste)
   - `contract_mapping->>'cdc'` (DB) → `cost_center_code` (Adapter Poste)

3. **Priorità Configurazioni:**
   - 1. Configurazione assegnata all'utente (`assigned_config_id`)
   - 2. Configurazione default per provider (`is_default = true`)

---

## PROSSIMI PASSI

Dopo aver verificato il database:

1. ✅ Se non ci sono configurazioni: Configura Poste via UI (`/dashboard/integrazioni`)
2. ✅ Se decriptazione fallisce: Verifica `ENCRYPTION_KEY` o ricrea configurazione
3. ✅ Se configurazione non attiva: Attiva tramite UI o query SQL
4. ✅ Se CDC mancante: Aggiungi nel `contract_mapping` tramite wizard

