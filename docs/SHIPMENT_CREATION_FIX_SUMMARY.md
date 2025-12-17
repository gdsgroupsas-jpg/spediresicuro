# 🔧 Riepilogo Diagnostica: Creazione Spedizione

## 📊 Analisi Completata

Ho analizzato il codice e identificato il flusso di creazione spedizione. Ecco cosa ho trovato:

### Flusso Identificato
1. **POST `/api/spedizioni`** → `app/api/spedizioni/route.ts`
2. Chiama **`addSpedizione()`** → `lib/database.ts:591`
3. Verifica **`isSupabaseConfigured()`** → richiede 3 variabili:
   - `NEXT_PUBLIC_SUPABASE_URL` ✅ (login funziona, quindi presente)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ✅ (login funziona, quindi presente)
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **SOSPETTO PRINCIPALE**
4. Usa **`supabaseAdmin`** per INSERT → richiede `SUPABASE_SERVICE_ROLE_KEY`

### Perché Login Funziona ma Creazione No?

- **Login**: Usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side) ✅
- **Creazione spedizione**: Usa `SUPABASE_SERVICE_ROLE_KEY` (server-side) ❌

**Conclusione**: Dopo la rotazione secrets, `SUPABASE_SERVICE_ROLE_KEY` probabilmente non è stata aggiornata in Vercel.

---

## 🎯 Causa Più Probabile

**`SUPABASE_SERVICE_ROLE_KEY` mancante o errata in Vercel**

### Verifica Rapida

1. **Vai su Vercel Dashboard** → Il tuo progetto → Settings → Environment Variables
2. **Cerca** `SUPABASE_SERVICE_ROLE_KEY`
3. **Verifica**:
   - ✅ Esiste?
   - ✅ È assegnata a "Production"?
   - ✅ NON contiene "placeholder"?
   - ✅ È la nuova chiave (dopo rotazione)?

---

## 🛠️ Strumenti Creati

### 1. Documento Diagnostico Completo
📄 `docs/DIAGNOSTIC_SHIPMENT_CREATION_FAILURE.md`

Contiene:
- 4 ipotesi principali con verifiche
- Comandi diagnostici
- Matrice decisionale
- Fix step-by-step

### 2. Endpoint di Test
🔗 `app/api/test-supabase/route.ts`

**Come usare**:
```bash
# Dopo deploy, testa:
curl https://tuo-dominio.vercel.app/api/test-supabase

# Oppure apri nel browser:
https://tuo-dominio.vercel.app/api/test-supabase
```

**Cosa verifica**:
- ✅ Presenza variabili ambiente
- ✅ Configurazione Supabase
- ✅ Connessione database
- ✅ Permessi INSERT
- ✅ Accesso tabella user_profiles

**Output esempio**:
```json
{
  "isConfigured": false,
  "envCheck": {
    "SUPABASE_SERVICE_ROLE_KEY": {
      "present": false,
      "value": "MISSING"
    }
  },
  "diagnosis": {
    "issue": "SUPABASE_SERVICE_ROLE_KEY missing or invalid",
    "severity": "CRITICAL"
  }
}
```

---

## ✅ Fix Immediato (Se Ipotesi 1)

### Step 1: Ottieni Nuova Chiave
1. Vai su: https://supabase.com/dashboard
2. Seleziona progetto
3. **Settings** → **API**
4. Trova **"service_role"** key
5. Clicca **"Reveal"** e copia la chiave

### Step 2: Aggiorna Vercel
1. Vai su: https://vercel.com/dashboard
2. Seleziona progetto
3. **Settings** → **Environment Variables**
4. Modifica `SUPABASE_SERVICE_ROLE_KEY`:
   - Se esiste: aggiorna valore
   - Se non esiste: crea nuova variabile
5. Assicurati che sia assegnata a **Production** ✅
6. **Save**

### Step 3: Redeploy
```bash
# Opzione 1: Push vuoto
git commit --allow-empty -m "fix: update SUPABASE_SERVICE_ROLE_KEY"
git push origin master

# Opzione 2: Redeploy manuale da Vercel Dashboard
# Deployments → ... → Redeploy
```

### Step 4: Verifica
1. Attendi deploy completato
2. Testa endpoint: `https://tuo-dominio.vercel.app/api/test-supabase`
3. Verifica che `isConfigured: true` e `insertTest.success: true`
4. Prova creare spedizione

---

## 🔍 Se Il Problema Persiste

### Verifica Log Vercel

Cerca questi pattern nei log:

```bash
# Pattern 1: Configurazione mancante
❌ [SUPABASE] Supabase non configurato

# Pattern 2: Errore salvataggio
❌ [SUPABASE] Errore salvataggio: {
  message: "...",
  code: "..."
}

# Pattern 3: Payload finale (per debug)
📋 [SUPABASE] Payload FINALE da inserire: {...}
```

### Altri Possibili Problemi

1. **RLS Policy mancante**:
   - Verifica in Supabase Studio → Authentication → Policies
   - Cerca policy INSERT per `shipments`

2. **Schema mismatch**:
   - Controlla log per errori tipo "column does not exist"
   - Verifica migrazioni: `supabase/migrations/`

3. **Network/Timeout**:
   - Verifica che `NEXT_PUBLIC_SUPABASE_URL` sia corretto
   - Controlla status Supabase: https://status.supabase.com/

---

## 📝 Input Mancanti (Per Diagnosi Più Precisa)

Se puoi fornire, aiuterebbero:

1. **Log Vercel** (ultimi 50-100 log intorno all'errore):
   - Cerca: `❌ [SUPABASE]` o `❌ [API]`
   - Timestamp esatto

2. **Errore Browser Network**:
   - Endpoint: `POST /api/spedizioni`
   - Status code: `500` / `503` / `400`?
   - Response body: `{ error: "...", message: "..." }`

3. **Lista Variabili Ambiente Vercel** (solo nomi, non valori):
   - Esempio: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, ecc.

---

## 🧪 Test di Regressione

Dopo il fix, verifica:

- ✅ Login funziona (già confermato)
- ✅ Creazione spedizione funziona
- ✅ Lista spedizioni funziona
- ✅ Dettaglio spedizione funziona

---

## 🗑️ Cleanup Dopo Fix

**Rimuovi endpoint di test** (opzionale, per sicurezza):
```bash
rm app/api/test-supabase/route.ts
```

Oppure lascialo per future diagnosi (non espone dati sensibili).

---

## 📚 Documentazione Riferimento

- **Diagnostica completa**: `docs/DIAGNOSTIC_SHIPMENT_CREATION_FAILURE.md`
- **Guida variabili ambiente**: `GUIDA_VARIABLI_AMBIENTE.md`
- **Codice rilevante**:
  - `app/api/spedizioni/route.ts:191` (POST handler)
  - `lib/database.ts:591` (addSpedizione)
  - `lib/supabase.ts:78` (isSupabaseConfigured)

---

## ⚡ Quick Fix Checklist

- [ ] Verificato `SUPABASE_SERVICE_ROLE_KEY` in Vercel
- [ ] Aggiornata chiave se errata/mancante
- [ ] Redeploy eseguito
- [ ] Testato `/api/test-supabase`
- [ ] Testato creazione spedizione
- [ ] Verificato log Vercel (nessun errore)

---

**Prossimi passi**: Esegui il fix immediato (Step 1-4) e fammi sapere il risultato!

