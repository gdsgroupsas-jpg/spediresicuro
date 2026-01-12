# Data Protection - SpedireSicuro

## Overview

Questo documento descrive le misure di protezione dati di SpedireSicuro, inclusi encryption, gestione secrets, e sicurezza configurazioni corriere.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Encryption basics
- Environment variables understanding
- Database security concepts

## Quick Reference

| Sezione | Pagina | Link |
|---------|--------|------|
| Encryption | docs/8-SECURITY/DATA_PROTECTION.md | [Encryption](#encryption) |
| Courier Config Security | docs/8-SECURITY/DATA_PROTECTION.md | [Courier Configs](#multi-account-courier-config-security) |
| Environment Variables | docs/8-SECURITY/DATA_PROTECTION.md | [Env Vars](#environment-variables-security-critical) |

## Content

### Encryption

#### Courier Credentials

Le credenziali corriere sono salvate criptate in `courier_configs.api_key` e `courier_configs.api_secret`.

**Encryption Key:**
- Variabile ambiente: `ENCRYPTION_KEY`
- **Hardening:** Sistema lancia Error in production se `ENCRYPTION_KEY` è mancante (Fail-Closed)
- Accessibile solo server-side via `supabaseAdmin`

**Pattern:**
```typescript
import { encryptCredential, decryptCredential } from '@/lib/security/encryption';

// Encrypt
const encrypted = encryptCredential(apiKey);

// Decrypt (solo server-side)
const decrypted = decryptCredential(encrypted);
```

#### Password Storage

Le password utente sono hashate con bcrypt prima di essere salvate in `users.password`.

**Pattern:**
```typescript
import { hashPassword, verifyPassword } from '@/lib/auth/password';

// Hash password
const hashed = await hashPassword(password);

// Verify password
const isValid = await verifyPassword(password, hashed);
```

---

### Multi-Account Courier Config Security (P1 Hardening)

#### Problema

Quando il backend usa `supabaseAdmin` (service role), **RLS è bypassata**.  
Questo è corretto per molte operazioni server-side, ma richiede **validazione esplicita** quando si accetta un input come `configId` / `specificConfigId`.

#### Regola

- **Se arriva `configId`/`specificConfigId` dal client/UI**: il server deve verificare che la configurazione sia:
  - di proprietà dell'utente (`owner_user_id = userId`) **oppure**
  - legacy compat (`created_by = userEmail`) **oppure**
  - una config default globale (`is_default = true AND owner_user_id IS NULL`) **oppure**
  - l'actor è `admin/superadmin`.

#### Implementazione

- `lib/actions/spedisci-online.ts` → validazione accesso su `configId`
- `lib/couriers/factory.ts` → validazione accesso su `specificConfigId`

#### Logging

- Evitare log di UUID completi delle configurazioni: usare hash breve o prefisso (`8 chars`).

---

### Environment Variables (Security-Critical)

#### Auth

- `NEXTAUTH_SECRET` - **P0** - JWT signing key (rotate on compromise)
- `NEXTAUTH_URL` - Callback URL base (must match OAuth app settings)

#### Supabase

- `SUPABASE_SERVICE_ROLE_KEY` - **P0** - Bypasses RLS, NEVER expose client-side
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public key (RLS enforced)

#### Impersonation

- `IMPERSONATION_COOKIE_NAME` - Cookie name (default: `impersonate-context`)
- `IMPERSONATION_TTL` - Session TTL in seconds (default: 3600)

#### Encryption

- `ENCRYPTION_KEY` - **P0** - Key per criptare credenziali corriere (Fail-Closed se mancante)

#### Couriers (Encrypted in DB)

- API keys stored in `courier_configs.api_key` (encrypted at rest)
- **Hardening:** System throws Error in production if `ENCRYPTION_KEY` is missing (Fail-Closed)
- Accessed only server-side via `supabaseAdmin`

**Rotation Procedure:**

1. Update key in courier portal
2. Update `courier_configs` via admin UI
3. Test with dummy shipment
4. Monitor for 24h

---

## Examples

### Encrypt/Decrypt Credentials

```typescript
import { encryptCredential, decryptCredential } from '@/lib/security/encryption';

// Salva credenziale criptata
const encrypted = encryptCredential(apiKey);
await supabaseAdmin
  .from('courier_configs')
  .update({ api_key: encrypted })
  .eq('id', configId);

// Leggi e decripta (solo server-side)
const { data: config } = await supabaseAdmin
  .from('courier_configs')
  .select('api_key')
  .eq('id', configId)
  .single();

const decrypted = decryptCredential(config.api_key);
```

### Validare Accesso Config

```typescript
async function validateConfigAccess(configId: string, userId: string) {
  const { data: config } = await supabaseAdmin
    .from('courier_configs')
    .select('owner_user_id, is_default, created_by')
    .eq('id', configId)
    .single();
  
  if (!config) return false;
  
  // Default globale
  if (config.is_default && !config.owner_user_id) return true;
  
  // Proprietà utente
  if (config.owner_user_id === userId) return true;
  
  // Legacy compat
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single();
  
  if (user?.email === config.created_by) return true;
  
  return false;
}
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| ENCRYPTION_KEY mancante | Configura variabile ambiente in production |
| Credenziali non decriptate | Verifica che `ENCRYPTION_KEY` sia corretta |
| Accesso non autorizzato a config | Verifica validazione accesso in factory |

---

## Related Documentation

- [Security Overview](OVERVIEW.md) - Overview sicurezza
- [Authorization](AUTHORIZATION.md) - RBAC
- [Courier Adapter](../2-ARCHITECTURE/OVERVIEW.md) - Factory pattern

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | AI Agent |

---
*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Engineering Team*
