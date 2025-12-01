# 📥 Importa Utenti Demo in Supabase

## 🎯 Obiettivo

Importare gli utenti demo nella tabella `users` appena creata.

## ✅ Metodo 1: Usa lo Script SQL (CONSIGLIATO)

### Passo 1: Vai su Supabase Dashboard

1. Apri https://supabase.com/dashboard
2. Seleziona il tuo progetto
3. Vai su **SQL Editor**

### Passo 2: Esegui lo Script SQL

1. Apri il file `scripts/inserisci-utenti-demo.sql`
2. **Copia tutto il contenuto** dello script
3. Incollalo in **Supabase Dashboard** → **SQL Editor**
4. Clicca su **Run** (o premi `Ctrl+Enter`)

### Passo 3: Verifica

Dovresti vedere:
- ✅ Lista degli utenti creati
- ✅ Messaggio di conferma
- ✅ Nessun errore

## ✅ Metodo 2: Import CSV

### Passo 1: Prepara il CSV

Ho creato il file `scripts/utenti-demo.csv` con gli utenti demo.

### Passo 2: Importa in Supabase

1. Vai su **Supabase Dashboard** → **Table Editor** → **users**
2. Clicca su **Import data** (o **Importa dati**)
3. Seleziona il file `scripts/utenti-demo.csv`
4. Mappa le colonne:
   - `email` → `email`
   - `password` → `password`
   - `name` → `name`
   - `role` → `role`
   - `provider` → `provider`
   - `created_at` → `created_at`
   - `updated_at` → `updated_at`
5. Clicca su **Import**

### ⚠️ Nota Importante

Se hai abilitato **RLS (Row Level Security)**, potresti avere problemi con l'import. In quel caso:

1. **Disabilita temporaneamente RLS** per l'import:
   ```sql
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ```
2. Importa gli utenti
3. **Riabilita RLS** dopo l'import:
   ```sql
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ```

Oppure usa lo **script SQL** (Metodo 1) che bypassa RLS usando la Service Role Key.

## ✅ Metodo 3: Inserimento Manuale

Se preferisci inserire manualmente:

### Utente Admin

1. Vai su **Table Editor** → **users**
2. Clicca su **Insert row**
3. Compila:
   - `email`: `admin@spediresicuro.it`
   - `password`: `admin123`
   - `name`: `Admin`
   - `role`: `admin`
   - `provider`: `credentials`
   - Altri campi: lascia vuoti (si creano automaticamente)
4. Clicca **Save**

### Utente Demo

1. Clicca di nuovo su **Insert row**
2. Compila:
   - `email`: `demo@spediresicuro.it`
   - `password`: `demo123`
   - `name`: `Demo User`
   - `role`: `user`
   - `provider`: `credentials`
3. Clicca **Save**

## 🔒 Gestione RLS (Row Level Security)

Se hai abilitato RLS sulla tabella `users`, hai due opzioni:

### Opzione 1: Usa lo Script SQL (Raccomandato)

Lo script SQL `scripts/inserisci-utenti-demo-con-rls.sql` usa la Service Role che bypassa automaticamente RLS, quindi funziona anche con RLS abilitato.

### Opzione 2: Disabilita Temporaneamente RLS

Se preferisci usare l'import CSV:

1. **Disabilita temporaneamente RLS:**
   ```sql
   ALTER TABLE users DISABLE ROW LEVEL SECURITY;
   ```

2. **Importa gli utenti** (CSV o manualmente)

3. **Riabilita RLS:**
   ```sql
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ```

4. **Crea policy per permettere l'accesso:**
   ```sql
   -- Policy per permettere agli utenti di vedere/modificare i propri dati
   CREATE POLICY "Utenti vedono solo i propri dati"
   ON users
   FOR ALL
   TO authenticated
   USING (auth.email() = email)
   WITH CHECK (auth.email() = email);
   ```

**Nota**: La Service Role Key (usata dal codice) bypassa automaticamente RLS, quindi le operazioni server-side funzioneranno sempre.

## ✅ Verifica Finale

Dopo aver importato gli utenti:

1. Vai su `/login`
2. Prova login con:
   - Email: `admin@spediresicuro.it`
   - Password: `admin123`
3. Dovrebbe funzionare! 🎉

## 📋 Checklist

Prima di considerare il problema risolto:

- [ ] Tabella `users` creata con schema corretto
- [ ] Utente `admin@spediresicuro.it` esiste
- [ ] Utente `demo@spediresicuro.it` esiste
- [ ] Login funziona con entrambi gli utenti
- [ ] Salvataggio dati cliente funziona

---

**Nota**: Lo script SQL (Metodo 1) è il metodo più semplice e sicuro, soprattutto se hai RLS abilitato!

