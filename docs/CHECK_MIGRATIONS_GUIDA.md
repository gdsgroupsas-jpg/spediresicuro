# 🔍 GUIDA RAPIDA: Verificare Migrations 090-095

## 📋 SCOPO

Verificare quali migrations sono state applicate al database di Supabase.

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
   - Apri il file: `check-migrations-090-095.sql`
   - Copia tutto il contenuto

4. **Incolla nel SQL Editor**
   - Incolla tutto nel nuovo query
   - Clicca "Run" (o premi Ctrl+Enter)

5. **Analizza i risultati**
   - Vedrai 8 sezioni di output
   - Ogni sezione mostra lo stato di un componente

### METODO 2: CLI Supabase (Per Sviluppatori)

Se hai la CLI Supabase installata:

```bash
# Esegui lo script
supabase db execute -f check-migrations-090-095.sql
```

---

## 📊 INTERPRETARE I RISULTATI

### SEZIONE 1: Migrations Applicate

**Cosa vedi:**

- Lista delle migrations 090-095 con data applicazione

**Interpretazione:**

- Se vedi **5 righe**: Tutte le migrations sono applicate ✅
- Se vedi **0 righe**: Nessuna migration è stata applicata ❌
- Se vedi **1-4 righe**: Solo alcune migrations sono state applicate ⚠️

### SEZIONE 2: Riepilogo Numerico

**Cosa vedi:**

- Numero totale di migrations applicate
- Lista delle versioni (es: `["090","091","092","093","094","095"]`)

**Interpretazione:**

- Se dice `migrations_applied = 5`: Tutte le migrations sono applicate ✅
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

- Per ogni funzione RPC critica, lo stato di sicurezza:
  - `✅ SICURO: SOLO service_role può eseguire`
  - `⚠️ PERICOLO: authenticated PUÒ ESEGUIRE`

**Interpretazione:**

- Se tutte dicono `✅ SICURO`: Security hotfix applicato ✅
- Se dicono `⚠️ PERICOLO`: **URGENTE!** La migration 095 non è stata applicata 🔴

### SEZIONE 6: Verifica Dati

**Cosa vedi:**

- Numero di record in tabelle nuove:
  - `platform_provider_costs`
  - `financial_audit_log`
  - `account_capabilities`

**Interpretazione:**

- Se `numero_record = 0`: Tabelle vuote, questo è OK (il codice non le ha ancora usate)
- Se `numero_record > 0`: Ci sono già dati, questo è OK (il codice le ha già usate)

### SEZIONE 7: Verifica api_source IN shipments

**Cosa vedi:**

- Numero di spedizioni con `api_source` valorizzato
- Distribuzione per valore (`platform`, `reseller_own`, `byoc_own`, `unknown`)

**Interpretazione:**

- Se `numero_spedizioni = 0`: Nessuna spedizione ha `api_source`, questo è OK (codice vecchio non lo valorizza)
- Se `numero_spedizioni > 0`: Alcune spedizioni hanno già `api_source`, questo è OK (codice nuovo lo valorizza)

---

## 🎯 SCENARI POSSIBILI

### SCENARIO A: TUTTO ✅

**Risultati:**

- Sezioni 1-2: Tutte le migrations 090-095 applicate
- Sezioni 3-4: Tutti gli oggetti e funzioni ✅ ESISTE
- Sezione 5: Tutte le funzioni ✅ SICURO
- Sezioni 6-7: Dati OK (vuoti o con dati)

**Significa:**

- ✅ Il database è PRONTO per PR #38
- ✅ La migration 095 (security) è applicata
- ✅ Rollback meno rischioso (no data loss)
- ✅ Testare che il codice esistente funziona ancora

**Azioni:**

1. Verificare che il codice esistente su master funziona ancora
2. Testare su staging
3. Preparare contingency plan
4. Fare merge di PR #38

---

### SCENARIO B: PARZIALMENTE APPLICATE

**Risultati:**

- Sezioni 1-2: Solo alcune migrations 090-095 applicate
- Sezioni 3-4: Alcuni oggetti/funzioni ❌ NON ESISTE
- Sezione 5: Alcune funzioni ⚠️ PERICOLO
- Sezioni 6-7: Dati OK (vuoti o con dati)

**Significa:**

- ⚠️ Il database è PARZIALMENTE pronto
- ⚠️ Alcune migrations sono state applicate, altre no
- ⚠️ Incoerenza nel database

**Azioni:**

1. Identificare quali migrations mancano
2. Applicare le migrations mancanti
3. Rieseguire questo script di verifica
4. Poi procedere come SCENARIO A

---

### SCENARIO C: NESSUNA APPLICATA

**Risultati:**

- Sezioni 1-2: Nessuna migration applicata
- Sezioni 3-4: Tutti gli oggetti/funzioni ❌ NON ESISTE
- Sezione 5: Tutte le funzioni ⚠️ PERICOLO
- Sezioni 6-7: Dati OK (tabelle non esistono)

**Significa:**

- ❌ Il database NON è pronto per PR #38
- ❌ Nessuna migration è stata applicata
- ❌ Devi applicare tutte le migrations 090-095

**Azioni:**

1. Applicare migrations 090-095 in ordine
2. Rieseguire questo script di verifica
3. Poi procedere come SCENARIO A

---

### SCENARIO D: SECURITY PROBLEMA 🔴

**Risultati:**

- Sezioni 1-4: Tutto OK
- Sezione 5: ⚠️ PERICOLO per una o più funzioni
- Sezioni 6-7: Dati OK

**Significa:**

- 🔴 Le migrations 090-094 sono applicate
- 🔴 La migration 095 (security hotfix) NON è applicata
- 🔴 Le funzioni RPC critiche sono accessibili da authenticated
- 🔴 **VULNERABILITÀ DI SICUREZZA CRITICA!**

**Azioni URGENTI:**

1. Applicare IMMEDIATAMENTE migration 095
2. Rieseguire questo script di verifica
3. Verificare che tutte le funzioni siano ✅ SICURO
4. Poi procedere come SCENARIO A

---

## ⚠️ ERRORI COMUNI

### Errore 1: "relation does not exist"

**Cosa succede:**

- Lo script cerca di queryare una tabella che non esiste

**Soluzione:**

- Normalmente è OK (la tabella non esiste perché la migration non è stata applicata)
- Guarda il risultato della sezione "VERIFICA TABELLE/OGGETTI CREATI"

### Errore 2: "permission denied"

**Cosa succede:**

- Non hai i permessi per eseguire certe query

**Soluzione:**

- Assicurati di essere loggato come SuperAdmin o usa service_role
- Contatta l'amministratore del database

### Errore 3: "function does not exist"

**Cosa succede:**

- La sezione di verifica funzioni prova a chiamare una funzione che non esiste

**Soluzione:**

- Normalmente è OK (la funzione non esiste perché la migration non è stata applicata)
- Guarda il risultato della sezione "VERIFICA FUNZIONI RPC CRITICHE"

---

## 📋 CHECKLIST PRIMA DEL MERGE

- [ ] Eseguito script `check-migrations-090-095.sql`
- [ ] Verificato che tutte le migrations 090-095 sono applicate
- [ ] Verificato che tutte le funzioni RPC sono ✅ SICURO
- [ ] Verificato che il codice esistente su master funziona ancora
- [ ] Testato su staging
- [ ] Preparato backup del database
- [ ] Preparato contingency plan
- [ ] Documentato lo stato delle migrations

---

## 💡 RISORSE

- [Documentazione Supabase Migrations](https://supabase.com/docs/guides/cli/local-development)
- [SQL Editor Supabase](https://supabase.com/docs/guides/database/sql-editor)
- [PR #38 Details](https://github.com/gdsgroupsas-jpg/spediresicuro/pull/38)
- [Migration Memory](../MIGRATION_MEMORY.md)

---

**Data Creazione**: 2026-01-10  
**Versione**: 1.0
