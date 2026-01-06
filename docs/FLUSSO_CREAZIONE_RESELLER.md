# Flusso Creazione Reseller da Super Admin

## 📋 Panoramica

Questo documento descrive il flusso completo per la creazione di un nuovo reseller admin da parte di un Super Admin.

---

## 🎯 Componenti Coinvolti

### 1. **Frontend UI** (`app/dashboard/super-admin/_components/create-reseller-dialog.tsx`)

**Cosa propone l'UI:**

- **Form di creazione reseller** con:
  - **Nome Completo** (obbligatorio, min 2 caratteri)
  - **Email** (obbligatorio, validazione formato)
  - **Password** (obbligatorio, min 8 caratteri)
    - Pulsante "Genera" per password casuale sicura (12 caratteri)
    - Preview password generata
  - **Credito Iniziale** (opzionale, default €100, max €10,000)
    - Quick amounts: €0, €50, €100, €250, €500, €1,000
    - Preview credito totale
  - **Note Interne** (opzionale)

- **Validazione lato client** con Zod schema:
  ```typescript
  {
    email: string (email valida)
    name: string (min 2 caratteri)
    password: string (min 8 caratteri)
    initialCredit: number (0-10000)
    notes: string (opzionale)
  }
  ```

- **Riepilogo automatico** che mostra:
  - ✅ Account reseller attivato automaticamente
  - ✅ Credito wallet disponibile immediatamente
  - ✅ Può creare e gestire propri clienti
  - ✅ Accesso alla dashboard reseller

### 2. **Backend Server Action** (`actions/super-admin.ts` - `createReseller`)

**Flusso di esecuzione:**

1. **Verifica Super Admin**
   - Controlla che l'utente corrente sia `account_type = 'superadmin'`
   - Se non autorizzato → errore

2. **Validazione Input**
   - Email, nome, password obbligatori
   - Validazione formato email (regex)
   - Password minimo 8 caratteri

3. **Verifica Email Esistente**
   - Controlla in `public.users` se email già registrata
   - Controlla in `auth.users` (Supabase Auth) se email già registrata
   - Se esiste → errore

4. **Creazione Utente in Supabase Auth**
   ```typescript
   supabaseAdmin.auth.admin.createUser({
     email: emailLower,
     password: data.password, // Plain text (Supabase la hasha)
     email_confirm: true, // Login immediato senza verifica email
     user_metadata: { name: data.name },
     app_metadata: {
       role: 'user',
       account_type: 'user',
       provider: 'credentials'
     }
   })
   ```
   - Crea identità in `auth.users`
   - Password gestita da Supabase Auth (hash automatico)
   - Email confermata automaticamente

5. **Creazione Record in `public.users`**
   ```typescript
   {
     id: authUserId, // ⚠️ CRITICO: Usa ID di auth come ID
     email: emailLower,
     name: data.name,
     password: null, // Gestita da Supabase Auth
     account_type: 'reseller', // ⚠️ IMPORTANTE: account_type='reseller' (non 'user')
     is_reseller: true, // Flag reseller attivo
     reseller_role: 'admin', // ⚠️ IMPORTANTE: Automaticamente admin
     wallet_balance: data.initialCredit || 0,
     provider: 'credentials',
     created_at: now(),
     updated_at: now()
   }
   ```

6. **Rollback in caso di errore**
   - Se `public.users` fallisce → elimina utente da `auth.users`
   - Mantiene consistenza tra i due sistemi

7. **Creazione Transazione Wallet** (se credito > 0)
   ```typescript
   {
     user_id: userId,
     amount: data.initialCredit,
     type: 'admin_gift',
     description: 'Credito iniziale alla creazione account reseller',
     created_by: superAdminCheck.userId
   }
   ```

8. **Salvataggio Note** (opzionale)
   - Se presenti, salva nel campo `notes` dell'utente

9. **Risultato**
   - Successo: messaggio di conferma
   - Errore: messaggio descrittivo

### 3. **Integrazione Frontend-Backend**

**Flusso UI → Backend:**

1. Utente compila form e clicca "Crea Reseller"
2. Validazione lato client (Zod)
3. Chiamata `createReseller()` server action
4. Loading state durante creazione
5. Toast di successo/errore
6. Refresh tabella utenti (`window.location.reload()`)
7. Reset form

---

## 🔐 Gestione Password

### Password in Supabase Auth

- **Storage**: Password gestita da Supabase Auth in `auth.users`
- **Hash**: Automatico (bcrypt)
- **Update**: Usa `supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })`

### Password in `public.users`

- **Valore**: `null` (password gestita da Supabase Auth)
- **Motivo**: Single source of truth = Supabase Auth

---

## 📊 Risultato Finale

L'utente creato avrà:

- ✅ **Account Type**: `reseller` (non più `user`)
- ✅ **Role**: `user` (base)
- ✅ **Is Reseller**: `true`
- ✅ **Reseller Role**: `admin`
- ✅ **Wallet Balance**: Credito iniziale (se specificato)
- ✅ **Provider**: `credentials`
- ✅ **Email Confermata**: Sì (login immediato)

**Permessi disponibili:**
- Gestire sub-utenti (clienti)
- Gestire wallet sub-utenti
- Configurare integrazioni (solo proprie)
- Creare spedizioni
- Vedere statistiche team

**Limitazioni:**
- Non può vedere tutte le spedizioni della piattaforma
- Non può gestire utenti al di fuori del suo team
- Non può accedere a funzionalità admin/superadmin

---

## 🧪 Test Scenario

Per testare la creazione di un reseller admin:

1. Login come Super Admin
2. Vai a `/dashboard/super-admin`
3. Clicca "Crea Reseller"
4. Compila form:
   - Nome: "Test Reseller"
   - Email: "test-reseller@example.com"
   - Password: "Test1234!"
   - Credito: €100
5. Clicca "Crea Reseller"
6. Verifica:
   - Utente creato in `auth.users`
   - Record creato in `public.users` con `is_reseller=true` e `reseller_role='admin'`
   - Transazione wallet creata (se credito > 0)
   - Login possibile con email/password

---

## 🔍 File Chiave

- **UI**: `app/dashboard/super-admin/_components/create-reseller-dialog.tsx`
- **Backend**: `actions/super-admin.ts` (funzione `createReseller`)
- **Validazione**: Zod schema in `create-reseller-dialog.tsx`
- **Integrazione**: `app/dashboard/super-admin/page.tsx`

---

## ⚠️ Note Importanti

1. **ID Consistency**: L'ID in `public.users` DEVE essere lo stesso di `auth.users.id`
2. **Password**: Non salvare password in `public.users` (gestita da Supabase Auth)
3. **Email**: Sempre lowercase e trimmed
4. **Rollback**: Se `public.users` fallisce, elimina da `auth.users` per consistenza
5. **Reseller Role**: Reseller creati da superadmin sono automaticamente `admin`
