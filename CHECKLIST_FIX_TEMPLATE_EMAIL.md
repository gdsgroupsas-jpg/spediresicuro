# ✅ CHECKLIST - Fix Template Email Supabase (P0) - A PROVA DI CURSOR

## 🎯 OBIETTIVO

Correggere template email Supabase per usare `{{ .ConfirmationURL }}` invece di `{{ .SiteURL }}`, garantendo che il link email punti a `/auth/callback`.

**Criterio PASS/FAIL binario**: Link email contiene `/auth/callback` → PASS, altrimenti FAIL.

---

## 📋 CHECKLIST PRE-FIX

### 1. Verifica Codice (Già Corretto)

- [x] Verificato `app/api/auth/register/route.ts`
- [x] `emailRedirectTo` punta a `${baseUrl}/auth/callback`
- [x] Codice corretto, problema è nel template email

### 2. Accedi a Supabase Dashboard

- [ ] Aperto: https://supabase.com/dashboard
- [ ] Selezionato progetto SpedireSicuro
- [ ] Navigato a: **Authentication** → **Email Templates**
- [ ] Aperto template: **"Confirm signup"**

### 3. Verifica Template Attuale (P0 - CONTROLLO COMPLETO)

- [ ] Cercato link/bottone "Confirm your signup" nel template
- [ ] **P0-1**: Cercato nel template anche `SiteURL` e `RedirectTo` (Ctrl+F / Cmd+F)
- [ ] **P0-2**: Verificato che NON esiste alcuna concatenazione tipo `{{ .SiteURL }}/...`
- [ ] **P0-3**: Verificato che NON ci sono link multipli (bottone + testo) con uno sbagliato
- [ ] Verificato se usa `{{ .SiteURL }}` (❌ ERRATO)
- [ ] Verificato se usa `{{ .ConfirmationURL }}` (✅ CORRETTO)

**Template attuale** (incolla SOLO le righe del link/bottone di conferma):
```
[Incolla qui il codice HTML del link di conferma]
```

**Deve essere esattamente**: `href="{{ .ConfirmationURL }}"`  
**NON devono esistere** altri link basati su `SiteURL`.

---

## 🔧 CHECKLIST FIX

### 4. Correggi Template (se necessario)

- [ ] Sostituito `{{ .SiteURL }}` con `{{ .ConfirmationURL }}`
- [ ] Verificato che NON ci siano link hardcoded
- [ ] Verificato che NON ci siano concatenazioni manuali
- [ ] **P0-4**: Verificato che TUTTI i link di conferma usano `{{ .ConfirmationURL }}` (non solo uno)
- [ ] Salvato modifiche template

**Template dopo correzione**:
```html
<a href="{{ .ConfirmationURL }}">Confirm your signup</a>
```

### 5. Verifica Configurazione Supabase URL (P0 - DOMINIO CANONICO)

- [ ] **P0-5**: Verificato **Site URL**: `https://spediresicuro.vercel.app` (NON `/auth/callback`)
- [ ] **P0-6**: Se `Site URL` contiene `/auth/callback` → **FAIL configurazione**, ripristinare root
- [ ] Verificato **Redirect URLs** includono:
  - `https://spediresicuro.vercel.app/auth/callback`
  - `https://spediresicuro.vercel.app/auth/callback/**`
- [ ] **P0-7**: Durante il test, uso SOLO dominio canonico: `https://spediresicuro.vercel.app`
- [ ] **P0-8**: NON uso preview domain `...projects.vercel.app` per Missione C

---

## 🧪 CHECKLIST TEST POST-FIX

### 6. Test Link Email (P0 - EMAIL NUOVA + VERIFICA PRIMA DEL CLICK)

- [ ] **P0-9**: Ho generato una mail NUOVA dopo aver salvato il template
  - ⚠️ **REGOLA**: Ogni volta che tocchi template/config → **rifai signup** con alias nuovo
  - ⚠️ **KILLER SILENZIOSO**: Le mail vecchie contengono link vecchi → ti ingannano
- [ ] Signup nuovo utente con email test (alias Gmail: `testspediresicuro+missionec77@gmail.com`)
- [ ] Email ricevuta entro 5 minuti
- [ ] **P0-10**: Tasto destro sul link → copia link (PRIMA di cliccare)
- [ ] **P0-11**: Verificato che URL contiene:
  - ✅ `spediresicuro.vercel.app` (dominio canonico)
  - ✅ `/auth/callback` (path corretto)
  - ❌ **NON** contiene `projects.vercel.app` (preview domain)
- [ ] ✅ **PASS** o ❌ **FAIL**

**URL copiato dalla email** (incolla qui):
```
[Incolla qui l'URL copiato PRIMA del click]
```

**Criterio PASS binario**:
- ✅ **PASS**: URL contiene `spediresicuro.vercel.app` E `/auth/callback` E NON contiene `projects.vercel.app`
- ❌ **FAIL**: URL NON contiene `/auth/callback` O contiene `projects.vercel.app`

### 7. Test Redirect Dopo Click (P0 - URL INTERMEDIO OBBLIGATORIO)

- [ ] Click link email
- [ ] **P0-12**: Verificato URL intermedio: `/auth/callback#access_token=...`
  - ⚠️ **CRITICO**: Se dopo click **NON** vedo `/auth/callback#...` anche solo per un istante → **FAIL** (template ancora sbagliato)
- [ ] Verificato hash viene rimosso dopo processing
- [ ] Verificato redirect a `/dashboard/dati-cliente` (onboarding incompleto)
- [ ] Verificato redirect a `/dashboard` (onboarding completato)
- [ ] Verificato che **NON** atterra mai su "/"
- [ ] ✅ **PASS** o ❌ **FAIL**

**URL intermedio** (dopo click, prima del processing):
```
[Incolla qui l'URL dopo click - deve contenere /auth/callback#access_token=...]
```

**URL finale** (dopo redirect):
```
[Incolla qui l'URL finale dopo redirect]
```

---

## ✅ RISULTATO FINALE (BINARIO)

**Output richiesto** (scrivi SOLO una di queste due righe):

- ✅ **PASS**: `link contiene /auth/callback e redirect finale è /dashboard/dati-cliente`
- ❌ **FAIL**: `link = [incolla URL copiato dalla email]`

**Note finali**:
```
[Eventuali note o osservazioni]
```

---

## ⚠️ RISCHI COMUNI (EVITARE FALSI POSITIVI)

1. **Email Stale**: Stai cliccando mail generate **prima** del cambio template → ti sembra "non funziona" ma è un falso FAIL.
   - **Soluzione**: Sempre generare mail NUOVA dopo aver salvato template.

2. **Link Multipli**: La mail contiene 2 link: bottone giusto, testo sbagliato (o viceversa).
   - **Soluzione**: Verificare TUTTI i link nel template (Ctrl+F per `SiteURL`).

3. **Preview Domain**: Stai usando preview domain in qualche punto (anche solo aprendo il link in un tab già "sporco").
   - **Soluzione**: Usare SOLO dominio canonico `https://spediresicuro.vercel.app` per Missione C.

---

## 🔀 OPZIONI TEST (SCEGLI UNA)

### Opzione A (consigliata) — "Test pulito"

- [ ] Togli temporaneamente preview URLs dalla allowlist Supabase
- **Pro**: Zero ambiguità
- **Contro**: Dev/preview più scomodo

### Opzione B — "Test controllato" (RACCOMANDAZIONE ATTUALE)

- [ ] Lasci preview URLs
- [ ] **Obblighi** test solo su dominio canonico + mail nuova
- **Pro**: Non tocchi config
- **Contro**: Più facile sbagliare (attenzione a email stale e preview domain)

---

## 📚 DOCUMENTAZIONE RIFERIMENTO

- `FIX_TEMPLATE_EMAIL_SUPABASE_P0.md` - Guida completa fix
- `TEST_LINK_EMAIL.md` - Test dettagliati
- `VERIFICA_TEMPLATE_EMAIL_SUPABASE.md` - Guida template
- `REPORT_FIX_REDIRECT_HOME.md` - Report completo problema

