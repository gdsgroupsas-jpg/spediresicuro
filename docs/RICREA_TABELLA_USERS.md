# 🔄 Ricrea Tabella Users da Zero - Guida Completa

## 🎯 Obiettivo

Cancellare la tabella `users` esistente e ricrearla da zero con lo schema corretto, così non c'è confusione con campi mancanti o tipi sbagliati.

## ⚠️ ATTENZIONE

**Questo script ELIMINA tutti gli utenti esistenti!** Dopo aver ricreato la tabella, dovrai ricreare gli utenti demo.

## ✅ Procedura Passo-Passo

### Passo 1: Vai su Supabase Dashboard

1. Apri https://supabase.com/dashboard
2. Seleziona il tuo progetto
3. Vai su **SQL Editor**

### Passo 2: Esegui lo Script SQL

1. Apri il file `scripts/ricrea-tabella-users-completa.sql`
2. **Copia tutto il contenuto** dello script
3. Incollalo in **Supabase Dashboard** → **SQL Editor**
4. Clicca su **Run** (o premi `Ctrl+Enter`)

### Passo 3: Verifica che Funzioni

Dopo aver eseguito lo script, dovresti vedere:
- ✅ Messaggio di conferma nella console
- ✅ Lista di tutti i campi creati
- ✅ Nessun errore

### Passo 4: Ricrea Utenti Demo

Dopo aver ricreato la tabella, devi ricreare gli utenti demo:

#### Opzione A: Manualmente in Supabase

1. Vai su **Table Editor** → **users**
2. Clicca su **Insert row**
3. Crea l'utente admin:
   - `email`: `admin@spediresicuro.it`
   - `password`: `admin123`
   - `name`: `Admin`
   - `role`: `admin`
   - Altri campi: lascia vuoti (si creano automaticamente)
4. Clicca **Save**
5. Ripeti per l'utente demo:
   - `email`: `demo@spediresicuro.it`
   - `password`: `demo123`
   - `name`: `Demo User`
   - `role`: `user`

#### Opzione B: Usa l'Endpoint API (dopo deploy)

Dopo aver fatto un nuovo deploy, puoi usare:
```
POST https://spediresicuro.vercel.app/api/test/create-admin-user
```

## 📋 Schema Tabella Creata

Lo script crea una tabella con questi campi:

### Campi Base
- `id` - UUID (auto-generato)
- `email` - TEXT (UNIQUE, NOT NULL)
- `password` - TEXT (nullable)
- `name` - TEXT (NOT NULL)
- `role` - TEXT (default: 'user')

### Campi OAuth
- `provider` - TEXT (default: 'credentials')
- `provider_id` - TEXT (nullable)
- `image` - TEXT (nullable)

### Campi JSONB (per dati complessi)
- `dati_cliente` - JSONB (per dati cliente completi)
- `default_sender` - JSONB (per mittente predefinito)
- `integrazioni` - JSONB (per integrazioni e-commerce)

### Timestamps
- `created_at` - TIMESTAMPTZ (auto-generato)
- `updated_at` - TIMESTAMPTZ (auto-aggiornato)

## ✅ Vantaggi di Questo Approccio

1. ✅ **Schema pulito** - Nessuna confusione con campi vecchi
2. ✅ **Tutti i campi necessari** - Inclusi dati_cliente, default_sender, integrazioni
3. ✅ **Tipo corretto** - UUID per id, JSONB per dati complessi
4. ✅ **Indici creati** - Per performance
5. ✅ **Trigger automatico** - updated_at si aggiorna automaticamente

## 🔍 Verifica Finale

Dopo aver ricreato la tabella e gli utenti:

1. Vai su `/login`
2. Prova login con `admin@spediresicuro.it` / `admin123`
3. Dovrebbe funzionare! 🎉

4. Vai su `/dashboard/dati-cliente`
5. Compila il form e salva
6. Dovrebbe funzionare senza errori! 🎉

## ❌ Se Qualcosa Va Storto

### Problema: "permission denied"

**Causa:** Non hai i permessi per eliminare la tabella.

**Soluzione:** Verifica di essere loggato come amministratore del progetto Supabase.

### Problema: "relation 'users' does not exist" dopo la creazione

**Causa:** Potrebbe essere un problema di cache.

**Soluzione:** Ricarica la pagina Table Editor o aspetta qualche secondo.

### Problema: Utenti demo non si creano

**Causa:** Potrebbe essere un problema con l'endpoint API.

**Soluzione:** Crea gli utenti manualmente in Supabase Dashboard.

---

**Nota**: Dopo aver ricreato la tabella, fai un nuovo deploy su Vercel per applicare tutte le modifiche al codice!






