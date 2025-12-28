# 🔍 ANALISI COMPLETA: Errore PGRST204 `email_verified` durante Creazione Reseller

**Data Analisi**: 2025-01-XX  
**Errore**: `PostgREST PGRST204: Could not find the 'email_verified' column of 'users' in the schema cache`  
**Contesto**: Creazione reseller in produzione tramite Super Admin

---

## 📋 SEZIONE 1: RISULTATI RICERCA OCCORRENZE

### Tabella: Termine → File Path → Riga → Snippet

| Termine | File Path | Riga | Snippet |
|---------|-----------|------|---------|
| `email_verified` | `actions/super-admin.ts` | 540 | `email_verified: true, // Auto-verificato da super admin` |

**Risultato**: ✅ **UNA SOLA OCCORRENZA** nel codebase.

### Dettaglio Occorrenza

```540:540:actions/super-admin.ts
          email_verified: true, // Auto-verificato da super admin
```

**Contesto completo** (insert su `users`):

```530:546:actions/super-admin.ts
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          email: data.email.toLowerCase().trim(),
          name: data.name.trim(),
          password: hashedPassword,
          account_type: 'user', // Inizialmente user
          is_reseller: true, // Ma con flag reseller attivo
          wallet_balance: data.initialCredit || 0,
          email_verified: true, // Auto-verificato da super admin
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .single()
```

---

## 📋 SEZIONE 2: CALL CHAIN CREAZIONE RESELLER

### Flow Diagram Testuale

```
┌─────────────────────────────────────────────────────────────┐
│ 1. UI: Super Admin Dashboard                                │
│    File: app/dashboard/super-admin/_components/              │
│            create-reseller-dialog.tsx                        │
│    Linea: 81-90                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ onSubmit() → createReseller()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Server Action: createReseller()                          │
│    File: actions/super-admin.ts                              │
│    Linea: 463-594                                           │
│                                                              │
│    Steps:                                                    │
│    a) Verifica Super Admin (linea 477)                      │
│    b) Valida input (linea 486-508)                           │
│    c) Verifica email non duplicata (linea 511-522)          │
│    d) Hash password (linea 526-527)                          │
│    e) ⚠️ INSERT su users (linea 530-546) ← ERRORE QUI       │
│    f) Crea transazione wallet se credito > 0 (linea 559-571)│
│    g) Salva note se presenti (linea 574-580)                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ supabaseAdmin.from('users').insert([...])
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Supabase PostgREST API                                   │
│    Tabella: public.users                                    │
│    Operazione: INSERT                                       │
│                                                              │
│    ⚠️ ERRORE: PGRST204                                      │
│    Causa: Campo 'email_verified' non esiste nello schema    │
└─────────────────────────────────────────────────────────────┘
```

### Entry Point UI

```81:90:app/dashboard/super-admin/_components/create-reseller-dialog.tsx
  async function onSubmit(data: CreateResellerInput) {
    startTransition(async () => {
      try {
        const result = await createReseller({
          email: data.email,
          name: data.name,
          password: data.password,
          initialCredit: data.initialCredit,
          notes: data.notes,
        })
```

---

## 📋 SEZIONE 3: PAYLOAD SUPABASE SU `users`

### Analisi Tutti gli Insert/Update su `users`

#### 1. **Creazione Reseller** (`actions/super-admin.ts:530-546`)
**Payload inviato**:
```typescript
{
  email: string,
  name: string,
  password: string (hashed),
  account_type: 'user',
  is_reseller: true,
  wallet_balance: number,
  email_verified: true,  // ⚠️ CAMPO PROBLEMATICO
  created_at: string,
  updated_at: string
}
```
**Stato**: ❌ **ERRORE** - `email_verified` non esiste nello schema

---

#### 2. **Creazione Sub-User** (`actions/admin-reseller.ts:143-157`)
**Payload inviato**:
```typescript
{
  email: string,
  password: string (hashed),
  name: string,
  role: 'user',
  account_type: 'user',
  parent_id: UUID,
  is_reseller: false,
  wallet_balance: 0.00,
  company_name: string | null,
  phone: string | null,
  provider: 'credentials'
}
```
**Stato**: ✅ **OK** - Non usa `email_verified`

---

#### 3. **Registrazione Utente** (`app/api/auth/register/route.ts:178-195`)
**Payload inviato** (upsert):
```typescript
{
  id: UUID,
  email: string,
  password: null,
  name: string,
  role: string,
  account_type: string,
  provider: 'email',
  provider_id: null,
  image: null,
  admin_level: number,
  updated_at: string
}
```
**Stato**: ✅ **OK** - Non usa `email_verified`

---

#### 4. **Supabase Callback** (`app/api/auth/supabase-callback/route.ts:83-94`)
**Payload inviato** (upsert):
```typescript
{
  id: UUID,
  email: string,
  password: null,
  name: string,
  role: string,
  account_type: string,
  provider: 'email',
  provider_id: null,
  image: null,
  admin_level: number
}
```
**Stato**: ✅ **OK** - Non usa `email_verified`

---

#### 5. **createUser Helper** (`lib/database.ts:1112-1124`)
**Payload inviato**:
```typescript
{
  email: string,
  password: string | null,
  name: string,
  role: string,
  account_type: string,
  provider: string,
  provider_id: string | null,
  image: string | null,
  parent_admin_id: UUID | null,
  admin_level: number
}
```
**Stato**: ✅ **OK** - Non usa `email_verified`

---

### Riepilogo Campi Payload

| Campo | Creazione Reseller | Creazione Sub-User | Registrazione | Callback | createUser |
|-------|-------------------|-------------------|---------------|----------|------------|
| `email_verified` | ❌ **SI** | ❌ NO | ❌ NO | ❌ NO | ❌ NO |
| `email` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `name` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `password` | ✅ | ✅ | ❌ (null) | ❌ (null) | ✅ |
| `account_type` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `is_reseller` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `wallet_balance` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `parent_id` | ❌ | ✅ | ❌ | ❌ | ❌ |

**Conclusione**: Solo `createReseller()` invia `email_verified`, tutti gli altri insert/update non lo usano.

---

## 📋 SEZIONE 4: CONFRONTO CON MIGRAZIONI/SCHEMA

### Schema Tabella `users` (da `supabase/migrations/001_complete_schema.sql`)

```85:102:supabase/migrations/001_complete_schema.sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password TEXT, -- Hash bcrypt (vuoto per OAuth)
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  provider auth_provider DEFAULT 'credentials',
  provider_id TEXT, -- ID dal provider OAuth
  image TEXT, -- Avatar URL
  company_name TEXT,
  vat_number TEXT, -- P.IVA
  phone TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);
```

**Risultato**: ❌ **`email_verified` NON ESISTE** nello schema base.

---

### Campi Aggiunti da Migrazioni Successive

Verificati nelle migrazioni:
- `019_reseller_system_and_wallet.sql`: aggiunge `parent_id`, `is_reseller`, `wallet_balance`
- `008_admin_user_system.sql`: aggiunge `account_type`, `parent_admin_id`, `admin_level`
- `006_roles_and_permissions.sql`: aggiunge `last_login_at`

**Risultato**: ❌ **Nessuna migrazione aggiunge `email_verified`**.

---

### Campi Alternativi Esistenti

Il sistema usa **`email_confirmed_at`** che è un campo di **Supabase Auth** (`auth.users`), NON della tabella `public.users`:

```60:66:app/api/auth/supabase-callback/route.ts
    // Verifica che email sia confermata
    if (!supabaseUser.email_confirmed_at) {
      console.error('❌ [SUPABASE CALLBACK] Email non confermata');
      return NextResponse.json(
        { error: 'Email non confermata' },
        { status: 403 }
      );
    }
```

**Nota**: `email_confirmed_at` è gestito da Supabase Auth automaticamente e non è una colonna di `public.users`.

---

### Verifica Schema Completo

Campi presenti in `public.users` (da tutte le migrazioni):
- ✅ `id`, `email`, `password`, `name`, `role`, `provider`, `provider_id`, `image`
- ✅ `company_name`, `vat_number`, `phone`
- ✅ `account_type`, `parent_id`, `parent_admin_id`, `is_reseller`, `admin_level`
- ✅ `wallet_balance`
- ✅ `created_at`, `updated_at`, `last_login_at`
- ❌ **`email_verified` NON ESISTE**

---

## 📋 SEZIONE 5: RACCOMANDAZIONE TECNICA

### Opzione A: Aggiungere Colonna `email_verified` ❌ **NON RACCOMANDATO**

**Motivazione**:
- Il sistema usa già `email_confirmed_at` in Supabase Auth (`auth.users`)
- Aggiungere `email_verified` creerebbe duplicazione di dati
- Non è necessario per il funzionamento del sistema
- Solo 1 punto del codice lo usa (creazione reseller)

**Impatto**:
- ✅ Risolve immediatamente l'errore PGRST204
- ❌ Aggiunge campo non utilizzato dal resto del sistema
- ❌ Potenziale confusione con `email_confirmed_at` di Supabase Auth
- ❌ Manutenzione futura: campo orfano

**Migrazione Necessaria**:
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT false;
```

---

### Opzione B: Rimuovere `email_verified` dal Payload ✅ **RACCOMANDATO**

**Motivazione**:
- Il campo non esiste nello schema e non è necessario
- I reseller creati da Super Admin sono già "verificati" implicitamente (creati da admin)
- Il sistema non usa `email_verified` in nessun altro punto
- Allineamento con tutti gli altri insert/update su `users`

**Impatto**:
- ✅ Risolve immediatamente l'errore PGRST204
- ✅ Allinea il codice con lo schema esistente
- ✅ Nessuna modifica al database necessaria
- ✅ Coerenza con resto del codebase
- ⚠️ Nessun impatto funzionale: il campo non era utilizzato

**Modifica Necessaria**:
```typescript
// actions/super-admin.ts:540
// RIMUOVERE questa riga:
email_verified: true, // Auto-verificato da super admin
```

**Commento Alternativo** (opzionale):
```typescript
// email_verified non necessario: reseller creati da Super Admin
// sono implicitamente verificati. Il sistema usa email_confirmed_at
// di Supabase Auth per verifiche email reali.
```

---

## 🎯 DECISIONE FINALE: **OPZIONE B** (Rimuovere dal Payload)

### Next Steps

1. **Rimuovere `email_verified` da `actions/super-admin.ts:540`**
2. **Testare creazione reseller** in ambiente di sviluppo
3. **Verificare che il reseller venga creato correttamente** senza il campo
4. **Deploy in produzione**

### Rischi

- **Rischio**: ⚠️ **BASSO**
  - Il campo non era utilizzato da nessun'altra parte del sistema
  - Nessuna query SELECT/WHERE usa `email_verified`
  - Nessuna logica di business dipende da questo campo

### Verifica Post-Fix

Dopo la rimozione, verificare:
- ✅ Creazione reseller funziona senza errori
- ✅ Reseller può fare login
- ✅ Reseller può creare Sub-Users
- ✅ Nessun altro punto del codice cerca `email_verified`

---

## 📊 RIEPILOGO TECNICO

| Aspetto | Valore |
|---------|--------|
| **Occorrenze `email_verified`** | 1 (solo in `createReseller`) |
| **Campo esiste in schema?** | ❌ NO |
| **Altri insert usano `email_verified`?** | ❌ NO |
| **Campo alternativo esistente?** | ✅ `email_confirmed_at` (Supabase Auth) |
| **Raccomandazione** | ✅ **Rimuovere dal payload** |
| **Rischio fix** | ⚠️ **BASSO** |
| **Impatto funzionale** | ✅ **NULLO** (campo non utilizzato) |

---

**Firma Analisi**:  
Master Engineer + Debugger Supabase/NextAuth  
Data: 2025-01-XX

