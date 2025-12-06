# 🔍 VERIFICA ACCOUNT TYPE - Debug

## Problema
Il badge superadmin non appare e non si può accedere alla sezione Admin.

## Fix Applicati

### 1. Fix Componente dashboard-nav.tsx
**Problema:** Il componente leggeva `data.account_type` invece di `data.user.account_type`

**Fix:** Modificato per leggere correttamente:
```typescript
const userData = data.user || data;
setAccountType(userData.account_type || null);
```

### 2. Migliorato Logging API
Aggiunto logging per debug in `/api/user/info` per vedere cosa viene restituito.

---

## Verifica Manuale

### 1. Controlla Console Browser
Apri la console del browser (F12) e cerca:
- `Account Type caricato: ...`
- `Account Type recuperato da Supabase: ...`

### 2. Verifica API Direttamente
Apri nel browser:
```
http://localhost:3000/api/user/info
```

Dovresti vedere:
```json
{
  "success": true,
  "user": {
    "account_type": "superadmin",
    "role": "admin",
    ...
  }
}
```

### 3. Verifica Database Supabase
Esegui in Supabase SQL Editor:
```sql
SELECT email, account_type, role, admin_level 
FROM users 
WHERE email = 'TUA_EMAIL_QUI';
```

Deve risultare:
- `account_type = 'superadmin'`
- `role = 'admin'`
- `admin_level = 0`

---

## Se Ancora Non Funziona

### Opzione 1: Esegui Script SQL di Fix
Esegui in Supabase:
```sql
-- File: supabase/migrations/021_verify_fix_account_type_config.sql
```

### Opzione 2: Promuovi Manualmente a Superadmin
```sql
UPDATE users 
SET 
  account_type = 'superadmin',
  admin_level = 0,
  role = 'admin'
WHERE email = 'TUA_EMAIL_QUI';
```

### Opzione 3: Verifica Session
Controlla che la sessione contenga l'email corretta:
- Apri console browser
- Cerca `session.user.email`
- Verifica che corrisponda all'email nel database

---

## Debug Aggiuntivo

Aggiungi questo nel componente per vedere cosa viene caricato:
```typescript
console.log('User Data completo:', userData);
console.log('Account Type:', userData.account_type);
console.log('Role:', userData.role);
```
