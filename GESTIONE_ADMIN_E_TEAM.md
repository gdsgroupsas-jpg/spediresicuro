# 👥 Sistema Gestione Admin e Team - SpedireSecuro

## 📊 Gerarchia Utenti

```
SUPERADMIN (livello 0)
    ├── Admin Livello 1
    │   ├── Admin Livello 2
    │   │   └── Admin Livello 3
    │   └── Reseller
    ├── Reseller
    └── User (Cliente finale)
```

## 🔐 Livelli di Accesso

### **Superadmin** (account_type: `superadmin`, admin_level: `0`)
- **Accesso completo** a tutte le funzionalità
- Gestione team illimitata
- Creazione sotto-admin di qualsiasi livello
- Configurazione sistema
- Analytics avanzate

### **Admin** (account_type: `admin`, admin_level: `1-5`)
- Gestione team limitata al proprio livello
- Creazione sotto-admin di livello inferiore
- Dashboard personalizzata
- Analytics team

### **Reseller** (account_type: `reseller`)
- Gestione clienti propri
- Wallet e ricariche
- Listini personalizzati
- Margini configurabili

### **User** (account_type: `user`)
- Creazione spedizioni
- Tracking
- Storico

---

## 🚀 Setup Iniziale Superadmin

### Email Superadmin Principali
Le seguenti email hanno accesso completo come **Superadmin**:

1. ✅ `sigorn@hotmail.it` - Salvatore Squillante
2. ✅ `gdsgroupsas@gmail.com` - GDS Group SAS  
3. ✅ `admin@spediresicuro.it` - Admin SpedireSecuro
4. ✅ `salvatore.squillante@gmail.com` - Salvatore Squillante

### Script di Setup
Esegui: `SETUP_SUPERADMIN_INIZIALI.sql` su Supabase SQL Editor

---

## 👨‍💼 Gestione Team (Dashboard)

### Invitare Collaboratori

1. **Login** come Superadmin
2. Vai su **Dashboard → Team Management** (`/dashboard/team`)
3. Click su **"Invita Nuovo Sotto-Admin"**
4. Compila:
   - Email collaboratore
   - Nome
   - Password temporanea
   - Livello admin (1-5)
5. Il collaboratore riceverà accesso immediato

### Promuovere Utenti Esistenti

```sql
-- Promuovi utente a Admin Livello 1
UPDATE users 
SET 
  account_type = 'admin',
  admin_level = 1,
  parent_admin_id = (SELECT id FROM users WHERE email = 'TUO_EMAIL@example.com'),
  role = 'admin'
WHERE email = 'collaboratore@example.com';
```

### Degradare Admin

```sql
-- Rimuovi permessi admin
UPDATE users 
SET 
  account_type = 'user',
  admin_level = NULL,
  parent_admin_id = NULL,
  role = 'user'
WHERE email = 'ex-admin@example.com';
```

---

## 🎯 Funzionalità per Livello

| Funzionalità | Superadmin | Admin L1 | Admin L2-5 | Reseller | User |
|-------------|-----------|----------|-----------|----------|------|
| Crea spedizioni | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gestione team | ✅ | ✅ | ✅ | ❌ | ❌ |
| Invita sotto-admin | ✅ | ✅ (L2+) | ✅ (inferiori) | ❌ | ❌ |
| Configura sistema | ✅ | ❌ | ❌ | ❌ | ❌ |
| Analytics avanzate | ✅ | ✅ | ⚠️ Limitate | ❌ | ❌ |
| Gestione reseller | ✅ | ✅ | ❌ | ❌ | ❌ |
| Wallet ricariche | ✅ | ✅ | ✅ | ✅ | ❌ |
| Listini personalizzati | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 🔒 Sicurezza

### Best Practices

1. **Password Forti**: Usa password complesse per account superadmin
2. **2FA**: Abilita autenticazione a due fattori (Google Authenticator)
3. **Audit Log**: Monitora azioni admin in `audit_logs`
4. **Separazione Ruoli**: Non usare account superadmin per operazioni quotidiane

### Revocare Accesso Immediato

```sql
-- Disabilita utente (soft delete)
UPDATE users 
SET 
  account_type = 'disabled',
  role = 'disabled',
  updated_at = NOW()
WHERE email = 'utente-sospetto@example.com';
```

---

## 📈 Analytics e Monitoraggio

### Query Utili

**Conteggio utenti per livello:**
```sql
SELECT 
  account_type,
  admin_level,
  COUNT(*) as count
FROM users
GROUP BY account_type, admin_level
ORDER BY 
  CASE account_type 
    WHEN 'superadmin' THEN 1
    WHEN 'admin' THEN 2
    WHEN 'reseller' THEN 3
    ELSE 4
  END,
  admin_level ASC;
```

**Gerarchia team completa:**
```sql
WITH RECURSIVE admin_hierarchy AS (
  -- Livello 0: Superadmin
  SELECT 
    id, email, name, account_type, admin_level, parent_admin_id, 0 as depth
  FROM users
  WHERE admin_level = 0
  
  UNION ALL
  
  -- Livelli successivi
  SELECT 
    u.id, u.email, u.name, u.account_type, u.admin_level, u.parent_admin_id, ah.depth + 1
  FROM users u
  INNER JOIN admin_hierarchy ah ON u.parent_admin_id = ah.id
)
SELECT * FROM admin_hierarchy
ORDER BY depth, admin_level, email;
```

---

## 🆘 Troubleshooting

### "Accesso Negato" su /dashboard/team

**Causa**: Utente non ha `account_type = 'admin'` o `'superadmin'`

**Soluzione**:
```sql
-- Verifica stato utente
SELECT email, role, account_type, admin_level 
FROM users 
WHERE email = 'tua@email.com';

-- Se account_type è NULL o 'user', esegui:
UPDATE users 
SET account_type = 'superadmin', admin_level = 0, role = 'admin'
WHERE email = 'tua@email.com';
```

### Login OAuth non riconosce Admin

**Causa**: OAuth crea utenti con `role = 'user'` di default

**Soluzione**: Dopo primo login OAuth, esegui:
```sql
UPDATE users 
SET account_type = 'superadmin', admin_level = 0, role = 'admin'
WHERE email = 'google-oauth@gmail.com';
```

Poi **logout** e **login** di nuovo.

---

## 📞 Contatti

**Supporto Tecnico**: admin@spediresicuro.it  
**Superadmin**: Salvatore Squillante
