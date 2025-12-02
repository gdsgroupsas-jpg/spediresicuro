# 🔍 Guida Rapida: Verifica Configurazione Supabase

## ⚠️ Problema: "Database temporaneamente non disponibile"

Questo errore significa che **Supabase non è configurato correttamente** su Vercel.

---

## ✅ COSA FARE - Passo 1: Verifica Variabili Ambiente su Vercel

1. **Vai su Vercel Dashboard**: https://vercel.com/dashboard
2. **Seleziona il progetto** `spediresicuro` (o il nome del tuo progetto)
3. **Vai su Settings** → **Environment Variables**
4. **Verifica che ci siano queste 3 variabili**:

   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   ```

5. **Se mancano**, devi aggiungerle (vedi Passo 2)

---

## ✅ COSA FARE - Passo 2: Ottenere Credenziali Supabase

### Se NON hai ancora un progetto Supabase:

1. **Vai su**: https://supabase.com
2. **Clicca "Start your project"** o **"Sign In"**
3. **Crea un nuovo progetto**:
   - Nome: `spediresicuro` (o quello che preferisci)
   - Password database: scegli una password forte (⚠️ **SALVALA!**)
   - Region: `West Europe` (più vicina all'Italia)
   - Piano: **Free** (gratuito)
4. ⏳ **Attendi 2-3 minuti** per il provisioning

### Se hai già un progetto Supabase:

1. **Vai su**: https://app.supabase.com
2. **Seleziona il tuo progetto**
3. **Vai su Settings** (icona ingranaggio) → **API**
4. **Copia questi valori**:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## ✅ COSA FARE - Passo 3: Aggiungere Variabili su Vercel

1. **Su Vercel**, vai su **Settings** → **Environment Variables**
2. **Aggiungi queste 3 variabili**:

   | Nome | Valore | Ambiente |
   |------|--------|----------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxxxxxxx.supabase.co` | Production, Preview, Development |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production, Preview, Development |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Production, Preview, Development |

3. **⚠️ IMPORTANTE**: Sostituisci i valori con quelli del TUO progetto Supabase!
4. **Clicca "Save"**
5. **Redeploy il progetto** (Vercel → Deployments → "Redeploy")

---

## ✅ COSA FARE - Passo 4: Creare Tabella Users in Supabase

1. **Vai su Supabase Dashboard** → **SQL Editor**
2. **Clicca "New query"**
3. **Copia e incolla** il contenuto del file `supabase/migrations/001_complete_schema.sql`
4. **Clicca "Run"** (o premi F5)
5. **Verifica** che non ci siano errori

**Oppure** usa lo script automatico:

1. **Apri il terminale** nel progetto locale
2. **Esegui**:
   ```bash
   npm run setup-supabase
   ```
   (se lo script esiste)

---

## ✅ COSA FARE - Passo 5: Verificare che Funzioni

Dopo il redeploy su Vercel:

1. **Apri**: `https://tuo-sito.vercel.app/api/test/check-database`
2. **Dovresti vedere**:
   ```json
   {
     "success": true,
     "supabaseConfigured": true,
     "checks": {
       "tableExists": true,
       "message": "Supabase configurato correttamente e tabella users esiste"
     }
   }
   ```

3. **Se vedi errori**, controlla:
   - Le variabili ambiente su Vercel sono corrette?
   - La tabella `users` esiste in Supabase?
   - Il progetto Supabase è attivo?

---

## 🐛 RISOLUZIONE PROBLEMI

### Errore: "Supabase non configurato"
→ **Soluzione**: Aggiungi le 3 variabili ambiente su Vercel (Passo 3)

### Errore: "La tabella users non esiste"
→ **Soluzione**: Esegui la migration SQL in Supabase (Passo 4)

### Errore: "Connection refused" o "Network error"
→ **Soluzione**: 
- Verifica che il progetto Supabase sia attivo
- Controlla che l'URL Supabase sia corretto
- Verifica che non ci siano firewall che bloccano la connessione

### Errore: "Invalid API key"
→ **Soluzione**: 
- Controlla di aver copiato correttamente le chiavi
- Verifica di aver usato la chiave giusta (anon key vs service role key)
- Assicurati che le chiavi non abbiano spazi o caratteri extra

---

## 📞 SUPPORTO

Se dopo questi passaggi il problema persiste:
1. Controlla i log su Vercel (Deployments → Logs)
2. Controlla i log su Supabase (Logs → API Logs)
3. Usa l'endpoint di test: `/api/test/check-database` per vedere dettagli specifici

