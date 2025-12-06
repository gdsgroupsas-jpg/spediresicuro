# 🔍 Guida Verifica Sistema Reseller e Wallet

Questo documento spiega come verificare che il sistema Reseller e Wallet sia configurato correttamente in Supabase.

## 📋 Cosa Verifica lo Script

Lo script `verify-supabase-reseller-wallet.ts` controlla:

1. **Tabella Users** - Campi aggiunti:
   - `parent_id` (UUID) - Collegamento Sub-User all'Admin
   - `is_reseller` (BOOLEAN) - Flag Reseller
   - `wallet_balance` (DECIMAL) - Saldo wallet

2. **Tabella wallet_transactions** - Struttura completa:
   - Tutti i campi necessari
   - Indici per performance
   - RLS policies

3. **Funzioni SQL**:
   - `is_super_admin()` - Verifica Super Admin
   - `is_reseller()` - Verifica Reseller
   - `is_sub_user_of()` - Verifica Sub-User
   - `add_wallet_credit()` - Aggiunge credito
   - `deduct_wallet_credit()` - Scala credito
   - `update_wallet_balance()` - Trigger function

4. **Trigger**:
   - `trigger_update_wallet_balance` - Aggiorna automaticamente wallet_balance

5. **RLS Policies**:
   - Policy per `users` (Super Admin vede tutto, Reseller vede Sub-Users)
   - Policy per `shipments` (Reseller vede spedizioni Sub-Users)
   - Policy per `wallet_transactions` (tracciamento transazioni)

6. **Test Operazioni**:
   - Test creazione transazione wallet
   - Test aggiornamento balance automatico

## 🚀 Come Eseguire la Verifica

### Opzione 1: Script PowerShell (Windows - Consigliato)

```powershell
.\verifica-reseller-wallet.ps1
```

Lo script PowerShell:
- ✅ Verifica Node.js e npm
- ✅ Controlla variabili d'ambiente
- ✅ Esegue la verifica completa
- ✅ Mostra risultati colorati

### Opzione 2: npm Script

```bash
npm run verify:reseller-wallet
```

### Opzione 3: Diretto con ts-node

```bash
npx ts-node --project tsconfig.scripts.json scripts/verify-supabase-reseller-wallet.ts
```

## 📝 Prerequisiti

1. **Variabili d'Ambiente** (in `.env.local`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
   ```

2. **Migration Eseguita**:
   - La migration `019_reseller_system_and_wallet.sql` deve essere stata eseguita
   - Verifica in Supabase Dashboard → Database → Migrations

3. **Dipendenze Installate**:
   ```bash
   npm install
   ```

## ✅ Risultati Attesi

Se tutto è configurato correttamente, vedrai:

```
✅ Campo users.parent_id: Esiste (UUID)
✅ Campo users.is_reseller: Esiste (BOOLEAN)
✅ Campo users.wallet_balance: Esiste (DECIMAL)
✅ Tabella wallet_transactions: Esiste
✅ Funzione is_super_admin: Esiste
✅ Funzione is_reseller: Esiste
✅ Funzione add_wallet_credit: Esiste
✅ Funzione deduct_wallet_credit: Esiste
✅ Test add_wallet_credit: Transazione creata
✅ Test trigger wallet_balance: Balance aggiornato correttamente

🎉 TUTTO OK! Il sistema Reseller e Wallet è configurato correttamente.
```

## ❌ Se Ci Sono Errori

### Errore: "Campo parent_id MANCANTE"

**Soluzione**: Esegui la migration:
```sql
-- In Supabase SQL Editor o tramite CLI
\i supabase/migrations/019_reseller_system_and_wallet.sql
```

### Errore: "Tabella wallet_transactions MANCANTE"

**Soluzione**: La migration non è stata eseguita. Esegui:
1. Vai su Supabase Dashboard
2. Database → SQL Editor
3. Copia e incolla il contenuto di `supabase/migrations/019_reseller_system_and_wallet.sql`
4. Esegui

### Errore: "Funzione add_wallet_credit non esiste"

**Soluzione**: La migration è stata eseguita parzialmente. Esegui di nuovo la migration completa.

### Errore: "Variabili d'ambiente mancanti"

**Soluzione**: 
1. Crea/aggiorna `.env.local`
2. Aggiungi le variabili Supabase necessarie
3. Riavvia il server di sviluppo se necessario

## 🔧 Risoluzione Problemi

### Verifica Manuale in Supabase

1. **Controlla Tabelle**:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'users' 
   AND column_name IN ('parent_id', 'is_reseller', 'wallet_balance');
   ```

2. **Controlla Funzioni**:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN ('is_super_admin', 'is_reseller', 'add_wallet_credit', 'deduct_wallet_credit');
   ```

3. **Controlla Trigger**:
   ```sql
   SELECT trigger_name, event_object_table 
   FROM information_schema.triggers 
   WHERE trigger_name = 'trigger_update_wallet_balance';
   ```

### Test Manuale Funzioni

```sql
-- Test is_super_admin
SELECT is_super_admin('00000000-0000-0000-0000-000000000000'::uuid);

-- Test is_reseller
SELECT is_reseller('00000000-0000-0000-0000-000000000000'::uuid);

-- Test add_wallet_credit (sostituisci con un ID utente reale)
SELECT add_wallet_credit(
  'user-id-qui'::uuid,
  10.00,
  'Test manuale',
  NULL
);
```

## 📚 Documentazione Correlata

- Migration: `supabase/migrations/019_reseller_system_and_wallet.sql`
- Server Actions: `actions/admin-reseller.ts`, `actions/super-admin.ts`
- Dashboard: `app/dashboard/reseller-team/`, `app/dashboard/super-admin/`

## 💡 Note

- Lo script crea una transazione di test (0.01€) per verificare che tutto funzioni
- La transazione di test può essere lasciata o rimossa manualmente
- Lo script usa `supabaseAdmin` (service_role) per bypassare RLS durante la verifica
- In produzione, assicurati che le RLS policies siano attive e funzionanti

## 🆘 Supporto

Se hai problemi:
1. Controlla i log di Supabase Dashboard
2. Verifica che la migration sia stata eseguita completamente
3. Controlla le variabili d'ambiente
4. Esegui lo script di verifica per vedere errori dettagliati
