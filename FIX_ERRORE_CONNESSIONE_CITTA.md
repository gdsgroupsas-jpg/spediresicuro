# 🔧 Fix: Errore di Connessione Autocomplete Città

**Problema:** Quando si digita una città nel form spedizione, appare "Errore di connessione. Riprova."

**Causa:** Il sistema di autocomplete città usa Supabase per cercare i comuni italiani. L'errore indica che:
1. Le variabili Supabase non sono configurate in Vercel (produzione)
2. La tabella `geo_locations` non esiste o è vuota
3. C'è un problema di connessione a Supabase

---

## ✅ Soluzione Passo-Passo

### 1. Verifica Variabili Supabase in Vercel

**IMPORTANTE:** Le variabili Supabase DEVONO essere configurate in Vercel per la produzione!

1. Vai su **Vercel Dashboard**: https://vercel.com
2. Seleziona il progetto **"spediresicuro"**
3. Vai su **Settings** → **Environment Variables**
4. Verifica che ci siano queste variabili:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

**Se mancano:**
1. Vai su **Supabase Dashboard**:
2. Seleziona il tuo progetto
3. Vai su **Settings** → **API**
4. Copia:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Aggiungi in Vercel → **Environment Variables**
6. Seleziona **All Environments** (Production, Preview, Development)
7. Clicca **Save**
8. **Riavvia il deployment** (Vercel → Deployments → Redeploy)

---

### 2. Verifica Tabella geo_locations

La tabella `geo_locations` deve esistere e contenere i comuni italiani.

#### Verifica se la tabella esiste:

1. Vai su **Supabase Dashboard** → **Table Editor**
2. Cerca la tabella `geo_locations`
3. Se **NON esiste**, creala:

#### Crea la tabella:

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri il file `supabase/schema.sql` dal progetto
3. Copia tutto il contenuto
4. Incolla nel SQL Editor di Supabase
5. Clicca **Run** (o premi Ctrl+Enter)
6. Verifica che non ci siano errori

#### Popola la tabella (se vuota):

Se la tabella esiste ma è vuota, popolala con i comuni italiani:

**Opzione 1: Script automatico (locale)**
```bash
# Nel progetto locale
npm run seed:geo
```

**Opzione 2: Manuale (Supabase Dashboard)**
1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Usa lo script di seeding (se disponibile)

---

### 3. Verifica Connessione

Dopo aver configurato le variabili e popolato la tabella:

1. **Riavvia il deployment su Vercel:**
   - Vai su Vercel Dashboard
   - Deployments → Ultimo deployment → **Redeploy**

2. **Testa l'autocomplete:**
   - Vai su https://www.spediresicuro.it
   - Prova a digitare una città (es. "Roma")
   - Dovresti vedere i risultati

---

## 🔍 Debug Avanzato

### Verifica Log Vercel

1. Vai su **Vercel Dashboard** → **Deployments**
2. Clicca sull'ultimo deployment
3. Vai su **Functions** → `/api/geo/search`
4. Controlla i log per errori

### Verifica Supabase

1. Vai su **Supabase Dashboard** → **Logs** → **API Logs**
2. Cerca chiamate a `geo_locations`
3. Verifica eventuali errori

### Test API Diretto

Prova a chiamare l'API direttamente:

```bash
# Sostituisci con il tuo URL
curl "https://www.spediresicuro.it/api/geo/search?q=Roma"
```

Dovresti ricevere una risposta JSON con i risultati.

---

## ⚠️ Errori Comuni

### "Database non configurato correttamente"

**Causa:** Variabili Supabase mancanti in Vercel

**Soluzione:** Aggiungi `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel

### "relation does not exist"

**Causa:** Tabella `geo_locations` non esiste

**Soluzione:** Esegui lo schema SQL in Supabase (vedi punto 2)

### "Errore di connessione al database"

**Causa:** Problema di rete o Supabase non raggiungibile

**Soluzione:** 
- Verifica che il progetto Supabase sia attivo
- Controlla i log Supabase per problemi
- Riprova dopo qualche minuto

---

## ✅ Checklist Risoluzione

- [ ] Variabili Supabase configurate in Vercel
- [ ] Tabella `geo_locations` creata in Supabase
- [ ] Tabella `geo_locations` popolata con comuni italiani
- [ ] Deployment Vercel riavviato
- [ ] Test autocomplete funzionante

---

## 📝 Note

- Le variabili Supabase sono **pubbliche** (NEXT_PUBLIC_*), quindi sicure da esporre
- La tabella `geo_locations` contiene ~8000 comuni italiani
- Il seeding può richiedere 1-2 minuti
- Dopo il seeding, l'autocomplete dovrebbe funzionare immediatamente

---

## 🆘 Se il Problema Persiste

1. Verifica i log Vercel per errori specifici
2. Controlla i log Supabase per problemi di connessione
3. Verifica che il progetto Supabase sia attivo e non sospeso
4. Controlla che le variabili ambiente siano corrette (no spazi, no caratteri speciali)

---

**Ultimo aggiornamento:** Migliorata gestione errori con messaggi più specifici ✅


