# 📋 RISPOSTA - Template Email Supabase

## ❓ DOMANDA

> Hai già incollato nel template **href="{{ .ConfirmationURL }}"** e salvato?

## ✅ RISPOSTA

**NO** - Non ho accesso diretto a Supabase Dashboard.

**Cosa ho fatto**:
1. ✅ Verificato che il codice in `app/api/auth/register/route.ts` è corretto
2. ✅ Creato guida completa per correggere il template (`FIX_TEMPLATE_EMAIL_SUPABASE_P0.md`)
3. ✅ Creato checklist binaria con 6 controlli P0 (`CHECKLIST_FIX_TEMPLATE_EMAIL.md`)
4. ✅ Creato test dettagliati (`TEST_LINK_EMAIL.md`)

**Cosa serve fare ora**:
1. Accedere a Supabase Dashboard → Authentication → Email Templates → "Confirm signup"
2. Verificare che il link usi `{{ .ConfirmationURL }}` (NON `{{ .SiteURL }}`)
3. Correggere se necessario e salvare
4. **Generare mail NUOVA** dopo aver salvato (email vecchie contengono link vecchi)

---

## 🧪 TEST RICHIESTO

Dopo aver corretto il template:

1. **Signup nuovo utente** con: `testspediresicuro+missionec77@gmail.com`
2. **Apri email ricevuta**
3. **Tasto destro sul link** → **Copia link** (PRIMA di cliccare)
4. **Incolla qui l'URL copiato**

**Criterio PASS/FAIL**:
- ✅ **PASS**: URL contiene `spediresicuro.vercel.app` E `/auth/callback` E NON contiene `projects.vercel.app`
- ❌ **FAIL**: URL NON contiene `/auth/callback` O contiene `projects.vercel.app`

---

## 📚 DOCUMENTAZIONE DISPONIBILE

1. `FIX_TEMPLATE_EMAIL_SUPABASE_P0.md` - Guida completa fix
2. `CHECKLIST_FIX_TEMPLATE_EMAIL.md` - Checklist binaria con 6 controlli P0
3. `TEST_LINK_EMAIL.md` - Test dettagliati
4. `DELEGA_CURSOR_VERIFICA_TEMPLATE.md` - Istruzioni per verificare template

---

## ⚠️ NOTA IMPORTANTE

**Email Stale = Killer Silenzioso**:
- Le email generate PRIMA di correggere il template contengono link vecchi
- Anche se il template è corretto, cliccare su email vecchie darà FAIL
- **Soluzione**: Sempre generare mail NUOVA dopo aver salvato template

**Regola**: Ogni volta che tocchi template/config → **rifai signup** con alias nuovo.

