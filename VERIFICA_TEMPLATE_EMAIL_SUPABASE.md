# 📧 VERIFICA TEMPLATE EMAIL SUPABASE

## 🔴 PROBLEMA CRITICO

Se il template email Supabase "Confirm signup" non usa `{{ .ConfirmationURL }}`, il link di conferma potrebbe puntare a "/" invece che a "/auth/callback".

---

## ✅ CONFIGURAZIONE CORRETTA

### Template Email "Confirm signup"

**Link di conferma DEVE usare**:
```
{{ .ConfirmationURL }}
```

**NON deve usare**:
```
{{ .SiteURL }}/auth/callback
{{ .SiteURL }}
```

**Esempio template corretto**:
```html
<a href="{{ .ConfirmationURL }}">Confirm your signup</a>
```

**Esempio template ERRATO**:
```html
<a href="{{ .SiteURL }}/auth/callback">Confirm your signup</a>
```

---

## 🔍 COME VERIFICARE

### 1. Supabase Dashboard

1. Vai a: https://supabase.com/dashboard/project/[PROJECT_ID]/auth/templates
2. Apri template "Confirm signup"
3. Cerca il link di conferma nel template
4. Verifica che usi `{{ .ConfirmationURL }}`

### 2. Test Email

1. Fai signup con email test
2. Apri email ricevuta
3. **VERIFICA LINK**: Deve contenere `/auth/callback` (non "/")
4. Esempio link corretto:
   ```
   https://spediresicuro.vercel.app/auth/callback?token=...&type=signup
   ```
5. Esempio link ERRATO:
   ```
   https://spediresicuro.vercel.app?token=...&type=signup
   ```

---

## 🔧 COME CORREGGERE

### Se Template Usa `{{ .SiteURL }}`

1. Vai a Supabase Dashboard → Authentication → Email Templates
2. Apri template "Confirm signup"
3. Trova il link di conferma
4. Sostituisci:
   ```html
   <!-- PRIMA (ERRATO) -->
   <a href="{{ .SiteURL }}/auth/callback">Confirm your signup</a>
   
   <!-- DOPO (CORRETTO) -->
   <a href="{{ .ConfirmationURL }}">Confirm your signup</a>
   ```
5. Salva modifiche

---

## 📋 VARIABILI DISPONIBILI SUPABASE

### `{{ .ConfirmationURL }}`
- **Descrizione**: URL completo di conferma (include `emailRedirectTo` passato in `signUp()`)
- **Uso**: ✅ **CORRETTO** per link di conferma
- **Esempio**: `https://spediresicuro.vercel.app/auth/callback?token=...&type=signup`

### `{{ .SiteURL }}`
- **Descrizione**: Site URL configurato in Supabase Dashboard
- **Uso**: ❌ **ERRATO** per link di conferma (non include path personalizzato)
- **Esempio**: `https://spediresicuro.vercel.app`

### `{{ .RedirectTo }}`
- **Descrizione**: URL di redirect dopo conferma (se specificato)
- **Uso**: ⚠️ **DEPRECATO** - Usa `{{ .ConfirmationURL }}` invece

---

## ✅ RISULTATO ATTESO

Dopo correzione template:
- ✅ Link email punta sempre a `/auth/callback`
- ✅ Utente atterra sempre su `/auth/callback` (non "/")
- ✅ `emailRedirectTo` passato in `signUp()` viene rispettato

---

## ⚠️ NOTA IMPORTANTE

**Se il template usa `{{ .SiteURL }}`**:
- Il link email punterà sempre a Site URL (es. `https://spediresicuro.vercel.app`)
- `emailRedirectTo` passato in `signUp()` viene **IGNORATO**
- Utente atterrerà su "/" invece che su "/auth/callback"

**Soluzione**: Usare sempre `{{ .ConfirmationURL }}` nel template.

