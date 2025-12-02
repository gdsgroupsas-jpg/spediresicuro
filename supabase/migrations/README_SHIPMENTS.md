# 🚀 Script SQL per Compatibilità Shipments con Supabase

## 📋 Descrizione

Questi script SQL allineano perfettamente lo schema Supabase con il codice TypeScript che crea le spedizioni dal web. Garantiscono che tutti i campi usati dal codice siano presenti e correttamente configurati.

## 📁 File Inclusi

1. **`004_fix_shipments_schema.sql`** - Script principale di migrazione
   - Aggiunge tutti i campi mancanti
   - Modifica i vincoli NOT NULL per compatibilità
   - Crea indici per performance
   - Aggiunge trigger e funzioni helper

2. **`005_test_shipments_compatibility.sql`** - Script di test e verifica
   - Verifica che tutti i campi siano presenti
   - Testa l'inserimento di dati
   - Verifica funzioni e trigger

## 🎯 Cosa Fa lo Script

### ⚠️ IMPORTANTE: Gestione Intelligente

Lo script è **intelligente** e gestisce **TUTTI i casi**:

1. ✅ **Se la tabella NON esiste** → La crea completa da zero con tutti i campi
2. ✅ **Se la tabella ESISTE** → Verifica e aggiunge solo i campi mancanti
3. ✅ **Se ci sono vincoli incompatibili** → Li corregge automaticamente
4. ✅ **Se mancano indici** → Li crea per migliorare le performance
5. ✅ **Se è già compatibile** → Non fa nulla (idempotente)

**Puoi eseguirlo in sicurezza anche se la tabella esiste già!**

### Campi Aggiunti (se mancanti)

Lo script aggiunge i seguenti campi che il codice TypeScript usa ma che potrebbero mancare nello schema:

- `ldv` - Lettera di Vettura (importante per Spedisci.Online)
- `imported` - Flag per spedizioni importate
- `import_source` - Sorgente importazione
- `import_platform` - Piattaforma di origine
- `verified` - Flag verifica spedizione
- `packages_count` - Numero di colli
- `content` - Contenuto spedizione
- `sender_reference` - Riferimento mittente (rif_mittente)
- `recipient_reference` - Riferimento destinatario (rif_destinatario)
- `deleted` - Soft delete flag
- `deleted_at` - Data eliminazione
- `deleted_by_user_id` - Utente che ha eliminato
- `created_by_user_email` - Email utente (per NextAuth)

### Modifiche ai Vincoli

Lo script modifica i vincoli NOT NULL sui seguenti campi per permettere valori vuoti (come fa il codice TypeScript):

- `recipient_address`
- `recipient_city`
- `recipient_zip`
- `recipient_province`
- `recipient_phone`

### Indici Creati

Per migliorare le performance delle query:

- `idx_shipments_ldv` - Ricerche per LDV
- `idx_shipments_deleted` - Filtro spedizioni attive
- `idx_shipments_created_by_email` - Ricerche per email utente
- `idx_shipments_imported` - Filtro spedizioni importate
- `idx_shipments_user_deleted` - Query multi-tenancy ottimizzate
- `idx_shipments_tracking_deleted` - Ricerche tracking

## 🚀 Come Usare

### Opzione 1: Supabase Dashboard

1. Vai su [Supabase Dashboard](https://app.supabase.com)
2. Seleziona il tuo progetto
3. Vai su **SQL Editor**
4. Copia e incolla il contenuto di `004_fix_shipments_schema.sql`
5. Esegui lo script
6. (Opzionale) Esegui `005_test_shipments_compatibility.sql` per verificare

### Opzione 2: Supabase CLI

```bash
# Assicurati di essere nella cartella del progetto
cd spediresicuro

# Applica la migrazione
supabase db push

# Oppure esegui manualmente
supabase db execute --file supabase/migrations/004_fix_shipments_schema.sql
```

### Opzione 3: psql (PostgreSQL Client)

```bash
# Connettiti al database Supabase
psql -h [HOST] -U postgres -d postgres -f supabase/migrations/004_fix_shipments_schema.sql
```

## ✅ Verifica

Dopo aver eseguito lo script principale, esegui lo script di test:

```sql
-- Esegui questo script per verificare che tutto sia corretto
\i supabase/migrations/005_test_shipments_compatibility.sql
```

Lo script di test:
- ✅ Verifica che tutti i campi siano presenti
- ✅ Controlla i tipi di dato
- ✅ Testa l'inserimento di dati
- ✅ Verifica funzioni e trigger

## 🔍 Compatibilità con Codice TypeScript

Lo script è perfettamente compatibile con:

- `mapSpedizioneToSupabase()` in `lib/database.ts`
- `addSpedizione()` in `lib/database.ts`
- API route `/api/spedizioni` (POST)
- Form creazione spedizione in `app/dashboard/spedizioni/nuova/page.tsx`

## 📝 Note Importanti

1. **Backup**: Prima di eseguire lo script su produzione, fai sempre un backup del database
2. **Idempotenza**: Lo script è **completamente idempotente** - puoi eseguirlo più volte senza problemi
3. **Tabella Esistente**: Se la tabella esiste già, lo script la **verifica e corregge** solo ciò che serve
4. **Tabella Nuova**: Se la tabella non esiste, lo script la **crea completa** da zero
5. **Downtime**: Lo script non richiede downtime - le modifiche sono compatibili con il codice esistente
6. **RLS**: Se hai Row Level Security abilitato, lo script aggiunge automaticamente le policy necessarie
7. **Dati Esistenti**: I dati esistenti vengono **preservati** - lo script non elimina nulla

## 🐛 Risoluzione Problemi

### Errore: "column already exists"

Se vedi questo errore, significa che il campo esiste già. Lo script usa `DO $$ ... END $$` per verificare prima di aggiungere, quindi questo errore non dovrebbe verificarsi. Se succede, significa che lo script è già stato eseguito.

### Errore: "cannot drop not null constraint"

Questo può succedere se ci sono dati esistenti con valori NULL. In questo caso:
1. Aggiorna i record esistenti con valori di default
2. Poi esegui di nuovo lo script

### Errore: "permission denied"

Assicurati di usare un utente con privilegi sufficienti (di solito `postgres` o `service_role`).

## 📞 Supporto

Se hai problemi o domande:
1. Controlla i log di Supabase
2. Esegui lo script di test per vedere cosa manca
3. Verifica che tutte le estensioni siano installate (`uuid-ossp`)

## 🎉 Dopo l'Installazione

Dopo aver eseguito lo script, il tuo codice TypeScript dovrebbe funzionare perfettamente con Supabase. Tutti i campi usati da `mapSpedizioneToSupabase()` saranno disponibili e correttamente configurati.

---

**Creato per**: SpedireSicuro.it  
**Data**: 2024  
**Versione**: 1.0

