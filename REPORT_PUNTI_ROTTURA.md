# 🔍 REPORT PUNTI DI ROTTURA - Flusso Onboarding

## 📋 Test Eseguito

**Data**: 2025-12-20 17:56:06  
**Script**: `scripts/test-complete-onboarding-flow.ts`  
**Utente Test**: `test-flow-1766253365495@spediresicuro.it`

---

## 🔄 FLUSSO STEP-BY-STEP OSSERVATO

### STEP 1: Signup
- ✅ Utente creato in `auth.users`
- ✅ `confirmation_sent_at` valorizzato (email inviata)
- ✅ `email_confirmed_at` = NULL (atteso)
- ❌ Record **NON esiste** in `public.users` subito dopo signup

### STEP 2: Email Confirmation (Simulata)
- ✅ `email_confirmed_at` valorizzato
- ✅ Email confermata correttamente

### STEP 3: /api/auth/supabase-callback (Simulato)
- ✅ Record creato in `public.users` durante callback
- ✅ `dati_cliente` = NULL (atteso per utente nuovo)
- ✅ `datiCompletati` = undefined (atteso)
- ✅ **Redirect decisione: `/dashboard/dati-cliente`** ✅

### STEP 4: Verifica Punti di Rottura
- ✅ Record esiste dopo callback
- ✅ Redirect corretto

---

## ❌ PUNTI DI ROTTURA IDENTIFICATI

### P0-1: Record public.users NON esiste dopo signup

**File**: `app/api/auth/register/route.ts` (linee 164-198)

**Cosa succede**:
- Codice fa `upsert()` in `public.users` subito dopo `auth.signUp()`
- **OSSERVATO**: Record **NON esiste** subito dopo signup
- **CAUSA**: Upsert fallisce silenziosamente (errore non bloccante, linee 189-198)

**Impatto**:
- Se utente accede a `/dashboard` prima di email confirmation → record non esiste
- Controllo in `/dashboard/page.tsx` potrebbe fallire

**Fix necessario**: Verificare perché upsert fallisce o assicurarsi che record esista

---

### P0-2: Bypass localStorage in /dashboard/page.tsx

**File**: `app/dashboard/page.tsx` (linee 182-190)

**Cosa succede**:
```typescript
const datiGiàCompletati = localStorage.getItem(`datiCompletati_${session.user.email}`) === 'true';
if (datiGiàCompletati) {
  return; // ← BYPASS: Non esegue controllo database
}
```

**Problema**:
- Se `localStorage` contiene flag → salta controllo database
- Utente può vedere dashboard anche se dati non completati nel DB

**Impatto**: Utente bypassa onboarding se localStorage è presente

**Fix necessario**: Controllare database PRIMA di localStorage, o rimuovere controllo localStorage

---

### P0-3: Delay 1 secondo in /dashboard/page.tsx

**File**: `app/dashboard/page.tsx` (linee 214-266)

**Cosa succede**:
```typescript
const timeoutId = setTimeout(async () => {
  // Controllo dati cliente
}, 1000); // ← DELAY 1 SECONDO
```

**Problema**:
- Utente vede dashboard per 1 secondo prima del redirect
- Utente può navigare/interagire prima del redirect

**Impatto**: UX degradata, utente può vedere dashboard anche se dati non completati

**Fix necessario**: Spostare controllo in middleware/layout (server-side, no delay)

---

### P0-4: Bypass localStorage in /dashboard/dati-cliente/page.tsx

**File**: `app/dashboard/dati-cliente/page.tsx` (linee 116-124)

**Cosa succede**:
```typescript
const datiGiàCompletati = localStorage.getItem(`datiCompletati_${session.user.email}`) === 'true';
if (datiGiàCompletati) {
  router.push('/dashboard'); // ← BYPASS: Redirect senza verificare database
  return;
}
```

**Problema**:
- Controlla localStorage PRIMA del database
- Se localStorage presente ma dati non completati nel DB → bypassa form

**Impatto**: Utente può bypassare onboarding se localStorage è presente

**Fix necessario**: Controllare database PRIMA di localStorage

---

### P0-5: Bypass errore API in /dashboard/page.tsx

**File**: `app/dashboard/page.tsx` (linee 256-263)

**Cosa succede**:
```typescript
} catch (err) {
  console.error('❌ [DASHBOARD] Errore verifica dati cliente:', err);
  // In caso di errore, NON reindirizzare (potrebbe essere un problema temporaneo)
}
```

**Problema**:
- Se API fallisce → NON reindirizza
- Utente rimane su dashboard anche se dati non completati

**Impatto**: Utente può vedere dashboard anche se API fallisce

**Fix necessario**: Fail-closed: se errore → redirect a dati-cliente

---

### P1-1: UI Input Invisibile (Nero su Nero)

**File**: `app/dashboard/dati-cliente/page.tsx`

**Cosa succede**:
- Classi input: `bg-gray-800 !text-white` (dopo fix P0-2)
- CSS globale: `color: #111827 !important` (testo nero)
- **VERIFICA NECESSARIA**: Testare in browser se `!text-white` sovrascrive CSS globale

**Problema potenziale**:
- Se `!text-white` non sovrascrive → testo nero su sfondo grigio scuro = invisibile

**Fix necessario**: Verificare in browser e fixare se necessario

---

## 🎯 PRIORITÀ FIX

### P0 - CRITICO (Blocca onboarding)

1. **P0-1**: Record public.users non esiste dopo signup
   - **File**: `app/api/auth/register/route.ts`
   - **Fix**: Verificare perché upsert fallisce o assicurarsi che record esista

2. **P0-2**: Bypass localStorage in `/dashboard/page.tsx`
   - **File**: `app/dashboard/page.tsx` (linee 182-190)
   - **Fix**: Controllare database PRIMA di localStorage

3. **P0-3**: Delay 1 secondo in `/dashboard/page.tsx`
   - **File**: `app/dashboard/page.tsx` (linee 214-266)
   - **Fix**: Spostare controllo in middleware/layout (server-side)

4. **P0-4**: Bypass localStorage in `/dashboard/dati-cliente/page.tsx`
   - **File**: `app/dashboard/dati-cliente/page.tsx` (linee 116-124)
   - **Fix**: Controllare database PRIMA di localStorage

5. **P0-5**: Bypass errore API in `/dashboard/page.tsx`
   - **File**: `app/dashboard/page.tsx` (linee 256-263)
   - **Fix**: Fail-closed: se errore → redirect a dati-cliente

### P1 - ALTO (Degrada UX)

6. **P1-1**: UI Input Invisibile
   - **File**: `app/dashboard/dati-cliente/page.tsx`
   - **Fix**: Verificare in browser e fixare contrasto

---

## 📊 STATO ATTUALE

### Cosa Funziona ✅

1. **Redirect decisione**: Logica corretta (`/dashboard/dati-cliente` per utenti nuovi)
2. **Record creazione**: Record creato durante `/api/auth/supabase-callback`
3. **Email confirmation**: Funziona correttamente

### Cosa NON Funziona ❌

1. **Bypass localStorage**: Utente può bypassare onboarding se localStorage presente
2. **Delay 1 secondo**: Utente vede dashboard prima del redirect
3. **Bypass errore API**: Utente rimane su dashboard se API fallisce
4. **UI contrasto**: Da verificare in browser

---

## 🔧 FIX RICHIESTI

### Fix 1: Rimuovere Bypass localStorage

**File**: `app/dashboard/page.tsx` e `app/dashboard/dati-cliente/page.tsx`

**Azione**: Controllare database PRIMA di localStorage, o rimuovere controllo localStorage

### Fix 2: Spostare Controllo in Middleware/Layout

**File**: `middleware.ts` o `app/dashboard/layout.tsx`

**Azione**: Controllo server-side dati cliente (no delay, no bypass)

### Fix 3: Fail-Closed su Errore API

**File**: `app/dashboard/page.tsx`

**Azione**: Se API fallisce → redirect a dati-cliente (fail-closed)

### Fix 4: Verificare UI Contrasto

**File**: `app/dashboard/dati-cliente/page.tsx`

**Azione**: Testare in browser e fixare se necessario

