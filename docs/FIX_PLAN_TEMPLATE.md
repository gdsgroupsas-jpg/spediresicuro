# 🔧 Fix Plan: POST /api/spedizioni Production Failure

## 📊 Root Cause Analysis (da completare con input)

### Punto di Fallimento Identificato

**File**: `lib/database.ts`  
**Funzione**: `addSpedizione()`  
**Linea**: ~760 (INSERT Supabase)

### Causa Probabile

[DA COMPLETARE CON LOG VERCEL]

---

## 🛠️ Fix Plan

### Step 1: Verifica Configurazione

**File**: `lib/supabase.ts:78` - `isSupabaseConfigured()`

**Problema potenziale**: `SUPABASE_SERVICE_ROLE_KEY` mancante o errata

**Fix**:
- [ ] Verifica variabile ambiente in Vercel Production
- [ ] Aggiorna se mancante/errata
- [ ] Migliora logging (senza esporre secrets)

### Step 2: Verifica Schema

**File**: `lib/database.ts:760` - INSERT statement

**Problema potenziale**: Colonna mancante o constraint violato

**Fix**:
- [ ] Verifica schema tabella `shipments`
- [ ] Applica migrazioni se necessario
- [ ] Verifica mapping payload → schema

### Step 3: Verifica RLS

**File**: `lib/database.ts:760` - `supabaseAdmin.from('shipments').insert()`

**Problema potenziale**: RLS policy blocca INSERT (improbabile con service_role)

**Fix**:
- [ ] Verifica che `supabaseAdmin` usi service_role correttamente
- [ ] Verifica RLS policies (service_role bypassa automaticamente)

### Step 4: Migliora Logging (Security)

**File**: `lib/database.ts:767` - Error logging

**Problema**: Potrebbe esporre dati sensibili

**Fix**:
- [ ] Rimuovi logging di payload completo in produzione
- [ ] Log solo error code + message (no secrets)
- [ ] Aggiungi correlation ID per tracciamento

---

## 📝 Files da Modificare

### 1. `lib/database.ts`

**Modifiche**:
- Migliora logging errori (no secrets)
- Aggiungi validazione payload pre-INSERT
- Migliora messaggi errore per diagnostica

### 2. `lib/supabase.ts` (se necessario)

**Modifiche**:
- Migliora `isSupabaseConfigured()` per logging più dettagliato
- Verifica che `supabaseAdmin` sia inizializzato correttamente

### 3. `app/api/spedizioni/route.ts` (se necessario)

**Modifiche**:
- Migliora error handling
- Aggiungi correlation ID per tracciamento

---

## 🧪 Regression Test Checklist

- [ ] Login funziona (già confermato)
- [ ] Creazione spedizione funziona
- [ ] Lista spedizioni funziona
- [ ] Dettaglio spedizione funziona
- [ ] Log Vercel senza errori
- [ ] Nessun secret esposto nei log
- [ ] Multi-tenant isolation preservata

---

## 🚀 Deploy Steps

1. **Commit fix**:
   ```bash
   git add .
   git commit -m "fix: resolve POST /api/spedizioni production failure"
   git push origin master
   ```

2. **Verifica deploy**:
   - Attendi deploy Vercel completato
   - Verifica log per errori

3. **Smoke test**:
   ```bash
   # Test endpoint diagnostico
   curl https://tuo-dominio.vercel.app/api/test-supabase
   
   # Test creazione spedizione (dall'app)
   ```

---

## 📋 Status

- [ ] Input ricevuti (log Vercel, network response, env vars)
- [ ] Root cause identificato
- [ ] Fix applicato
- [ ] Test locali passati
- [ ] Deploy in produzione
- [ ] Smoke test passato
- [ ] Monitoraggio 24h

---

**ATTENDO INPUT PER PROCEDERE**
