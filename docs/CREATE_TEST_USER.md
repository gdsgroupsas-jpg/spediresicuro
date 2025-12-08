# 🧪 Creazione Utente di Test per E2E

Questo documento spiega come creare un utente di test per i test E2E Playwright.

## 📋 Credenziali Utente di Test

- **Email**: `test@example.com`
- **Password**: `testpassword123`

## 🚀 Metodo 1: Script SQL (Consigliato)

### Passo 1: Genera l'hash bcrypt

Esegui questo comando per generare l'hash bcrypt della password:

```bash
node -e "const bc=require('bcryptjs');console.log(bc.hashSync('testpassword123',10))"
```

Copia l'hash generato (es. `$2a$10$...`).

### Passo 2: Esegui lo script SQL

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Apri il file `supabase/migrations/022_create_test_user.sql`
3. **Sostituisci** l'hash placeholder con quello generato al Passo 1
4. Esegui lo script

Oppure usa il file `CREATE_TEST_USER.sql` nella root del progetto (già contiene un hash valido).

## 🚀 Metodo 2: Script Node.js

Se preferisci usare Node.js invece di SQL:

```bash
node scripts/create-test-user-supabase.js
```

**Requisiti:**
- Variabili d'ambiente configurate:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## ✅ Verifica

Dopo aver eseguito lo script, verifica che l'utente sia stato creato:

```sql
SELECT id, email, name, role, created_at 
FROM users 
WHERE email = 'test@example.com';
```

Dovresti vedere l'utente con:
- Email: `test@example.com`
- Name: `Test User E2E`
- Role: `user`

## 🔐 Test Login

Puoi testare il login manualmente:

1. Vai su `http://localhost:3000/login`
2. Inserisci:
   - Email: `test@example.com`
   - Password: `testpassword123`
3. Clicca "Accedi"

Se il login funziona, l'utente è stato creato correttamente! ✅

## ⚠️ IMPORTANTE

- Questo utente è **SOLO per test E2E**
- **NON usare in produzione**
- La password è hardcoded e non sicura
- Considera di eliminare questo utente dopo i test

## 🗑️ Eliminare Utente di Test

Se vuoi eliminare l'utente di test:

```sql
DELETE FROM users WHERE email = 'test@example.com';
```

