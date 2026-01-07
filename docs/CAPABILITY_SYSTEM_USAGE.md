# 🔐 Capability System - Guida all'Uso

**Data:** 2025-01-XX  
**Versione:** 1.0  
**Status:** ✅ Implementato (Fase 1)

---

## 📋 Overview

Il sistema **Capability Flags** permette permessi granulari per utenti, con fallback automatico a `role`/`account_type` esistenti per retrocompatibilità.

**Non breaking:** Mantiene compatibilità completa con sistema esistente.

---

## 🎯 Capability Disponibili

| Capability             | Descrizione                  | Fallback                          |
| ---------------------- | ---------------------------- | --------------------------------- |
| `can_manage_pricing`   | Modifica prezzi/listini      | `admin`, `superadmin`             |
| `can_create_subusers`  | Crea sub-users               | `reseller`, `admin`, `superadmin` |
| `can_access_api`       | Accesso API                  | `byoc`, `admin`, `superadmin`     |
| `can_manage_wallet`    | Gestione wallet altri utenti | `admin`, `superadmin`             |
| `can_view_all_clients` | Vedi tutti i clienti         | `admin`, `superadmin`             |
| `can_manage_resellers` | Gestione reseller            | `superadmin`                      |
| `can_bypass_rls`       | Bypass RLS                   | `superadmin`                      |

---

## 💻 Utilizzo in TypeScript

### Esempio Base

```typescript
import { hasCapability } from "@/lib/db/capability-helpers";

// Verifica capability
const canManagePricing = await hasCapability(userId, "can_manage_pricing");

if (canManagePricing) {
  // Permesso concesso
  await updatePriceList();
} else {
  // Accesso negato
  throw new Error("Permesso negato");
}
```

### Esempio con Fallback User (Performance)

```typescript
import { hasCapability } from "@/lib/db/capability-helpers";

// Se hai già i dati utente, passa fallbackUser per evitare query extra
const user = await getUserById(userId);

const canCreateSubUsers = await hasCapability(userId, "can_create_subusers", {
  role: user.role,
  account_type: user.account_type,
  is_reseller: user.is_reseller,
});
```

### Esempio in API Route

```typescript
import { hasCapability } from "@/lib/db/capability-helpers";
import { requireAuth } from "@/lib/api-middleware";

export async function POST(request: NextRequest) {
  // 1. Autenticazione
  const authResult = await requireAuth();
  if (!authResult.authorized) return authResult.response;

  // 2. Verifica capability
  const user = await findUserByEmail(authResult.session.user.email);
  if (!user) return ApiErrors.NOT_FOUND("Utente");

  const canManagePricing = await hasCapability(user.id, "can_manage_pricing", {
    role: user.role,
    account_type: user.account_type,
  });

  if (!canManagePricing) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  // 3. Operazione autorizzata
  // ...
}
```

### Recuperare Tutte le Capability

```typescript
import { getUserCapabilities } from "@/lib/db/capability-helpers";

const capabilities = await getUserCapabilities(userId);
// ['can_manage_pricing', 'can_create_subusers', ...]
```

---

## 🗄️ Utilizzo in Database (SQL)

### Verifica Capability

```sql
-- Usa funzione helper
SELECT has_capability(user_id, 'can_manage_pricing') AS can_manage;

-- Query diretta
SELECT EXISTS (
  SELECT 1 FROM account_capabilities
  WHERE user_id = '...'
    AND capability_name = 'can_manage_pricing'
    AND revoked_at IS NULL
) AS has_capability;
```

### Concedere Capability

```sql
-- Solo superadmin può concedere (via RLS)
INSERT INTO account_capabilities (user_id, capability_name, granted_by)
VALUES ('user-id', 'can_manage_pricing', 'superadmin-id');
```

### Revocare Capability (Soft Delete)

```sql
-- Soft delete per audit trail
UPDATE account_capabilities
SET revoked_at = NOW(),
    revoked_by = 'superadmin-id'
WHERE user_id = 'user-id'
  AND capability_name = 'can_manage_pricing'
  AND revoked_at IS NULL;
```

---

## 🔄 Strategia Fallback

Il sistema usa **fallback automatico** se capability non trovata:

1. **Prima:** Verifica `account_capabilities` table
2. **Se non trovata:** Usa fallback a `role`/`account_type`/`is_reseller`

**Vantaggi:**

- ✅ Retrocompatibilità garantita
- ✅ Nessuna regressione
- ✅ Migrazione graduale possibile

**Esempio Fallback:**

```typescript
// Utente con role='admin' ma senza capability in DB
const canManage = await hasCapability(userId, "can_manage_pricing");
// → Restituisce TRUE (fallback a role='admin')
```

---

## 🧪 Testing

### Test Unit

```typescript
import { hasCapability } from "@/lib/db/capability-helpers";

describe("hasCapability", () => {
  it("should return true for superadmin with capability", async () => {
    const result = await hasCapability(superadminId, "can_manage_pricing", {
      account_type: "superadmin",
    });
    expect(result).toBe(true);
  });

  it("should fallback to role if capability not found", async () => {
    const result = await hasCapability(adminId, "can_manage_pricing", {
      role: "admin",
    });
    expect(result).toBe(true); // Fallback funziona
  });
});
```

---

## 📊 Migrazione Dati

Le capability vengono popolate automaticamente da `role`/`account_type` esistenti tramite migration `083_populate_capabilities_from_roles.sql`.

**Idempotente:** Può essere eseguita più volte senza duplicati (ON CONFLICT DO NOTHING).

---

## ⚠️ Best Practices

1. **Usa fallback user quando possibile** per performance
2. **Non rimuovere controlli role esistenti** (mantieni fallback)
3. **Documenta capability custom** se ne aggiungi di nuove
4. **Usa soft delete** (revoked_at) invece di DELETE per audit trail
5. **Testa sempre fallback** per garantire retrocompatibilità

---

## 🔐 Sicurezza

- ✅ RLS policies attive su `account_capabilities`
- ✅ Solo superadmin può concedere/revocare capability
- ✅ Fallback sicuro (default deny se capability sconosciuta)
- ✅ Audit trail completo (granted_by, revoked_by, timestamps)

---

## 📚 Riferimenti

- **Migration:** `081_account_capabilities_table.sql`
- **Function:** `082_has_capability_function.sql`
- **Data Migration:** `083_populate_capabilities_from_roles.sql`
- **Helper TypeScript:** `lib/db/capability-helpers.ts`

---

**Status:** ✅ Pronto per uso in produzione (con fallback attivo)
