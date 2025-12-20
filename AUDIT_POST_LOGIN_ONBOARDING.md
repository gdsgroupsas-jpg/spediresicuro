# 🔍 AUDIT COMPLETO - Flusso Post-Primo Accesso (Email Confirmed → Login → Redirect)

## 📋 Obiettivo Audit

Un utente nuovo, appena confermata l'email, DEVE:
1. Essere autenticato ✅
2. Essere rediretto SEMPRE alla pagina di completamento dati se i dati obbligatori non sono presenti ❌
3. Vedere correttamente ciò che digita nei campi (UI leggibile) ❌

---

## 🔄 Sequenza Reale degli Step Post-Login (Numerata)

### Flusso Post-Conferma Email (Auto-login)

1. **Utente clicca link conferma email** → Supabase reindirizza a `/auth/callback#access_token=...&refresh_token=...&type=signup`

2. **`/auth/callback/page.tsx` (linee 40-63)**:
   - Estrae `access_token` e `refresh_token` dal hash
   - Imposta sessione Supabase: `supabase.auth.setSession({ access_token, refresh_token })`
   - Ottiene `userEmail` dalla sessione Supabase

3. **`/auth/callback/page.tsx` (linee 84-106)**:
   - Chiama `POST /api/auth/supabase-callback` con token Supabase
   - Riceve `{ success, tempToken, redirectTo }`

4. **`/api/auth/supabase-callback/route.ts` (linee 124-133)**:
   - ⚠️ **PROBLEMA P0**: Controlla `dati_cliente.datiCompletati`:
     ```typescript
     const { data: userData, error: userDataError } = await supabaseAdmin
       .from('users')
       .select('dati_cliente')
       .eq('email', email)
       .single();
     
     if (!userDataError && userData?.dati_cliente && !userData.dati_cliente.datiCompletati) {
       redirectTo = '/dashboard/dati-cliente';
     }
     ```
   - **BUG**: Se `dati_cliente` è `null` o non esiste (utente nuovo), la condizione fallisce e `redirectTo` rimane `/dashboard`
   - **RISULTATO**: Utente nuovo viene rediretto a `/dashboard` invece di `/dashboard/dati-cliente`

5. **`/auth/callback/page.tsx` (linee 111-124)**:
   - Usa `tempToken` per `signIn('credentials')` NextAuth
   - Auto-login completato

6. **`/auth/callback/page.tsx` (linee 137-139)**:
   - Redirect a `redirectTo` (che è `/dashboard` invece di `/dashboard/dati-cliente` per utenti nuovi)

7. **`/dashboard/page.tsx` (linee 214-266)**:
   - ⚠️ **PROBLEMA P1**: Controllo dati cliente con **delay 1 secondo**:
     ```typescript
     const timeoutId = setTimeout(async () => {
       async function checkDatiCompletati() {
         // ... chiama API e controlla dati
         if (!data.datiCliente || !data.datiCliente.datiCompletati) {
           router.push('/dashboard/dati-cliente');
         }
       }
       checkDatiCompletati();
     }, 1000);
     ```
   - **PROBLEMA**: Utente vede dashboard per 1 secondo prima del redirect
   - **PROBLEMA**: Se API fallisce, utente rimane su dashboard

8. **`/dashboard/dati-cliente/page.tsx` (linee 113-155)**:
   - ⚠️ **PROBLEMA P1**: Controlla localStorage PRIMA del database:
     ```typescript
     const datiGiàCompletati = localStorage.getItem(`datiCompletati_${session.user.email}`) === 'true';
     if (datiGiàCompletati) {
       router.push('/dashboard');
       return;
     }
     ```
   - **PROBLEMA**: Se localStorage è vuoto ma dati sono completati nel DB, carica form invece di redirect

---

## ❌ Elenco FAIL con Severità

### P0 - CRITICO (Blocca onboarding)

1. **`/api/auth/supabase-callback/route.ts` (linee 124-133)**: 
   - **BUG**: Controllo `dati_cliente.datiCompletati` fallisce per utenti nuovi (dati_cliente è `null`)
   - **IMPATTO**: Utente nuovo viene rediretto a `/dashboard` invece di `/dashboard/dati-cliente`
   - **FIX**: Controllare se `dati_cliente` è `null` o `datiCompletati` è `false`

2. **UI Input Invisibile (P0)**:
   - **BUG**: Input hanno `text-white` ma CSS globale forza `color: #111827 !important` (grigio scuro/nero)
   - **CAUSA**: `app/globals.css` (linee 69-77) sovrascrive `text-white` con `color: #111827 !important`
   - **RISULTATO**: Testo nero (`#111827`) su sfondo nero (`bg-[#0f0f11]`) = **INVISIBILE**
   - **IMPATTO**: Utente non può vedere cosa digita
   - **FIX**: Cambiare `bg-[#0f0f11]` in `bg-gray-800` o `bg-slate-800` (più chiaro) OPPURE aggiungere `!text-white` per sovrascrivere CSS globale

### P1 - ALTO (Degrada UX)

3. **`/dashboard/page.tsx` (linee 214-266)**:
   - **PROBLEMA**: Controllo dati cliente con delay 1 secondo
   - **IMPATTO**: Utente vede dashboard per 1 secondo prima del redirect
   - **FIX**: Spostare controllo in middleware o layout (server-side)

4. **`/dashboard/dati-cliente/page.tsx` (linee 113-155)**:
   - **PROBLEMA**: Controlla localStorage prima del database
   - **IMPATTO**: Se localStorage è vuoto ma dati sono completati, mostra form invece di redirect
   - **FIX**: Controllare database PRIMA di localStorage

5. **Nessun Guard Globale**:
   - **PROBLEMA**: Middleware non controlla dati cliente
   - **IMPATTO**: Utente può accedere a `/dashboard` anche se dati non completati
   - **FIX**: Aggiungere controllo in middleware o layout dashboard

---

## 🎯 Punto Unico per Implementare Regola: "Se Dati Cliente Mancanti → Redirect Obbligatorio"

### Opzione A: Middleware (CONSIGLIATO)

**File**: `middleware.ts`

**Posizione**: Dopo controllo autenticazione (linea ~137)

**Implementazione**:
```typescript
// Dopo controllo autenticazione
if (requiresAuth && session) {
  // ⚠️ ONBOARDING GUARD: Verifica dati cliente completati
  if (pathname.startsWith('/dashboard') && pathname !== '/dashboard/dati-cliente') {
    // Chiama API per verificare dati cliente (server-side)
    const user = await findUserByEmail(session.user.email);
    if (!user?.datiCliente?.datiCompletati) {
      const redirectUrl = new URL('/dashboard/dati-cliente', request.url);
      redirectUrl.searchParams.set('redirect', pathname); // Salva pagina originale
      return NextResponse.redirect(redirectUrl);
    }
  }
}
```

**Vantaggi**:
- ✅ Controllo server-side (no delay)
- ✅ Applicato a tutte le route `/dashboard/**`
- ✅ Fail-closed (se errore, redirect a dati-cliente)

**Svantaggi**:
- ⚠️ Richiede chiamata database in middleware (può essere lento)
- ⚠️ Middleware deve essere async

### Opzione B: Layout Dashboard (ALTERNATIVA)

**File**: `app/dashboard/layout.tsx` (se esiste) o creare nuovo

**Implementazione**:
```typescript
export default async function DashboardLayout({ children }) {
  const session = await auth();
  if (!session) redirect('/login');
  
  const user = await findUserByEmail(session.user.email);
  if (!user?.datiCliente?.datiCompletati) {
    redirect('/dashboard/dati-cliente');
  }
  
  return <>{children}</>;
}
```

**Vantaggi**:
- ✅ Controllo server-side
- ✅ Applicato a tutte le route dashboard
- ✅ Più semplice del middleware

**Svantaggi**:
- ⚠️ Richiede creazione/modifica layout

### Opzione C: Fix `/api/auth/supabase-callback` (MINIMO)

**File**: `app/api/auth/supabase-callback/route.ts` (linee 124-133)

**Fix**:
```typescript
// Determina redirect (dashboard o dati-cliente se onboarding necessario)
let redirectTo = '/dashboard';

// Verifica dati cliente per determinare redirect
const { data: userData, error: userDataError } = await supabaseAdmin
  .from('users')
  .select('dati_cliente')
  .eq('email', email)
  .single();

// ⚠️ FIX: Controlla se dati_cliente è null o datiCompletati è false
if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
  redirectTo = '/dashboard/dati-cliente';
}
```

**Vantaggi**:
- ✅ Fix minimo (solo 1 file)
- ✅ Risolve problema per auto-login post conferma

**Svantaggi**:
- ⚠️ Non risolve problema per login manuale
- ⚠️ Non risolve problema per accesso diretto a `/dashboard`

---

## 🎨 Fix UI Minimo - Input Leggibili

### Problema Identificato

**File**: `app/dashboard/dati-cliente/page.tsx`

**Input attuale** (linee 438, 451, 465, etc.):
```tsx
className="w-full px-4 py-2.5 bg-[#0f0f11] border-2 border-[#FACC15]/40 rounded-lg text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
```

**Analisi**:
- `bg-[#0f0f11]` = sfondo molto scuro (quasi nero)
- `text-white` = testo bianco
- **PROBLEMA**: Se c'è un CSS globale che sovrascrive `text-white` o il contrasto non è sufficiente, il testo potrebbe essere invisibile

### Fix Minimo

**Opzione 1: Forzare contrasto con `!important` (NON CONSIGLIATO)**
```tsx
className="... text-white !text-white ..."
```

**Opzione 2: Usare colore più chiaro per sfondo (CONSIGLIATO)**
```tsx
className="... bg-gray-900 text-white ..." // bg-gray-900 è più chiaro di #0f0f11
```

**Opzione 3: Aggiungere contrasto esplicito (CONSIGLIATO)**
```tsx
className="... bg-[#0f0f11] text-white [color-scheme:dark] ..."
```

**Fix Consigliato** (minimo, solo per input in `app/dashboard/dati-cliente/page.tsx`):

**Opzione 1: Cambiare sfondo (CONSIGLIATO - più semplice)**:
```tsx
// Sostituire bg-[#0f0f11] con bg-gray-800 o bg-slate-800 (più chiaro)
className="w-full px-4 py-2.5 bg-gray-800 border-2 border-[#FACC15]/40 rounded-lg text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
```

**Opzione 2: Forzare text-white con !important (se si vuole mantenere bg-[#0f0f11])**:
```tsx
className="w-full px-4 py-2.5 bg-[#0f0f11] border-2 border-[#FACC15]/40 rounded-lg !text-white font-medium placeholder-gray-500 focus:outline-none focus:border-[#FACC15] focus:ring-2 focus:ring-[#FACC15]/50 focus:shadow-lg glow-on-focus transition-all"
```

**NOTA**: Il CSS globale in `app/globals.css` (linee 69-77) forza `color: #111827 !important` su tutti gli input. Per sovrascriverlo, serve `!text-white` OPPURE cambiare lo sfondo in un colore più chiaro.

---

## 📝 Riepilogo Fix Richiesti

### P0 - CRITICO (Implementare SUBITO)

1. **Fix `/api/auth/supabase-callback/route.ts`**:
   - Cambiare controllo `dati_cliente.datiCompletati` per gestire `null`
   - Se `dati_cliente` è `null` o `datiCompletati` è `false` → `redirectTo = '/dashboard/dati-cliente'`

2. **Fix UI Input**:
   - Cambiare `bg-[#0f0f11]` in `bg-gray-900` o aggiungere contrasto esplicito
   - Verificare che `text-white` sia applicato correttamente

### P1 - ALTO (Implementare dopo P0)

3. **Aggiungere Guard Globale**:
   - Opzione A: Middleware (consigliato)
   - Opzione B: Layout Dashboard
   - Opzione C: Fix minimo in `/api/auth/supabase-callback` (già incluso in P0)

4. **Fix `/dashboard/dati-cliente/page.tsx`**:
   - Controllare database PRIMA di localStorage
   - Se dati completati nel DB ma localStorage vuoto → redirect a dashboard

5. **Rimuovere delay in `/dashboard/page.tsx`**:
   - Spostare controllo in middleware/layout (server-side)
   - Eliminare delay 1 secondo

---

## ✅ Criteri Pass/Fail

**PASS se**:
- ✅ Utente nuovo (dati_cliente null) viene rediretto a `/dashboard/dati-cliente` dopo auto-login
- ✅ Utente può vedere testo negli input (contrasto sufficiente)
- ✅ Utente non può accedere a `/dashboard` se dati non completati (guard globale)
- ✅ Nessun delay visibile prima del redirect

**FAIL se**:
- ❌ Utente nuovo viene rediretto a `/dashboard` invece di `/dashboard/dati-cliente`
- ❌ Testo input è invisibile (nero su nero)
- ❌ Utente può accedere a `/dashboard` senza completare dati
- ❌ Delay visibile prima del redirect

