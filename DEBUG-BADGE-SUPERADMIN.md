# 🔍 DEBUG BADGE SUPERADMIN - Guida Completa

## 📋 PROBLEMA
Il badge superadmin non appare e non si può accedere alla sezione Admin.

---

## ✅ FIX APPLICATI NEL CODICE

### 1. Componente dashboard-nav.tsx
- ✅ Corretto per leggere `data.user.account_type` invece di `data.account_type`
- ✅ Aggiunto logging: `console.log('Account Type caricato:', ...)`
- ✅ Condizione Admin: `(userRole === 'admin' || accountType === 'admin' || accountType === 'superadmin')`

### 2. API /api/user/info
- ✅ Recupera `account_type` da Supabase
- ✅ Aggiunto logging: `console.log('Account Type recuperato da Supabase:', ...)`

---

## 🔍 VERIFICA STEP-BY-STEP

### STEP 1: Verifica Console Browser
1. Apri il dashboard
2. Premi **F12** per aprire DevTools
3. Vai alla tab **Console**
4. Cerca questi messaggi:
   - `Account Type caricato: ...`
   - `Account Type recuperato da Supabase: ...`

**Cosa vedere:**
- Se vedi `Account Type caricato: superadmin` → Il componente funziona!
- Se vedi `Account Type caricato: null` o `undefined` → Problema con l'API
- Se non vedi nessun messaggio → Il componente non si carica

---

### STEP 2: Verifica API Direttamente
Apri nel browser (mentre sei loggato):
```
http://localhost:3000/api/user/info
```

**Dovresti vedere:**
```json
{
  "success": true,
  "user": {
    "account_type": "superadmin",
    "role": "admin",
    "email": "tua-email@example.com",
    ...
  }
}
```

**Se vedi:**
- `"account_type": null` → Il database non ha account_type impostato
- `"account_type": "user"` → Non sei superadmin nel database
- `"account_type": "superadmin"` → Il database è OK, problema nel componente

---

### STEP 3: Verifica Database Supabase

Esegui in **Supabase Dashboard → SQL Editor**:

```sql
-- Verifica il TUO account_type
SELECT 
  email,
  name,
  role,
  account_type,
  admin_level
FROM users 
WHERE email = 'TUA_EMAIL_QUI';
```

**Deve risultare:**
- `account_type = 'superadmin'`
- `role = 'admin'`
- `admin_level = 0`

**Se non è così:**
- Esegui lo script SQL 021 per fixare
- Oppure promuovi manualmente (vedi STEP 4)

---

### STEP 4: Promuovi a Superadmin (se necessario)

Se il tuo account_type non è 'superadmin', esegui in Supabase:

```sql
UPDATE users 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  role = 'admin',
  updated_at = NOW()
WHERE email = 'TUA_EMAIL_QUI';
```

Poi **ricarica la pagina** (Ctrl+F5 per forzare refresh).

---

### STEP 5: Usa API Debug

Apri nel browser:
```
http://localhost:3000/api/debug/check-my-account-type
```

Questo ti mostra:
- Se sei trovato in Supabase
- Il tuo account_type attuale
- Se puoi accedere alla sezione Admin
- Raccomandazioni

---

## 🐛 PROBLEMI COMUNI E SOLUZIONI

### Problema 1: Badge non appare
**Causa:** `accountType` è `null` o `undefined`

**Soluzione:**
1. Verifica che l'API restituisca `account_type`
2. Controlla console browser per errori
3. Verifica che tu abbia `account_type = 'superadmin'` nel database

---

### Problema 2: Sezione Admin non appare
**Causa:** La condizione non è soddisfatta

**Soluzione:**
1. Verifica che `accountType === 'superadmin'` o `accountType === 'admin'`
2. Controlla console: `Account Type caricato: ...`
3. Se è `null`, esegui lo script SQL 021

---

### Problema 3: API restituisce account_type null
**Causa:** Database Supabase non ha account_type impostato

**Soluzione:**
1. Esegui script SQL 021 in Supabase
2. Verifica che la colonna `account_type` esista
3. Promuovi manualmente a superadmin (STEP 4)

---

### Problema 4: Cache Browser
**Causa:** Il browser ha in cache la vecchia versione

**Soluzione:**
1. **Ctrl+F5** per forzare refresh completo
2. Oppure **Ctrl+Shift+R**
3. Oppure svuota cache browser

---

## 📝 CHECKLIST FINALE

Prima di dire che non funziona, verifica:

- [ ] Console browser mostra `Account Type caricato: superadmin`
- [ ] API `/api/user/info` restituisce `"account_type": "superadmin"`
- [ ] Database Supabase ha `account_type = 'superadmin'` per la tua email
- [ ] Hai fatto **refresh completo** (Ctrl+F5) dopo le modifiche
- [ ] Non ci sono errori nella console browser
- [ ] La sessione è attiva (sei loggato)

---

## 🆘 SE NULLA FUNZIONA

1. **Esegui script SQL 021** in Supabase
2. **Promuovi manualmente** a superadmin (STEP 4)
3. **Svuota cache** browser completamente
4. **Ricarica** la pagina (Ctrl+F5)
5. **Verifica** con API debug: `/api/debug/check-my-account-type`

---

**Data creazione:** 6 Dicembre 2025 - 22:30
