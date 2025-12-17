# 🔧 Fix Creazione Spedizione - Step by Step

## 🎯 Obiettivo

Risolvere il problema di creazione spedizione in produzione verificando:
1. Variabili ambiente Vercel
2. Schema database Supabase
3. RLS policies
4. Permessi service_role

---

## 📋 Step 1: Verifica Variabili Ambiente Vercel

### 1.1 Accedi a Vercel Dashboard

1. Vai su: https://vercel.com/dashboard
2. Seleziona progetto **spediresicuro**
3. Vai su **Settings** → **Environment Variables**

### 1.2 Verifica Variabili

Assicurati che esistano **TUTTE** queste variabili per **Production**:

- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ✅ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **CRITICO**

### 1.3 Se `SUPABASE_SERVICE_ROLE_KEY` manca o è errata:

1. **Ottieni nuova chiave**:
   - Vai su: https://supabase.com/dashboard
   - Seleziona progetto
   - **Settings** → **API**
   - Trova **"service_role"** key
   - Clicca **"Reveal"** e copia

2. **Aggiorna Vercel**:
   - Vercel Dashboard → Settings → Environment Variables
   - Modifica `SUPABASE_SERVICE_ROLE_KEY`
   - Assicurati che sia assegnata a **Production** ✅
   - **Save**

3. **Redeploy**:
   ```bash
   git commit --allow-empty -m "fix: update SUPABASE_SERVICE_ROLE_KEY"
   git push origin master
   ```

---

## 📋 Step 2: Verifica Schema Database

### 2.1 Installa Supabase CLI (se non già fatto)

```bash
npm install --save-dev supabase
```

Oppure:
```powershell
# Con Scoop (Windows)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2.2 Login e Link Progetto

```bash
# Login
supabase login

# Link progetto (usa PROJECT_REF da Supabase Dashboard)
supabase link --project-ref YOUR_PROJECT_REF
```

**Dove trovare PROJECT_REF**:
- Supabase Dashboard → Settings → General → Reference ID

### 2.3 Verifica Schema

```bash
# Esegui script di verifica
npm run verify:schema
```

**Oppure verifica manuale**:

```sql
-- In Supabase SQL Editor
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'shipments'
AND column_name IN (
  'id', 'tracking_number', 'status', 
  'sender_name', 'recipient_name', 'weight',
  'created_at', 'updated_at'
)
ORDER BY column_name;
```

### 2.4 Se Schema Incompleto

```bash
# Applica migrazioni mancanti
supabase db push

# Oppure manualmente in Supabase SQL Editor:
# Esegui: supabase/migrations/004_fix_shipments_schema.sql
```

---

## 📋 Step 3: Verifica RLS Policies

### 3.1 Verifica Policies Esistenti

```bash
# Esegui script
npm run check:rls
```

**Oppure query SQL**:

```sql
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'shipments'
ORDER BY cmd, policyname;
```

### 3.2 Policies Attese

- ✅ `shipments_insert_own` (INSERT)
- ✅ `shipments_insert_reseller` (INSERT)
- ✅ `shipments_select_own` (SELECT)
- ✅ `shipments_select_reseller` (SELECT)
- ✅ `shipments_update_own` (UPDATE)
- ✅ `shipments_update_reseller` (UPDATE)

**Nota**: `service_role` bypassa RLS automaticamente, non serve policy esplicita.

### 3.3 Se Policies Mancano

```sql
-- Applica migrazioni che creano policies:
-- supabase/migrations/001_complete_schema.sql
-- supabase/migrations/009_gdpr_privacy_policies.sql
-- supabase/migrations/019_reseller_system_and_wallet.sql
```

---

## 📋 Step 4: Test Endpoint Diagnostico

### 4.1 Dopo Redeploy

Testa l'endpoint di diagnostica:

```bash
curl https://tuo-dominio.vercel.app/api/test-supabase
```

**Output atteso**:

```json
{
  "isConfigured": true,
  "connectionTest": { "success": true },
  "insertTest": { "success": true },
  "diagnosis": {
    "issue": "All checks passed",
    "severity": "NONE"
  }
}
```

### 4.2 Se `isConfigured: false`

- Verifica `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- Assicurati che NON contenga "placeholder"
- Redeploy dopo aggiornamento

### 4.3 Se `insertTest.success: false`

- Verifica schema (Step 2)
- Verifica RLS (Step 3)
- Controlla log Vercel per errore specifico

---

## 📋 Step 5: Test Creazione Spedizione

### 5.1 Test Manuale

1. Accedi all'applicazione
2. Vai su "Crea Spedizione"
3. Compila form
4. Invia

### 5.2 Verifica Log Vercel

Cerca nei log:

```
✅ [SUPABASE] Spedizione salvata con successo! ID: ...
```

**Se errore**:

```
❌ [SUPABASE] Errore salvataggio: {
  message: "...",
  code: "..."
}
```

### 5.3 Analizza Errore

- **Code `42501`**: RLS policy mancante → Step 3
- **Code `42703`**: Colonna mancante → Step 2
- **Code `23502`**: Campo NOT NULL mancante → Verifica payload
- **Message "Supabase non configurato"**: Step 1

---

## 📋 Step 6: Verifica Finale

### Checklist Completa

- [ ] `SUPABASE_SERVICE_ROLE_KEY` presente in Vercel Production
- [ ] Tabella `shipments` esiste
- [ ] Colonne obbligatorie presenti
- [ ] RLS policies configurate
- [ ] `/api/test-supabase` ritorna `isConfigured: true`
- [ ] `/api/test-supabase` ritorna `insertTest.success: true`
- [ ] Creazione spedizione funziona
- [ ] Log Vercel senza errori

---

## 🆘 Troubleshooting

### Problema: "Supabase non configurato"

**Causa**: `SUPABASE_SERVICE_ROLE_KEY` mancante o errata

**Fix**: Step 1.3

---

### Problema: "column does not exist"

**Causa**: Schema incompleto

**Fix**: Step 2.4

---

### Problema: "permission denied" o "new row violates row-level security policy"

**Causa**: RLS policy mancante o errata

**Fix**: Step 3.3

**Nota**: Se usi `supabaseAdmin`, questo NON dovrebbe succedere perché service_role bypassa RLS. Se succede, verifica che `SUPABASE_SERVICE_ROLE_KEY` sia corretta.

---

### Problema: "null value in column X violates not-null constraint"

**Causa**: Campo obbligatorio mancante nel payload

**Fix**: Verifica `mapSpedizioneToSupabase()` in `lib/database.ts` - assicurati che tutti i campi NOT NULL siano popolati.

---

## 📚 Riferimenti

- **Diagnostica completa**: `docs/DIAGNOSTIC_SHIPMENT_CREATION_FAILURE.md`
- **Setup Supabase CLI**: `docs/SUPABASE_CLI_SETUP.md`
- **Riepilogo fix**: `docs/SHIPMENT_CREATION_FIX_SUMMARY.md`

---

## ✅ Dopo Fix Completato

1. **Rimuovi endpoint test** (opzionale):
   ```bash
   rm app/api/test-supabase/route.ts
   ```

2. **Verifica regressione**:
   - Login funziona ✅
   - Creazione spedizione funziona ✅
   - Lista spedizioni funziona ✅
   - Dettaglio spedizione funziona ✅

3. **Monitora log** per 24-48h per assicurarti che non ci siano errori intermittenti.
