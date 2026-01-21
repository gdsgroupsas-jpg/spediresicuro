# 🔍 GUIDA RAPIDA: Verificare Migrations 090-096 (FIXED)

## 📋 SCOPO

Verificare quali migrations sono state applicate al database di Supabase.

**FIXED Versione 2.0:**

- ✅ Corretto errore colonna `applied_at` che non esiste
- ✅ Aggiunta verifica migration 096 (`cost_validations`)
- ✅ Query più robuste con `DO ... IF EXISTS`
- ✅ Riepilogo finale automatico

---

## 🚀 COME ESEGUIRE LO SCRIPT

### METODO 1: Supabase Dashboard (Più Semplice)

1. **Accedi a Supabase**
   - Vai su https://app.supabase.com
   - Apri il progetto SpedireSicuro

2. **Apri SQL Editor**
   - Menu laterale → "SQL Editor"
   - Clicca "New Query"

3. **Copia il contenuto dello script**
   - Apri il file: `check-migrations-090-096-fixed.sql`
   - Copia tutto il contenuto

4. **Incolla nel SQL Editor**
   - Incolla tutto nel nuovo query
   - Clicca "Run" (o premi Ctrl+Enter)

5. **Leggi i NOTICES**
   - Guarda la sezione "Messages" in basso
   - Vedrai il riepilogo finale con raccomandazioni

### METODO 2: CLI Supabase (Per Sviluppatori)

Se hai la CLI Supabase installata:

```bash
# Esegui lo script
supabase db execute -f check-migrations-090-096-fixed.sql
```

---

## 📊 INTERPRETARE I RISULTATI

### SEZIONE 1: Migrations Applicate

**Cosa vedi:**

- Lista delle migrations 090-096 con nome

**Interpretazione:**

- Se vedi **7 righe**: Tutte le migrations sono applicate ✅
- Se vedi **0 righe**: Nessuna migration è stata applicata ❌
- Se vedi **1-6 righe**: Solo alcune migrations sono state applicate ⚠️

### SEZIONE 2: Riepilogo Numerico

**Cosa vedi:**

- Numero totale di migrations applicate
- Lista delle versioni (es: `["090","091","092","093","094","095","096"]`)

**Interpretazione:**

- Se dice `migrations_applied = 7`: Tutte le migrations sono applicate ✅
- Se dice `migrations_applied = 0`: Nessuna migration è stata applicata ❌

### SEZIONE 3: Verifica Tabelle/Colonne

**Cosa vedi:**

- Lista di oggetti (tabelle, colonne, viste)
- Ogni oggetto ha stato: `✅ ESISTE` o `❌ NON ESISTE`

**Interpretazione:**

- Se tutti dicono `✅ ESISTE`: Database pronto ✅
- Se alcuni dicono `❌ NON ESISTE`: Le migrations corrispondenti non sono state applicate ⚠️

### SEZIONE 4: Verifica Funzioni RPC

**Cosa vedi:**

- Lista di funzioni RPC critiche
- Ogni funzione ha stato: `✅ ESISTE` o `❌ NON ESISTE`

**Interpretazione:**

- Se tutte dicono `✅ ESISTE`: Funzioni pronte ✅
- Se alcune dicono `❌ NON ESISTE`: Le migrations corrispondenti non sono state applicate ⚠️

### SEZIONE 5: Verifica Security (MIGRATION 095)

**Cosa vedi:**

- Messaggi NOTICE nella sezione "Messages"
- Ti dirà se le funzioni esistono e come verificare i permessi

**Interpretazione:**

- Se dice "Le funzioni RPC critiche esistono":
  - Vai su Supabase Dashboard → Database → Functions
  - Controlla il campo "Security Definer" di ogni funzione
  - Se è `auth.uid()`: ✅ SICURO (solo service_role può eseguire)
  - Se è `postgres` o non impostato: ⚠️ PERICOLO (authenticated può eseguire)

### SEZIONE 6: Verifica Dati

**Cosa vedi:**

- Messaggi NOTICE nella sezione "Messages"
- Numero di record in tabelle nuove:
  - `platform_provider_costs`
  - `financial_audit_log`
  - `account_capabilities`
  - `cost_validations` (migration 096)

**Interpretazione:**

- Se dice "0 recordi trovati": Tabelle vuote, questo è OK (il codice non le ha ancora usate)
- Se dice "N recordi trovati": Ci sono già dati, questo è OK (il codice le ha già usate)

### SEZIONE 7: Verifica api_source IN shipments

**Cosa vedi:**

- Messaggi NOTICE nella sezione "Messages"
- Numero di spedizioni con `api_source` valorizzato
- Distribuzione per valore (`platform`, `reseller_own`, `byoc_own`, `unknown`)

**Interpretazione:**

- Se dice "0 spedizioni con api_source": Nessuna spedizione ha `api_source`, questo è OK (codice vecchio non lo valorizza)
- Se dice "N spedizioni con api_source": Alcune spedizioni hanno già `api_source`, questo è OK (codice nuovo lo valorizza)

### SEZIONE 8: Riepilogo Finale ⭐

**Cosa vedi:**

- Messaggi NOTICE nella sezione "Messages"
- Un riepilogo completo con raccomandazioni

**Interpretazione:**

#### ✅ SE VEDI: "TUTTE LE MIGRATIONS SONO APPLICATE!"

**Significa:**

- ✅ Le migrations 090-096 sono tutte state applicate
- ✅ Il database è PRONTO per PR #38
- ✅ Rollback meno rischioso (no data loss)

**Azioni:**

1. Verificare che il codice esistente su master funziona ancora
2. Testare su staging
3. Preparare contingency plan
4. Fare merge di PR #38

#### ⚠️ SE VEDI: "LA MAGGIOR PARTE DELLE MIGRATIONS È APPLICATA"

**Significa:**

- ⚠️ Solo alcune migrations 090-096 sono state applicate
- ⚠️ Alcune migrations mancano

**Azioni:**

1. Identificare quali migrations mancano (guarda la lista nella sezione 2)
2. Applicare le migrations mancanti in ordine
3. Rieseguire questo script
4. Poi procedere come sopra

#### ❌ SE VEDI: "MIGRATIONS 090-096 NON ANCORA APPLICATE"

**Significa:**

- ❌ Nessuna migration è stata applicata
- ❌ Il database NON è pronto per PR #38

**Azioni:**

1. Applicare migrations 090-096 in ordine
2. Rieseguire questo script
3. Poi procedere come sopra

---

## 🎯 SCENARI POSSIBILI

### SCENARIO A: ✅ TUTTO OK

**Risultati:**

- Sezioni 1-2: Tutte le migrations 090-096 applicate (7/7)
- Sezioni 3-4: Tutti gli oggetti e funzioni ✅ ESISTE
- Sezioni 6-7: Dati OK (vuoti o con dati)
- Sezione 8: "TUTTE LE MIGRATIONS SONO APPLICATE!"

**Significa:**

- ✅ Il database è PRONTO per PR #38
- ✅ La migration 095 (security) è applicata
- ✅ La migration 096 (cost_validations) è applicata
- ✅ Rollback meno rischioso (no data loss)

**Azioni:**

1. Verificare che il codice esistente su master funziona ancora
2. Testare su staging
3. Preparare contingency plan
4. Fare merge di PR #38

---

### SCENARIO B: ⚠️ PARZIALMENTE APPLICATE

**Risultati:**

- Sezioni 1-2: Solo alcune migrations 090-096 applicate (es: 5/7)
- Sezioni 3-4: Alcuni oggetti/funzioni ❌ NON ESISTE
- Sezioni 6-7: Dati OK (vuoti o con dati)
- Sezione 8: "LA MAGGIOR PARTE DELLE MIGRATIONS È APPLICATA"

**Significa:**

- ⚠️ Il database è PARZIALMENTE pronto
- ⚠️ Alcune migrations sono state applicate, altre no
- ⚠️ Incoerenza nel database

**Azioni:**

1. Identificare quali migrations mancano (dalla lista nella sezione 2)
2. Applicare le migrations mancanti in ordine
3. Rieseguire questo script
4. Poi procedere come SCENARIO A

---

### SCENARIO C: ❌ NESSUNA APPLICATA

**Risultati:**

- Sezioni 1-2: Nessuna migration applicata (0/7)
- Sezioni 3-4: Tutti gli oggetti/funzioni ❌ NON ESISTE
- Sezioni 6-7: Dati OK (tabelle non esistono)
- Sezione 8: "MIGRATIONS 090-096 NON ANCORA APPLICATE"

**Significa:**

- ❌ Il database NON è pronto per PR #38
- ❌ Nessuna migration è stata applicata
- ❌ Devi applicare tutte le migrations 090-096

**Azioni:**

1. Applicare migrations 090-096 in ordine:
   - 090: platform_provider_costs
   - 091: shipments.api_source
   - 092: platform_pnl_views
   - 093: financial_audit_log
   - 094: fix_record_platform_provider_cost_alert
   - 095: secure_rpc_functions (URGENTE!)
   - 096: cost_validations
2. Rieseguire questo script
3. Poi procedere come SCENARIO A

---

## 📋 CHECKLIST PRIMA DEL MERGE

- [ ] Eseguito script `check-migrations-090-096-fixed.sql`
- [ ] Verificato che tutte le migrations 090-096 sono applicate (7/7)
- [ ] Verificato che tutte le funzioni RPC esistono
- [ ] Verificato che il codice esistente su master funziona ancora
- [ ] Testato su staging
- [ ] Preparato backup del database
- [ ] Preparato contingency plan
- [ ] Documentato lo stato delle migrations

---

## 💡 RISORSE

- [Documentazione Supabase Migrations](https://supabase.com/docs/guides/cli/local-development)
- [SQL Editor Supabase](https://supabase.com/docs/guides/database/sql-editor)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
- [PR #38 Details](https://github.com/gdsgroupsas-jpg/spediresicuro/pull/38)
- [Migration 096 Details](../supabase/migrations/096_cost_validations.sql)
- [Migration Memory](../MIGRATION_MEMORY.md)

---

## 🆕 NOVITÀ V2.0

### Fixes:

- ✅ Corretto errore `column "applied_at" does not exist`
- ✅ Aggiunta verifica migration 096 (`cost_validations`)
- ✅ Query più robuste con blocchi `DO ... IF EXISTS`
- ✅ Riepilogo finale automatico con raccomandazioni

### Miglioramenti:

- 📊 Messaggi NOTICE più chiari
- 🎯 Riepilogo finale con azioni consigliate
- 📋 Conteggio recordi in tabelle nuove
- 🔍 Verifica distribuzione `api_source`

---

**Data Creazione:** 2026-01-10
**Versione:** 2.0 (FIXED)
**Autore:** AI Agent - Cursor IDE
