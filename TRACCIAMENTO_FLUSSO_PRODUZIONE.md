# 🔍 TRACCIAMENTO FLUSSO REALE - Post Email Confirmation

## 📋 Simulazione Flusso Produzione

### Step 1: Signup
- Utente si registra → `/api/auth/register` → `auth.signUp()` → email inviata
- `confirmation_sent_at` valorizzato
- `email_confirmed_at` = NULL

### Step 2: Email Confirmation
- Utente clicca link email → Supabase reindirizza a `/auth/callback#access_token=...&refresh_token=...&type=signup`

### Step 3: Supabase Auth Callback
**File**: `app/auth/callback/page.tsx`

**Linee 24-50**: Estrae token dal hash
**Linee 55-63**: Imposta sessione Supabase (`supabase.auth.setSession()`)
**Linee 84-106**: Chiama `POST /api/auth/supabase-callback` con token
**Linee 102**: Riceve `{ success, tempToken, redirectTo }` ← **QUI VIENE DECISO IL REDIRECT**

### Step 4: API Supabase Callback (DECISIONE REDIRECT)
**File**: `app/api/auth/supabase-callback/route.ts`

**Linee 125-129**: Query database per `dati_cliente`
```typescript
const { data: userData, error: userDataError } = await supabaseAdmin
  .from('users')
  .select('dati_cliente')
  .eq('email', email)
  .single();
```

**Linee 131-134**: **DECISIONE REDIRECT**
```typescript
let redirectTo = '/dashboard'; // DEFAULT

if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
  redirectTo = '/dashboard/dati-cliente';
}
```

**Linea 142**: Restituisce `redirectTo` al client

### Step 5: NextAuth SignIn
**File**: `app/auth/callback/page.tsx`

**Linee 111-124**: `signIn('credentials', { email, password: tempToken })`
- NextAuth chiama `verifyUserCredentials()` in `lib/database.ts`
- Token temporaneo riconosciuto → sessione NextAuth creata

### Step 6: Redirect Finale
**File**: `app/auth/callback/page.tsx`

**Linea 139**: `router.replace(redirectTo || '/dashboard')`
- Usa `redirectTo` ricevuto da `/api/auth/supabase-callback`
- Se `redirectTo` è `/dashboard` → va a dashboard
- Se `redirectTo` è `/dashboard/dati-cliente` → va a dati-cliente

### Step 7: Middleware
**File**: `middleware.ts`

**Linee 105-137**: Controlla solo autenticazione
- Se sessione presente → `NextResponse.next()` (passa)
- Se sessione assente → redirect a `/login`
- **NON controlla dati cliente**

### Step 8: Layout Dashboard
**File**: `app/dashboard/layout.tsx`

**Linee 25-70**: Controlla solo autenticazione
- Se sessione presente → renderizza layout
- Se sessione assente → redirect a `/login`
- **NON controlla dati cliente**

### Step 9: Pagina Dashboard (se redirectTo = '/dashboard')
**File**: `app/dashboard/page.tsx`

**Linee 179-270**: Controllo dati cliente con **DELAY 1 SECONDO**
```typescript
const timeoutId = setTimeout(async () => {
  async function checkDatiCompletati() {
    const response = await fetch('/api/user/dati-cliente');
    if (data.datiCliente && data.datiCliente.datiCompletati) {
      // NON reindirizza
    } else {
      router.push('/dashboard/dati-cliente'); // ← REDIRECT DOPO 1 SECONDO
    }
  }
  checkDatiCompletati();
}, 1000);
```

**PROBLEMA**: Utente vede dashboard per 1 secondo prima del redirect

### Step 10: Pagina Dati Cliente (se redirectTo = '/dashboard/dati-cliente')
**File**: `app/dashboard/dati-cliente/page.tsx`

**Linee 113-155**: Controlla localStorage PRIMA del database
```typescript
const datiGiàCompletati = localStorage.getItem(`datiCompletati_${session.user.email}`) === 'true';
if (datiGiàCompletati) {
  router.push('/dashboard'); // ← BYPASS SE localStorage PRESENTE
  return;
}
```

**PROBLEMA**: Se localStorage è presente ma dati non completati nel DB, bypassa il form

---

## ❓ RISPOSTE ALLE 4 DOMANDE

### A) Chi decide il redirect dopo email confirmation?

**RISPOSTA**: `/api/auth/supabase-callback/route.ts` (linee 131-134)

**Punto esatto**: 
- File: `app/api/auth/supabase-callback/route.ts`
- Linee: 121-134
- Funzione: `POST /api/auth/supabase-callback`
- Logica: Query `dati_cliente` da database → se NULL o `datiCompletati === false` → `redirectTo = '/dashboard/dati-cliente'`

**Chi usa questa decisione**:
- `app/auth/callback/page.tsx` (linea 102) riceve `redirectTo`
- `app/auth/callback/page.tsx` (linea 139) esegue `router.replace(redirectTo)`

---

### B) Con quale condizione viene mandato a /dashboard invece che /dashboard/dati-cliente?

**RISPOSTA**: Condizione in `/api/auth/supabase-callback/route.ts` (linee 131-134)

**Condizione per `/dashboard`**:
```typescript
if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
  redirectTo = '/dashboard/dati-cliente';
} else {
  redirectTo = '/dashboard'; // ← QUI
}
```

**Condizione esplicita**:
- `userDataError` è `null` (nessun errore query)
- `userData?.dati_cliente` esiste (non è `null` o `undefined`)
- `userData.dati_cliente.datiCompletati === true`

**In altre parole**: Utente va a `/dashboard` SOLO se:
1. Query database ha successo
2. `dati_cliente` esiste nel database
3. `dati_cliente.datiCompletati === true`

**Tutti gli altri casi** → `/dashboard/dati-cliente`:
- Query fallisce (`userDataError` presente)
- `dati_cliente` è `null` o `undefined`
- `dati_cliente.datiCompletati === false`

---

### C) Esiste un controllo "dati obbligatori completati"? Dove?

**RISPOSTA**: Sì, esistono **MULTIPLI controlli** in punti diversi:

#### 1. **Controllo Primario (Post Email Confirmation)**
- **File**: `app/api/auth/supabase-callback/route.ts`
- **Linee**: 125-134
- **Quando**: Durante auto-login post conferma email
- **Cosa controlla**: `dati_cliente.datiCompletati` nel database
- **Azione**: Decide `redirectTo`

#### 2. **Controllo Secondario (Dashboard Page)**
- **File**: `app/dashboard/page.tsx`
- **Linee**: 214-266
- **Quando**: Dopo che utente arriva su `/dashboard` (con delay 1 secondo)
- **Cosa controlla**: `data.datiCliente?.datiCompletati` via API `/api/user/dati-cliente`
- **Azione**: Se non completati → `router.push('/dashboard/dati-cliente')`

#### 3. **Controllo Terziario (Dati Cliente Page)**
- **File**: `app/dashboard/dati-cliente/page.tsx`
- **Linee**: 113-155
- **Quando**: Quando utente arriva su `/dashboard/dati-cliente`
- **Cosa controlla**: 
  - PRIMA: `localStorage.getItem('datiCompletati_${email}')` (linea 117)
  - POI: `data.datiCliente?.datiCompletati` via API (linea 135)
- **Azione**: Se completati → `router.push('/dashboard')`

#### 4. **Controllo Login Page (Login Manuale)**
- **File**: `app/login/page.tsx`
- **Linee**: 220-286
- **Quando**: Dopo login manuale (non post conferma)
- **Cosa controlla**: `userData.datiCliente?.datiCompletati` via API
- **Azione**: Se non completati → `router.push('/dashboard/dati-cliente')`

**NON ESISTE**:
- ❌ Controllo in middleware
- ❌ Controllo in layout dashboard

---

### D) In quale punto viene bypassato?

**RISPOSTA**: Bypass in **3 punti**:

#### 1. **Bypass in `/dashboard/dati-cliente/page.tsx` (localStorage)**
- **File**: `app/dashboard/dati-cliente/page.tsx`
- **Linee**: 116-124
- **Problema**: Controlla `localStorage` PRIMA del database
- **Bypass**: Se `localStorage.getItem('datiCompletati_${email}') === 'true'` → redirect a `/dashboard` SENZA verificare database
- **Impatto**: Utente può bypassare form se localStorage è presente ma dati non completati nel DB

#### 2. **Bypass in `/dashboard/page.tsx` (localStorage + delay)**
- **File**: `app/dashboard/page.tsx`
- **Linee**: 182-190
- **Problema**: Se `localStorage` presente → salta controllo database
- **Bypass**: `if (datiGiàCompletati) { return; }` → non esegue controllo database
- **Impatto**: Utente può vedere dashboard anche se dati non completati (se localStorage presente)

#### 3. **Bypass in `/dashboard/page.tsx` (delay 1 secondo)**
- **File**: `app/dashboard/page.tsx`
- **Linee**: 214-266
- **Problema**: Controllo database con `setTimeout(..., 1000)`
- **Bypass**: Utente vede dashboard per 1 secondo prima del redirect
- **Impatto**: Utente può navigare/interagire con dashboard prima del redirect

#### 4. **Bypass in `/dashboard/page.tsx` (errore API)**
- **File**: `app/dashboard/page.tsx`
- **Linee**: 256-263
- **Problema**: Se API fallisce → NON reindirizza
- **Bypass**: `catch (err) { /* NON reindirizza */ }`
- **Impatto**: Utente rimane su dashboard anche se dati non completati (se API fallisce)

#### 5. **Bypass in `/api/auth/supabase-callback/route.ts` (query fallisce)**
- **File**: `app/api/auth/supabase-callback/route.ts`
- **Linee**: 125-134
- **Problema**: Se query `dati_cliente` fallisce → `redirectTo = '/dashboard/dati-cliente'` (corretto)
- **Ma**: Se query restituisce `dati_cliente = null` ma senza errore → potrebbe essere gestito male
- **Nota**: Dopo fix P0-1, questo è gestito correttamente (`!userData?.dati_cliente`)

---

## 📊 RIEPILOGO FLUSSO

```
1. Email Confirmation Click
   ↓
2. /auth/callback (client)
   ↓
3. POST /api/auth/supabase-callback (server)
   ├─ Query dati_cliente
   ├─ DECISIONE: redirectTo = '/dashboard' o '/dashboard/dati-cliente'
   └─ Restituisce redirectTo
   ↓
4. signIn('credentials') NextAuth
   ↓
5. router.replace(redirectTo)
   ↓
6. Middleware (solo auth check)
   ↓
7. Layout Dashboard (solo auth check)
   ↓
8. Se redirectTo = '/dashboard':
   └─ Dashboard Page (controllo con delay 1s)
      └─ Se dati non completati → router.push('/dashboard/dati-cliente')
   ↓
9. Se redirectTo = '/dashboard/dati-cliente':
   └─ Dati Cliente Page
      ├─ Controlla localStorage (BYPASS se presente)
      └─ Se dati completati → router.push('/dashboard')
```

---

## 🎯 PUNTI CRITICI IDENTIFICATI

1. **Decisione redirect**: `/api/auth/supabase-callback` (CORRETTO dopo fix P0-1)
2. **Bypass localStorage**: `/dashboard/dati-cliente/page.tsx` (linee 116-124)
3. **Delay 1 secondo**: `/dashboard/page.tsx` (linee 214-266)
4. **Nessun guard globale**: Middleware e Layout non controllano dati cliente

