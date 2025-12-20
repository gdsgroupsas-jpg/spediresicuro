# 🔒 Gate Onboarding - Documentazione Implementazione

## 📋 Punto di Implementazione

**File**: `app/dashboard/layout.tsx` (linee 72-126)

**Motivazione**:
- Layout server component eseguito per tutte le route `/dashboard/*`
- Eseguito PRIMA del render (no flash)
- Server-side (no client-side bypass)
- Deterministico (sempre eseguito)

---

## 🔍 Logica di Controllo

### Step 1: Verifica Autenticazione
```typescript
if (!session && !isTestMode) {
  redirect('/login');
}
```

### Step 2: Ottieni Pathname Corrente
```typescript
const headersList = headers();
const currentPathname = headersList.get('x-pathname') || '';
const isOnOnboardingPage = currentPathname === '/dashboard/dati-cliente';
```

**Nota**: Pathname viene passato dal middleware tramite header `x-pathname` per evitare loop infiniti.

### Step 3: Query Database
```typescript
const user = await findUserByEmail(session.user.email);
```

**Funzione**: `findUserByEmail()` legge da Supabase (`public.users.dati_cliente`)

### Step 4: Verifica Dati Cliente
```typescript
const datiCompletati = user?.datiCliente?.datiCompletati === true;
const hasDatiCliente = !!user?.datiCliente;
```

**Condizione di Incompletezza**:
- `datiCliente` è `NULL` o `undefined` → dati non completati
- `datiCliente.datiCompletati !== true` → dati non completati

### Step 5: Redirect Se Necessario
```typescript
if (!datiCompletati || !hasDatiCliente) {
  if (!isOnOnboardingPage) {
    redirect('/dashboard/dati-cliente');
  }
}
```

**Protezione Loop**: Controlla `isOnOnboardingPage` prima di redirect per evitare loop infiniti.

---

## 🎯 Copertura Scenari

### Scenario 1: Email Confirmation → Auto-login
- **Flusso**: Supabase → `/auth/callback` → `/api/auth/supabase-callback` decide `redirectTo`
- **Gate**: Se `redirectTo = '/dashboard'`, layout controlla → redirect a `/dashboard/dati-cliente`
- **Risultato**: ✅ **COPERTA**

### Scenario 2: Accesso Diretto a `/dashboard`
- **Flusso**: Utente naviga direttamente a `/dashboard`
- **Gate**: Layout controlla dati cliente → redirect a `/dashboard/dati-cliente`
- **Risultato**: ✅ **COPERTA**

### Scenario 3: Accesso Diretto a `/dashboard/*` (qualsiasi route)
- **Flusso**: Utente naviga a `/dashboard/spedizioni`, `/dashboard/fatture`, ecc.
- **Gate**: Layout controlla dati cliente → redirect a `/dashboard/dati-cliente`
- **Risultato**: ✅ **COPERTA**

### Scenario 4: Supabase Redirect a `/` (Home)
- **Flusso**: Se Supabase reindirizza a `/` invece di `/auth/callback`
- **Gate**: Home non è sotto `/dashboard`, quindi layout non viene eseguito
- **Nota**: Utente non è autenticato con NextAuth, quindi non può accedere a `/dashboard` senza login
- **Risultato**: ✅ **SICURO** - Utente deve fare login, poi gate funziona

---

## 🔒 Sicurezza

### Fail-Closed
```typescript
catch (error: any) {
  // Se errore query DB → redirect a dati-cliente (fail-closed)
  if (currentPathname !== '/dashboard/dati-cliente') {
    redirect('/dashboard/dati-cliente');
  }
}
```

**Comportamento**: Se errore query database → assume dati non completati → redirect a onboarding

### Evita Loop Infiniti
```typescript
if (!isOnOnboardingPage) {
  redirect('/dashboard/dati-cliente');
}
```

**Protezione**: Controlla pathname prima di redirect per evitare loop infiniti.

---

## 📊 Struttura Dati

### Tabella: `public.users`
```sql
dati_cliente JSONB
```

### Formato `dati_cliente`:
```typescript
{
  nome: string;
  cognome: string;
  codiceFiscale: string;
  // ... altri campi
  datiCompletati: boolean; // ← Flag critico
  dataCompletamento?: string;
}
```

### Verifica:
- `dati_cliente` è `NULL` → dati non completati
- `dati_cliente.datiCompletati !== true` → dati non completati
- `dati_cliente.datiCompletati === true` → dati completati

---

## ✅ Validazione

### Criteri di Successo:

1. ✅ **Intercetta primo accesso autenticato**: Gate eseguito per tutte le route `/dashboard/*`
2. ✅ **Verifica dati cliente**: Usa `findUserByEmail()` che legge da Supabase
3. ✅ **Redirect forzato se non completi**: Redirect a `/dashboard/dati-cliente`
4. ✅ **Navigazione normale se completi**: Gate permette accesso

### Vincoli Rispettati:

- ✅ **NON modificare Supabase redirect URL**: Non toccato
- ✅ **NON toccare email templates**: Non toccato
- ✅ **NON introdurre nuove feature**: Solo gate esistente
- ✅ **Soluzione pulita, deterministica, production-safe**: Gate server-side, fail-closed

---

## 🎯 Status: IMPLEMENTAZIONE COMPLETA

Il gate è già implementato correttamente e copre tutti i casi richiesti.

**Punto di Implementazione**: `app/dashboard/layout.tsx` (linee 72-126)

**Funzionalità**:
- ✅ Gate server-side
- ✅ Controllo dati cliente da Supabase
- ✅ Redirect automatico se dati non completati
- ✅ Evita loop infiniti
- ✅ Fail-closed

