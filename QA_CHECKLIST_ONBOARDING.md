# ✅ QA Checklist - Onboarding Missione C

## 🎯 Obiettivo

Verificare che un utente nuovo, non assistito:
1. Sign-up email/password
2. Riceve email conferma
3. Clicca conferma
4. Viene autenticato automaticamente (AUTO-LOGIN)
5. Se dati cliente obbligatori NON completati → viene portato SEMPRE a `/dashboard/dati-cliente` prima di qualsiasi dashboard
6. Nella pagina dati cliente, gli input sono leggibili (no nero su nero), errori chiari, submit OK
7. Dopo submit → accesso dashboard senza loop

---

## 📋 Test Cases

### Test 1: Signup → Email Confirmation → Auto-login → Onboarding

**Steps**:
1. Apri browser in **modalità incognito**
2. Vai a: `https://spediresicuro.vercel.app/login` (o dominio produzione)
3. Clicca "Registrati" o vai direttamente al form signup
4. Compila form:
   - Email: `test-onboarding-{timestamp}@spediresicuro.it`
   - Password: `TestPassword123!` (minimo 8 caratteri)
   - Nome: `Test`
5. Clicca "Registrati"

**Expected Results**:
- ✅ Messaggio: "Ti abbiamo inviato una email di conferma. Devi cliccare il link prima di accedere."
- ✅ **NON** deve promettere accesso immediato
- ✅ Email arriva entro 5 minuti

**PASS/FAIL**: ☐ PASS ☐ FAIL

---

### Test 2: Email Confirmation → Auto-login → Redirect Onboarding

**Steps**:
1. Apri email di conferma
2. Clicca link "Confirm your signup"
3. Osserva redirect automatico

**Expected Results**:
- ✅ URL finale: `https://spediresicuro.vercel.app/dashboard/dati-cliente` (URL pulito, niente token)
- ✅ **NON** deve atterrare su `/dashboard` (home dashboard)
- ✅ Messaggio: "Email confermata ✅ Accesso effettuato" (se presente)
- ✅ Utente è autenticato (sessione presente)

**PASS/FAIL**: ☐ PASS ☐ FAIL

---

### Test 3: Accesso Diretto a Dashboard (Dati Non Completati)

**Steps**:
1. Utente nuovo (dati non completati)
2. Clicca link email conferma → atterra su `/dashboard/dati-cliente`
3. **Manualmente** naviga a: `https://spediresicuro.vercel.app/dashboard`
4. Osserva comportamento

**Expected Results**:
- ✅ **MUST** essere rediretto a `/dashboard/dati-cliente`
- ✅ **NON** deve vedere dashboard home
- ✅ Redirect deve essere **immediato** (no delay, no flash di dashboard)

**PASS/FAIL**: ☐ PASS ☐ FAIL

---

### Test 4: UI Input Visibility - Onboarding Page

**Steps**:
1. Accedi a `/dashboard/dati-cliente`
2. Per ogni campo input:
   - Clicca nel campo
   - Digita testo: `Test123`
   - Verifica che il testo sia **visibile** (bianco su sfondo grigio scuro)

**Fields to Test**:
- ☐ Nome
- ☐ Cognome
- ☐ Codice Fiscale
- ☐ Telefono
- ☐ Indirizzo
- ☐ Città
- ☐ Provincia
- ☐ CAP
- ☐ Altri campi opzionali

**Expected Results**:
- ✅ Testo digitato è **visibile** (contrasto sufficiente)
- ✅ Placeholder è **visibile** (grigio chiaro su sfondo scuro)
- ✅ Caret (cursore) è **visibile**
- ✅ Focus ring è **visibile** (bordo giallo)
- ✅ Error text (se presente) è **visibile**

**PASS/FAIL**: ☐ PASS ☐ FAIL

---

### Test 5: Submit Form → Redirect Dashboard

**Steps**:
1. Compila form onboarding:
   - Nome: `Test`
   - Cognome: `User`
   - Codice Fiscale: `TSTUSR80A01H501X` (16 caratteri)
   - Telefono: `1234567890`
   - Indirizzo: `Via Test 123`
   - Città: `Roma`
   - Provincia: `RM`
   - CAP: `00100`
2. Clicca "Salva" o "Completa Dati"
3. Osserva redirect

**Expected Results**:
- ✅ Form viene salvato correttamente
- ✅ Redirect a `/dashboard` (home dashboard)
- ✅ **NON** deve essere in loop (non torna a `/dashboard/dati-cliente`)
- ✅ Dashboard è accessibile

**PASS/FAIL**: ☐ PASS ☐ FAIL

---

### Test 6: Re-login → Skip Onboarding (Dati Completati)

**Steps**:
1. Utente con dati completati (dopo Test 5)
2. Logout
3. Login con stesso utente
4. Osserva redirect

**Expected Results**:
- ✅ Redirect a `/dashboard` (home dashboard)
- ✅ **NON** deve essere rediretto a `/dashboard/dati-cliente`
- ✅ Onboarding è **saltato** (dati già completati)

**PASS/FAIL**: ☐ PASS ☐ FAIL

---

## 🔍 Verifiche Aggiuntive

### Verifica Database

**Query Supabase** (opzionale, per debug):
```sql
-- Verifica utente dopo signup
SELECT 
  email,
  email_confirmed_at,
  confirmation_sent_at
FROM auth.users
WHERE email = 'test-onboarding-{timestamp}@spediresicuro.it';

-- Verifica dati_cliente dopo signup
SELECT 
  email,
  dati_cliente,
  dati_cliente->>'datiCompletati' as dati_completati
FROM public.users
WHERE email = 'test-onboarding-{timestamp}@spediresicuro.it';
```

**Expected Results**:
- ✅ `email_confirmed_at` = NULL dopo signup
- ✅ `confirmation_sent_at` = timestamp dopo signup
- ✅ `email_confirmed_at` = timestamp dopo click email
- ✅ `dati_cliente` = NULL o `datiCompletati = false` dopo signup
- ✅ `dati_cliente.datiCompletati = true` dopo submit form

---

## 📊 Risultati Finali

**Test 1**: ☐ PASS ☐ FAIL  
**Test 2**: ☐ PASS ☐ FAIL  
**Test 3**: ☐ PASS ☐ FAIL  
**Test 4**: ☐ PASS ☐ FAIL  
**Test 5**: ☐ PASS ☐ FAIL  
**Test 6**: ☐ PASS ☐ FAIL  

**Overall**: ☐ PASS ☐ FAIL

**Note**:
- Se anche un solo test fallisce → **FAIL**
- Tutti i test devono passare → **PASS**

---

## 🐛 Bug Report (se FAIL)

**Test Fallito**: _______________

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: 

**Actual**: 

**Screenshots**: (se disponibili)

**Browser**: Chrome / Firefox / Safari / Edge  
**OS**: Windows / macOS / Linux  
**URL**: 

