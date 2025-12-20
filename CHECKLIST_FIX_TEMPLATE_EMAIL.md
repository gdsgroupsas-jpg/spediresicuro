# ✅ CHECKLIST - Fix Template Email Supabase (P0)

## 🎯 OBIETTIVO

Correggere template email Supabase per usare `{{ .ConfirmationURL }}` invece di `{{ .SiteURL }}`, garantendo che il link email punti a `/auth/callback`.

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

### 3. Verifica Template Attuale

- [ ] Cercato link/bottone "Confirm your signup" nel template
- [ ] Verificato se usa `{{ .SiteURL }}` (❌ ERRATO)
- [ ] Verificato se usa `{{ .ConfirmationURL }}` (✅ CORRETTO)

**Template attuale**:
```
[Incolla qui il codice HTML del link di conferma]
```

---

## 🔧 CHECKLIST FIX

### 4. Correggi Template (se necessario)

- [ ] Sostituito `{{ .SiteURL }}` con `{{ .ConfirmationURL }}`
- [ ] Verificato che NON ci siano link hardcoded
- [ ] Verificato che NON ci siano concatenazioni manuali
- [ ] Salvato modifiche template

**Template dopo correzione**:
```html
<a href="{{ .ConfirmationURL }}">Confirm your signup</a>
```

### 5. Verifica Configurazione Supabase URL

- [ ] Verificato **Site URL**: `https://spediresicuro.vercel.app` (NON `/auth/callback`)
- [ ] Verificato **Redirect URLs** includono:
  - `https://spediresicuro.vercel.app/auth/callback`
  - `https://spediresicuro.vercel.app/auth/callback/**`

---

## 🧪 CHECKLIST TEST POST-FIX

### 6. Test Link Email

- [ ] Signup nuovo utente con email test
- [ ] Email ricevuta entro 5 minuti
- [ ] Tasto destro sul link → copia link
- [ ] Verificato che URL contiene `/auth/callback`
- [ ] ✅ **PASS** o ❌ **FAIL**

**URL copiato dalla email**:
```
[Incolla qui l'URL]
```

### 7. Test Redirect Dopo Click

- [ ] Click link email
- [ ] Verificato URL intermedio: `/auth/callback#access_token=...`
- [ ] Verificato hash viene rimosso dopo processing
- [ ] Verificato redirect a `/dashboard/dati-cliente` (onboarding incompleto)
- [ ] Verificato redirect a `/dashboard` (onboarding completato)
- [ ] Verificato che **NON** atterra mai su "/"
- [ ] ✅ **PASS** o ❌ **FAIL**

**URL intermedio** (dopo click):
```
[Incolla qui l'URL dopo click]
```

**URL finale** (dopo redirect):
```
[Incolla qui l'URL finale]
```

---

## ✅ RISULTATO FINALE

- [ ] **PASS**: Missione C - Step redirect post-confirm
- [ ] **FAIL**: Missione C - Step redirect post-confirm

**Note finali**:
```
[Eventuali note o osservazioni]
```

---

## 📚 DOCUMENTAZIONE RIFERIMENTO

- `FIX_TEMPLATE_EMAIL_SUPABASE_P0.md` - Guida completa fix
- `TEST_LINK_EMAIL.md` - Test dettagliati
- `VERIFICA_TEMPLATE_EMAIL_SUPABASE.md` - Guida template
- `REPORT_FIX_REDIRECT_HOME.md` - Report completo problema

