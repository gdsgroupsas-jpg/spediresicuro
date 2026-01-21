# 🔍 Diagnostica: Creazione Spedizione Fallisce in Produzione

## 📋 Contesto

- **Problema**: Creazione spedizione fallisce in produzione
- **Login**: Funziona correttamente ✅
- **Endpoint**: `POST /api/spedizioni`
- **Cambiamenti recenti**: Rotazione secrets + git history rewrite + force push

---

## 🔄 Flusso Creazione Spedizione

```
POST /api/spedizioni
  ↓
1. Verifica autenticazione (NextAuth) ✅
  ↓
2. Valida dati input ✅
  ↓
3. Chiama addSpedizione() da lib/database.ts
  ↓
4. Verifica isSupabaseConfigured()
   ├─ NEXT_PUBLIC_SUPABASE_URL
   ├─ NEXT_PUBLIC_SUPABASE_ANON_KEY
   └─ SUPABASE_SERVICE_ROLE_KEY ⚠️ CRITICO
  ↓
5. getSupabaseUserIdFromEmail() → usa supabaseAdmin
  ↓
6. mapSpedizioneToSupabase() → prepara payload
  ↓
7. supabaseAdmin.from('shipments').insert() → SALVATAGGIO
```

---

## 🎯 Ipotesi Principali

### **Ipotesi 1: SUPABASE_SERVICE_ROLE_KEY Mancante/Incorretta** ⚠️ PIÙ PROBABILE

**Perché**: Login usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side), mentre creazione spedizione usa `SUPABASE_SERVICE_ROLE_KEY` (server-side).

**Verifica**:

```bash
# In Vercel Dashboard > Settings > Environment Variables
# Verifica che esista:
SUPABASE_SERVICE_ROLE_KEY

# Controlla che NON sia:
- Vuota
- Contenga "placeholder"
- Sia la vecchia chiave (dopo rotazione secrets)
```

**Log da cercare in Vercel**:

```
❌ [SUPABASE] Supabase non configurato. Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY
```

**Fix**:

1. Vai su Supabase Dashboard > Settings > API
2. Copia la nuova `service_role` key (secret)
3. Aggiorna in Vercel: Settings > Environment Variables > `SUPABASE_SERVICE_ROLE_KEY`
4. **Redeploy** (o aspetta auto-deploy se hai push su master)

---

### **Ipotesi 2: Errore RLS (Row Level Security) o Permessi**

**Perché**: Anche se `supabaseAdmin` bypassa RLS, potrebbe esserci un problema con:

- Policy INSERT sulla tabella `shipments`
- Permessi sulla tabella `user_profiles` (usata da `getSupabaseUserIdFromEmail`)

**Verifica nei log Vercel**:

```
❌ [SUPABASE] Errore salvataggio: {
  message: "new row violates row-level security policy"
  code: "42501"
}
```

**Oppure**:

```
❌ [SUPABASE] Errore getSupabaseUserIdFromEmail: permission denied
```

**Fix**:

1. Verifica in Supabase Studio > Authentication > Policies
2. Controlla che esista policy INSERT per `shipments`
3. Verifica che `service_role` abbia accesso completo

**Query SQL per verificare**:

```sql
-- Verifica policy INSERT su shipments
SELECT * FROM pg_policies
WHERE tablename = 'shipments'
AND cmd = 'INSERT';

-- Se non esiste, crea policy per service_role
CREATE POLICY "Service role can insert shipments" ON shipments
FOR INSERT
TO service_role
WITH CHECK (true);
```

---

### **Ipotesi 3: Schema Mismatch - Campo Mancante o Tipo Errato**

**Perché**: Dopo rotazione secrets, potrebbe esserci un problema con:

- Campi obbligatori mancanti nel payload
- Tipo di dato errato (es. stringa invece di numero)
- Vincoli NOT NULL violati

**Verifica nei log Vercel**:

```
❌ [SUPABASE] Errore salvataggio: {
  message: "column \"X\" does not exist"
  code: "42703"
}
```

**Oppure**:

```
❌ [SUPABASE] Errore salvataggio: {
  message: "null value in column \"X\" violates not-null constraint"
  code: "23502"
}
```

**Fix**:

1. Controlla il payload completo nei log: `📋 [SUPABASE] Payload FINALE da inserire:`
2. Confronta con schema Supabase: `supabase/migrations/`
3. Verifica che tutti i campi NOT NULL siano presenti

---

### **Ipotesi 4: Errore Network/Timeout**

**Perché**: Problemi di connettività tra Vercel e Supabase.

**Verifica nei log Vercel**:

```
❌ [SUPABASE] Errore generico salvataggio: fetch failed
❌ [SUPABASE] Errore generico salvataggio: timeout
```

**Fix**:

1. Verifica che `NEXT_PUBLIC_SUPABASE_URL` sia corretto
2. Controlla status Supabase: https://status.supabase.com/
3. Verifica rate limits in Supabase Dashboard

---

## 🔧 Comandi Diagnostici

### 1. Verifica Variabili Ambiente in Produzione

**In Vercel Dashboard**:

1. Vai su: Project > Settings > Environment Variables
2. Verifica che esistano TUTTE queste variabili:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` ⚠️

3. Controlla che siano assegnate a **Production** (non solo Preview/Development)

### 2. Test Endpoint Health Check

**Crea endpoint di test** (temporaneo):

```typescript
// app/api/test-supabase/route.ts
import { isSupabaseConfigured, supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const config = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    isConfigured: isSupabaseConfigured(),
  };

  // Test connessione
  let connectionTest = null;
  if (config.isConfigured) {
    try {
      const { data, error } = await supabaseAdmin.from('shipments').select('id').limit(1);
      connectionTest = { success: !error, error: error?.message };
    } catch (e: any) {
      connectionTest = { success: false, error: e.message };
    }
  }

  return Response.json({ config, connectionTest });
}
```

**Test**:

```bash
curl https://tuo-dominio.vercel.app/api/test-supabase
```

### 3. Analizza Log Vercel

**Cerca questi pattern nei log**:

```bash
# Pattern 1: Configurazione mancante
grep "Supabase non configurato" vercel-logs.txt

# Pattern 2: Errore salvataggio
grep "❌ \[SUPABASE\] Errore salvataggio" vercel-logs.txt

# Pattern 3: Errore getSupabaseUserIdFromEmail
grep "❌ \[SUPABASE\] Errore getSupabaseUserIdFromEmail" vercel-logs.txt

# Pattern 4: Payload finale (per vedere cosa viene inviato)
grep "📋 \[SUPABASE\] Payload FINALE" vercel-logs.txt
```

---

## 📊 Matrice Decisionale

| Sintomo          | Log Pattern                      | Causa Probabile                      | Fix                          |
| ---------------- | -------------------------------- | ------------------------------------ | ---------------------------- |
| Errore immediato | "Supabase non configurato"       | `SUPABASE_SERVICE_ROLE_KEY` mancante | Aggiungi variabile in Vercel |
| Errore 401/403   | "permission denied"              | RLS policy mancante                  | Crea policy INSERT           |
| Errore 400       | "column does not exist"          | Schema mismatch                      | Verifica migrazioni          |
| Errore 500       | "null value violates constraint" | Campo obbligatorio mancante          | Verifica payload             |
| Timeout          | "fetch failed"                   | Problema network                     | Verifica URL Supabase        |

---

## ✅ Fix Rapido (Se Ipotesi 1)

**Se `SUPABASE_SERVICE_ROLE_KEY` è mancante o errata**:

1. **Ottieni nuova chiave**:
   - Vai su: https://supabase.com/dashboard
   - Seleziona progetto
   - Settings > API
   - Copia `service_role` key (clicca "Reveal")

2. **Aggiorna Vercel**:
   - Vai su: https://vercel.com/dashboard
   - Seleziona progetto
   - Settings > Environment Variables
   - Modifica `SUPABASE_SERVICE_ROLE_KEY`
   - Salva

3. **Redeploy**:

   ```bash
   # Opzione 1: Push vuoto per triggerare redeploy
   git commit --allow-empty -m "fix: update SUPABASE_SERVICE_ROLE_KEY"
   git push origin master

   # Opzione 2: Redeploy manuale da Vercel Dashboard
   # Deployments > ... > Redeploy
   ```

4. **Verifica**:
   - Attendi deploy completato
   - Prova creare spedizione
   - Controlla log Vercel per conferma

---

## 🧪 Test di Regressione

Dopo il fix, verifica:

1. ✅ **Login funziona** (già confermato)
2. ✅ **Creazione spedizione funziona**
3. ✅ **Lista spedizioni funziona**
4. ✅ **Dettaglio spedizione funziona**

**Comandi test**:

```bash
# 1. Test login (già funziona)
curl -X POST https://tuo-dominio.vercel.app/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"..."}'

# 2. Test creazione spedizione (da testare)
curl -X POST https://tuo-dominio.vercel.app/api/spedizioni \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=..." \
  -d '{
    "mittenteNome": "Test",
    "destinatarioNome": "Test Dest",
    "peso": 1,
    "corriere": "GLS"
  }'
```

---

## 📝 Note Aggiuntive

- **Login funziona** perché usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-side)
- **Creazione spedizione fallisce** perché usa `SUPABASE_SERVICE_ROLE_KEY` (server-side)
- Dopo rotazione secrets, è probabile che `SUPABASE_SERVICE_ROLE_KEY` non sia stata aggiornata in Vercel
- Il codice ha già logging dettagliato: cerca `❌ [SUPABASE]` nei log Vercel

---

## 🆘 Se Nulla Funziona

1. **Crea issue di supporto** con:
   - Log Vercel completi (ultimi 1000 log)
   - Output di `/api/test-supabase` (se creato)
   - Screenshot Vercel Environment Variables (nomi, non valori)
   - Timestamp esatto dell'errore

2. **Verifica Supabase Dashboard**:
   - Logs > API Logs (vedi se ci sono richieste fallite)
   - Database > Tables > shipments (verifica schema)

3. **Rollback temporaneo**:
   - Se possibile, ripristina vecchia `SUPABASE_SERVICE_ROLE_KEY` per verificare se era quella
