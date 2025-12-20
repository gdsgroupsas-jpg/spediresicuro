# 📋 OSSERVAZIONI TEST REALI - Cosa Succede (Non Cosa Dovrebbe)

## 🧪 Test Eseguito

**Script**: `scripts/test-onboarding-flow.ts`  
**Utente**: `test-onboarding-1766253012090@spediresicuro.it`  
**Timestamp**: 2025-12-20 17:50:13

---

## 1️⃣ UTENTE NUOVO: Signup → Confirm Email → Redirect

### Cosa Succede Realmente

#### Signup
- ✅ Utente creato in `auth.users` con ID: `a7b1cf49-6009-4f4a-a1f1-0d04b5f48f93`
- ✅ `confirmation_sent_at` = `2025-12-20T17:50:13.20199054Z` (email inviata)
- ✅ `email_confirmed_at` = `NULL` (email non confermata, atteso)
- ⚠️ Record **NON esiste** in `public.users` subito dopo signup

#### Email Confirmation
- **NON TESTATO** (richiede click link email reale)
- **DA VERIFICARE**: Cosa succede quando utente clicca link email

#### Redirect
- **SIMULAZIONE**: Query `public.users` fallisce (record non esiste)
- **RISULTATO**: `redirectTo = '/dashboard/dati-cliente'` ✅
- **VERIFICA NECESSARIA**: Testare redirect reale dopo email confirmation

---

## 2️⃣ VERIFICA DB: auth.users.email_confirmed_at

### Cosa Osservato

```
auth.users:
  - email_confirmed_at: NULL ✅ (email non confermata)
  - confirmation_sent_at: 2025-12-20T17:50:13.20199Z ✅ (email inviata)
  - created_at: 2025-12-20T17:50:13.166371Z
```

**CONCLUSIONE**: Email non confermata (atteso dopo signup)

---

## 3️⃣ VERIFICA DB: public.users.dati_cliente

### Cosa Osservato

```
public.users:
  - Record NON esiste subito dopo signup
  - Query error: "Cannot coerce the result to a single JSON object"
```

**OSSERVAZIONE CRITICA**: 
- Record **NON esiste** subito dopo signup
- Codice `/api/auth/register` (linee 164-198) fa `upsert()` ma test mostra che non esiste
- **POSSIBILI CAUSE**:
  1. Upsert fallisce silenziosamente (errore non bloccante)
  2. Timing: record creato ma query eseguita prima
  3. Errore database non tracciato

**QUANDO VIENE CREATO**:
- Codice `/api/auth/supabase-callback` (linee 77-107) crea record se non esiste
- **QUANDO**: Durante auto-login post conferma email
- **RISULTATO**: Record esiste quando viene valutato redirect (linee 125-134)

**datiCompletati**:
- Quando record esiste → `dati_cliente` = `NULL` (utente nuovo)
- `datiCompletati` = `undefined` (non esiste perché `dati_cliente` è NULL)

---

## 4️⃣ VERIFICA UI: Digitare Testo nei Campi

### Cosa Osservato (Analisi Codice)

**File**: `app/dashboard/dati-cliente/page.tsx`

**Classi input** (dopo fix P0-2):
```tsx
className="... bg-gray-800 !text-white ..."
```

**CSS globale** (`app/globals.css` linee 69-77):
```css
input {
  color: #111827 !important; /* Testo nero */
  -webkit-text-fill-color: #111827 !important;
}
```

**Contrasto**:
- Sfondo: `bg-gray-800` = `#1f2937` (grigio scuro)
- Testo: `!text-white` = `#ffffff` (bianco, con `!important`)
- **ATTESO**: Contrasto ALTO (bianco su grigio scuro)

**VERIFICA NECESSARIA**: 
- Testare in browser reale
- Verificare se `!text-white` sovrascrive CSS globale
- Verificare se testo è effettivamente visibile

---

## 📊 RISULTATI CONFERMATI

### ✅ Cosa Funziona

1. **Signup**: Utente creato correttamente in `auth.users`
2. **Email inviata**: `confirmation_sent_at` valorizzato
3. **Email non confermata**: `email_confirmed_at` = NULL (atteso)
4. **Redirect decisione**: Logica corretta (`/dashboard/dati-cliente` per utenti nuovi)

### ⚠️ Cosa da Verificare

1. **Record public.users**: Quando viene creato esattamente?
   - Codice mostra `upsert()` in `/api/auth/register` ma test mostra che non esiste
   - Codice mostra creazione in `/api/auth/supabase-callback` se non esiste
   - **VERIFICA**: Testare dopo email confirmation reale

2. **Redirect reale**: Funziona dopo email confirmation?
   - Logica corretta in test
   - **VERIFICA**: Testare con email confirmation reale nel browser

3. **UI contrasto**: Testo è visibile nel browser?
   - Classi CSS corrette
   - **VERIFICA**: Testare in browser reale

---

## 🎯 CONCLUSIONI

### Cosa Succede Realmente

1. **Signup** → Utente creato in `auth.users`, email inviata, record `public.users` **NON esiste** subito
2. **Email confirmation** → **NON TESTATO** (richiede click link reale)
3. **Redirect decisione** → Logica corretta: `/dashboard/dati-cliente` per utenti nuovi
4. **UI contrasto** → Classi CSS corrette, verifica browser necessaria

### Cosa NON Assumere

- ❌ NON assumere che record `public.users` esista dopo signup
- ❌ NON assumere che redirect funzioni senza test reale
- ❌ NON assumere che testo sia visibile senza verifica browser

### Cosa Verificare

1. ✅ Testare email confirmation reale (click link email)
2. ✅ Verificare quando record `public.users` viene creato
3. ✅ Verificare redirect effettivo nel browser
4. ✅ Verificare contrasto input nel browser

