# AI Features Toggle - SpedireSicuro

## Overview

Questo documento descrive il sistema di toggle features di SpedireSicuro, che permette di attivare/disattivare features a livello globale (platform features), per utente specifico (user features), e gestire permessi granulari tramite capability flags.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Conoscenza base di feature flags
- Comprensione di sistemi di permessi granulari
- Familiarità con PostgreSQL

## Quick Reference

| Sezione | Pagina | Link |
|---------|--------|------|
| Platform Features | docs/11-FEATURES/AI_FEATURES_TOGGLE.md | [Platform Features](#platform-features-global-toggle) |
| Capability Flags | docs/11-FEATURES/AI_FEATURES_TOGGLE.md | [Capabilities](#capability-flags-granular-permissions) |
| User Features | docs/11-FEATURES/AI_FEATURES_TOGGLE.md | [User Features](#user-features-per-user-toggle) |
| Usage Examples | docs/11-FEATURES/AI_FEATURES_TOGGLE.md | [Examples](#examples) |

## Content

### Platform Features (Global Toggle)

#### Concetto

Le platform features sono toggle globali gestiti dal superadmin per attivare/disattivare features dell'intera piattaforma.

#### Struttura Database

**File:** `supabase/migrations/012_platform_features_toggle.sql`

```sql
CREATE TABLE platform_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Identificativo feature
  code TEXT UNIQUE NOT NULL, -- es. 'integrations', 'automation', 'ldv_scanner'
  name TEXT NOT NULL, -- Nome visualizzato
  description TEXT, -- Descrizione feature
  
  -- Categoria
  category TEXT NOT NULL, -- 'integrations', 'automation', 'admin', 'analytics'
  
  -- Stato
  is_enabled BOOLEAN DEFAULT true, -- Se la feature è attiva globalmente
  is_visible BOOLEAN DEFAULT true, -- Se la feature è visibile nel menu
  
  -- Configurazione
  config JSONB DEFAULT '{}', -- Configurazioni specifiche feature
  
  -- Ordine visualizzazione
  display_order INTEGER DEFAULT 100,
  
  -- Icona (nome icona lucide-react)
  icon TEXT,
  
  -- Route/path associato (opzionale)
  route_path TEXT, -- es. '/dashboard/integrazioni', '/dashboard/admin'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Helper TypeScript

**File:** `lib/platform-features.ts`

```typescript
import { isPlatformFeatureEnabled } from '@/lib/platform-features';

// Verifica se feature è attiva
const isEnabled = await isPlatformFeatureEnabled('integrations');

if (isEnabled) {
  // Mostra feature nel menu
  // ...
}
```

#### Verifica Feature

```typescript
// Verifica se feature è attiva
export async function isPlatformFeatureEnabled(featureCode: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('platform_features')
    .select('is_enabled')
    .eq('code', featureCode)
    .single();
  
  if (error || !data) {
    // Se feature non esiste, ritorna true (compatibilità)
    return true;
  }
  
  return data.is_enabled === true;
}
```

#### Verifica Visibilità

```typescript
// Verifica se feature è visibile (anche se disabilitata)
export async function isPlatformFeatureVisible(featureCode: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('platform_features')
    .select('is_visible')
    .eq('code', featureCode)
    .single();
  
  if (error || !data) {
    return true; // Default: visibile
  }
  
  return data.is_visible === true;
}
```

---

### Capability Flags (Granular Permissions)

#### Concetto

Le capability flags sono permessi granulari per utenti, con fallback automatico a `role`/`account_type` esistenti per retrocompatibilità.

#### Struttura Database

**File:** `supabase/migrations/081_account_capabilities_table.sql`

```sql
CREATE TABLE account_capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Riferimento utente
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Nome capability
  capability_name TEXT NOT NULL,
  
  -- Audit trail
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  
  -- Revoca (soft delete per audit trail)
  revoked_at TIMESTAMPTZ, -- NULL = capability attiva
  revoked_by UUID REFERENCES users(id),
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Capability Disponibili

| Capability | Descrizione | Fallback |
|------------|-------------|----------|
| `can_manage_pricing` | Modifica prezzi/listini | `admin`, `superadmin` |
| `can_create_subusers` | Crea sub-users | `reseller`, `admin`, `superadmin` |
| `can_access_api` | Accesso API | `byoc`, `admin`, `superadmin` |
| `can_manage_wallet` | Gestione wallet altri utenti | `admin`, `superadmin` |
| `can_view_all_clients` | Vedi tutti i clienti | `admin`, `superadmin` |
| `can_manage_resellers` | Gestione reseller | `superadmin` |
| `can_bypass_rls` | Bypass RLS | `superadmin` |

#### Helper TypeScript

**File:** `lib/db/capability-helpers.ts`

```typescript
import { hasCapability } from '@/lib/db/capability-helpers';

// Verifica capability con fallback automatico
const canManagePricing = await hasCapability(userId, 'can_manage_pricing', {
  role: user.role,
  account_type: user.account_type,
});

if (canManagePricing) {
  // Permesso concesso
  await updatePriceList();
}
```

#### Strategia Fallback

Il sistema usa **fallback automatico** se capability non trovata:

1. **Prima:** Verifica `account_capabilities` table
2. **Se non trovata:** Usa fallback a `role`/`account_type`/`is_reseller`

**Vantaggi:**
- ✅ Retrocompatibilità garantita
- ✅ Nessuna regressione
- ✅ Migrazione graduale possibile

#### Funzione SQL

**File:** `supabase/migrations/082_has_capability_function.sql`

```sql
CREATE OR REPLACE FUNCTION has_capability(
  p_user_id UUID,
  p_capability_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica capability attiva (revoked_at IS NULL)
  RETURN EXISTS (
    SELECT 1 FROM account_capabilities
    WHERE user_id = p_user_id
      AND capability_name = p_capability_name
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### User Features (Per-User Toggle)

#### Concetto

Le user features permettono di attivare/disattivare features specifiche per utente (es. "killer features" per beta testers).

#### Struttura Database

```sql
CREATE TABLE killer_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- es. 'ai_chat', 'smart_ocr'
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  feature_id UUID NOT NULL REFERENCES killer_features(id),
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Opzionale: scadenza feature
  activation_type TEXT, -- 'manual', 'trial', 'beta'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_email, feature_id)
);
```

#### API Toggle Feature

**File:** `app/api/admin/features/route.ts`

```typescript
export async function POST(request: NextRequest) {
  const adminAuth = await requireAdminRole();
  if (!adminAuth.authorized) return adminAuth.response;
  
  const { targetUserEmail, featureCode, activate, expiresAt } = await request.json();
  
  // 1. Verifica che la feature esista
  const { data: feature } = await supabaseAdmin
    .from('killer_features')
    .select('id')
    .eq('code', featureCode)
    .single();
  
  if (!feature) {
    return ApiErrors.NOT_FOUND('Feature');
  }
  
  // 2. Inserisci o aggiorna user_feature
  const { data: existingUserFeature } = await supabaseAdmin
    .from('user_features')
    .select('id')
    .eq('user_email', targetUserEmail)
    .eq('feature_id', feature.id)
    .single();
  
  if (existingUserFeature) {
    // Aggiorna feature esistente
    await supabaseAdmin
      .from('user_features')
      .update({
        is_active: activate,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingUserFeature.id);
  } else {
    // Crea nuova user feature
    await supabaseAdmin
      .from('user_features')
      .insert({
        user_email: targetUserEmail,
        feature_id: feature.id,
        is_active: activate,
        activated_at: activate ? new Date().toISOString() : null,
        expires_at: expiresAt,
      });
  }
  
  return Response.json({ success: true });
}
```

#### Verifica User Feature

```typescript
// Verifica se utente ha feature attiva
export async function hasUserFeature(
  userEmail: string,
  featureCode: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('user_features')
    .select('is_active, expires_at')
    .eq('user_email', userEmail)
    .eq('killer_features.code', featureCode)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  // Verifica scadenza
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return false;
  }
  
  return data.is_active === true;
}
```

---

### Feature Flags Overview

#### Live Features (Production Ready)

- ✅ **User Dashboard** - Shipment creation, tracking
- ✅ **Wallet System** - Prepaid credit, top-ups
- ✅ **Multi-Courier** - GLS, BRT, Poste
- ✅ **Reseller System** - Hierarchical user management
- ✅ **Acting Context** - SuperAdmin impersonation
- ✅ **Audit Logging** - Security event tracking
- ✅ **GDPR Compliance** - Data export, anonymization
- ✅ **CRM Leads** - Lead management, conversion
- ✅ **Courier Configs** - Encrypted credential storage

#### Partially Implemented

- ✅ **AI Anne Chat UI** - Backend orchestrator completo, chat UI implementata
- 🟡 **Smart Top-Up OCR** - Gemini Vision integration exists, not exposed
- 🟡 **Invoice System** - Tables exist, PDF generation missing
- 🟡 **XPay Payments** - Integration ready, not enabled
- 🟡 **Doctor Service** - Diagnostics logging active, UI dashboard missing

#### Planned (Backlog)

- 📋 **OCR Immagini** - Supporto completo per estrazione dati da immagini
- 📋 **Fiscal Brain** - F24, LIPE tracking
- 📋 **Multi-Region** - Database sharding
- 📋 **Mobile App** - React Native
- 📋 **API Marketplace** - Public API for integrations

**Vedi:** [Architecture Overview](../2-ARCHITECTURE/OVERVIEW.md) per dettagli completi.

---

## Examples

### Verificare Platform Feature

```typescript
// Server Component / API Route
import { isPlatformFeatureEnabled } from '@/lib/platform-features';

export async function GET() {
  const isIntegrationsEnabled = await isPlatformFeatureEnabled('integrations');
  
  if (!isIntegrationsEnabled) {
    return Response.json({ error: 'Feature non disponibile' }, { status: 503 });
  }
  
  // Feature attiva, procedi
  return Response.json({ data: '...' });
}
```

### Verificare Capability

```typescript
// Server Action
import { hasCapability } from '@/lib/db/capability-helpers';
import { requireSafeAuth } from '@/lib/safe-auth';

export async function updatePriceList(priceListId: string, data: any) {
  const context = await requireSafeAuth();
  
  // Verifica capability
  const canManage = await hasCapability(context.actor.id, 'can_manage_pricing', {
    role: context.actor.role,
    account_type: context.actor.account_type,
  });
  
  if (!canManage) {
    throw new Error('Permesso negato: can_manage_pricing');
  }
  
  // Procedi con update
  // ...
}
```

### Toggle User Feature (Admin)

```typescript
// API Route
import { requireAdminRole } from '@/lib/api-middleware';

export async function POST(request: Request) {
  const adminAuth = await requireAdminRole();
  if (!adminAuth.authorized) return adminAuth.response;
  
  const { targetUserEmail, featureCode, activate } = await request.json();
  
  // Toggle feature per utente
  const { error } = await supabaseAdmin
    .from('user_features')
    .upsert({
      user_email: targetUserEmail,
      feature_code: featureCode,
      is_active: activate,
    });
  
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  
  return Response.json({ success: true });
}
```

### Verificare User Feature

```typescript
// Client Component
import { useSession } from 'next-auth/react';

export function FeatureGate({ featureCode, children }: { featureCode: string; children: React.ReactNode }) {
  const { data: session } = useSession();
  const [hasFeature, setHasFeature] = useState(false);
  
  useEffect(() => {
    if (session?.user?.email) {
      fetch(`/api/features/check?feature=${featureCode}`)
        .then(res => res.json())
        .then(data => setHasFeature(data.enabled));
    }
  }, [session, featureCode]);
  
  if (!hasFeature) {
    return null; // Feature non disponibile
  }
  
  return <>{children}</>;
}
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| Feature non trovata | Verifica che feature esista in `platform_features` o `killer_features` |
| Capability non funziona | Verifica fallback a role/account_type, controlla migration 083 |
| User feature non attiva | Verifica `is_active = true` e `expires_at` non scaduto |
| Platform feature sempre attiva | Verifica che `is_enabled = false` in database, controlla helper |
| RLS blocca capability query | Verifica policy `account_capabilities_select`, controlla auth.uid() |

---

## Related Documentation

- [Architecture Overview](../2-ARCHITECTURE/OVERVIEW.md) - Feature flags overview
- [Authorization & Acting Context](../8-SECURITY/AUTHORIZATION.md) - RBAC e capability
- [Capability System Usage](../CAPABILITY_SYSTEM_USAGE.md) - Guida dettagliata capability flags

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version - Platform Features, Capability Flags, User Features | AI Agent |

---
*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Engineering Team*
