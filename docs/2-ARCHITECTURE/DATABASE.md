# Database Architecture - SpedireSicuro

## Overview

Questo documento descrive l'architettura del database di SpedireSicuro, inclusi pattern per Wallet System, Row Level Security (RLS), Idempotency, e Compensation Queue.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- PostgreSQL 15+ knowledge
- Supabase basics
- SQL familiarity
- Understanding of transactions and locking

## Quick Reference

| Sezione | Pagina | Link |
|---------|--------|------|
| Wallet System | docs/2-ARCHITECTURE/DATABASE.md | [Wallet System](#wallet-system-prepaid-credit) |
| RLS | docs/2-ARCHITECTURE/DATABASE.md | [RLS](#row-level-security-rls) |
| Idempotency | docs/2-ARCHITECTURE/DATABASE.md | [Idempotency](#idempotency-duplicate-prevention) |
| Compensation Queue | docs/2-ARCHITECTURE/DATABASE.md | [Compensation](#compensation-queue-failure-recovery) |
| Migrations | docs/2-ARCHITECTURE/DATABASE.md | [Migrations](#migrations) |

## Content

### Wallet System (Prepaid Credit)

**Problema:** Prevenire saldo negativo, garantire audit trail, supportare rimborsi, prevenire race conditions.

**Soluzione:** Funzioni RPC atomiche con pessimistic locking + ledger immutabile delle transazioni.

#### Struttura Tabelle

- `users.wallet_balance` - Saldo corrente (CHECK >= 0)
- `wallet_transactions` - Ledger immutabile (append-only, audit trail)

#### Flow Operativo

1. Admin approva richiesta top-up
2. Chiama `add_wallet_credit(user_id, amount, description, admin_id)`
3. La funzione chiama `increment_wallet_balance()` (ATOMICA con FOR UPDATE NOWAIT)
4. La funzione inserisce riga in `wallet_transactions` (solo audit trail, NO trigger)
5. Utente crea spedizione → pre-check saldo
6. Se sufficiente, chiama `decrement_wallet_balance()` (ATOMICA) → poi inserisce transazione

#### Funzioni Atomiche

**Key Insight:** Il saldo NON viene MAI aggiornato direttamente. Solo funzioni RPC atomiche possono modificare `wallet_balance`:

- `increment_wallet_balance(user_id, amount)` - Credito atomico con pessimistic lock
- `decrement_wallet_balance(user_id, amount)` - Debito atomico con pessimistic lock
- `add_wallet_credit(user_id, amount, description, admin_id)` - Wrapper che chiama `increment_wallet_balance()` + inserisce transazione

**⚠️ IMPORTANTE:** Trigger legacy rimosso in migration `041_remove_wallet_balance_trigger.sql` (causava doppio accredito).

#### Esempio Implementazione

```sql
-- Funzione atomica per decremento
CREATE OR REPLACE FUNCTION decrement_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC(10,2)
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC(10,2);
BEGIN
  -- Pessimistic lock con NOWAIT (fallisce se lock già acquisito)
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;

  -- Verifica saldo sufficiente
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_CREDIT: Balance % < required %', 
      v_current_balance, p_amount;
  END IF;

  -- Aggiorna saldo (atomico)
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount
  WHERE id = p_user_id;
END;
$$;
```

#### Reconciliation

```sql
-- Job giornaliero verifica integrità
SELECT u.id, u.wallet_balance, SUM(wt.amount) AS calculated
FROM users u
LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
GROUP BY u.id
HAVING u.wallet_balance != SUM(wt.amount);
```

Vedi [11-FEATURES/WALLET.md](../11-FEATURES/WALLET.md) per dettagli completi sul sistema wallet.

---

### Row Level Security (RLS)

**Problema:** Garantire che gli utenti vedano solo i propri dati.

**Soluzione:** Policy RLS di PostgreSQL su TUTTE le tabelle tenant.

#### Pattern Standard

```sql
-- Abilita RLS
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Policy: Utenti vedono propri dati, admin vedono tutto
CREATE POLICY "shipments_select" ON shipments FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);
```

#### Bypass RLS (Solo Server-Side)

```typescript
// Usa service role key (bypassa RLS)
import { supabaseAdmin } from '@/lib/db/client'

// Safe: Solo server-side
const { data } = await supabaseAdmin.from('shipments').select('*')
```

**Key Insight:** NON usare MAI `supabaseAdmin` in componenti client, solo in Server Actions/API Routes.

#### Tabelle con RLS

Tutte le tabelle tenant devono avere RLS abilitato:
- `shipments`
- `wallet_transactions`
- `courier_configs`
- `price_lists`
- `users` (con policy speciali per admin)

#### Policy Template

```sql
-- SELECT: Utente vede propri dati + admin vedono tutto
CREATE POLICY "<table>_select" ON <table> FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- INSERT: Solo utente stesso o admin
CREATE POLICY "<table>_insert" ON <table> FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- UPDATE: Solo utente stesso o admin
CREATE POLICY "<table>_update" ON <table> FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);
```

Vedi [8-SECURITY/OVERVIEW.md](../8-SECURITY/OVERVIEW.md) per dettagli completi su RLS e sicurezza.

---

### Idempotency (Duplicate Prevention)

**Problema:** Utente fa doppio click su "Crea Spedizione" → crea 2 spedizioni.

**Soluzione:** Hash key fields + timestamp window.

#### Implementazione

```typescript
import crypto from 'crypto';

// Genera idempotency key
const idempotencyKey = crypto.createHash('sha256').update(JSON.stringify({
  userId: context.target.id,
  recipient: validated.recipient,
  packages: validated.packages,
  timestamp: Math.floor(Date.now() / 5000) // 5-second buckets
})).digest('hex');

// Verifica duplicati negli ultimi 60 secondi
const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
const { data: duplicate } = await supabaseAdmin
  .from('shipments')
  .select('id')
  .eq('user_id', context.target.id)
  .eq('idempotency_key', idempotencyKey)
  .gte('created_at', oneMinuteAgo)
  .maybeSingle();

if (duplicate) {
  return Response.json({ error: 'DUPLICATE_REQUEST' }, { status: 409 });
}

// Inserisci spedizione con idempotency_key
const { data: shipment } = await supabaseAdmin
  .from('shipments')
  .insert({
    ...validated,
    idempotency_key: idempotencyKey,
    user_id: context.target.id
  });
```

**Key Insight:** Bucket di 5 secondi permettono retry, finestra di 60 secondi bilancia sicurezza vs performance.

#### Pattern con Lock Database

Per operazioni critiche, usa lock database:

```typescript
// Usa RPC per lock atomico
const { data: lock } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_key: idempotencyKey,
  p_user_id: context.target.id,
  p_ttl_seconds: 60
});

if (!lock) {
  return Response.json({ error: 'DUPLICATE_REQUEST' }, { status: 409 });
}

try {
  // Operazione critica
  await createShipment(...);
} finally {
  // Rilascia lock
  await supabaseAdmin.rpc('release_idempotency_lock', {
    p_key: idempotencyKey
  });
}
```

Vedi [3-API/OVERVIEW.md](../3-API/OVERVIEW.md) per pattern idempotency nelle API.

---

### Compensation Queue (Failure Recovery)

**Problema:** Spedizione creata su API corriere, ma insert DB fallisce → orphan.

**Soluzione:** Coda di compensazione per cleanup manuale.

#### Flow

```typescript
try {
  // 1. Chiama API corriere
  const courierResponse = await courierClient.createShipping(...);
  
  // 2. Inserisci spedizione in DB
  const { data: shipment } = await supabaseAdmin
    .from('shipments')
    .insert({
      tracking_number: courierResponse.trackingNumber,
      // ...
    });
} catch (dbError) {
  // 3. DB fallito, prova a cancellare da corriere
  try {
    await courierClient.deleteShipping({ 
      shipmentId: courierResponse.shipmentId 
    });
  } catch (deleteError) {
    // 4. Non può cancellare, metti in coda per intervento manuale
    await supabaseAdmin.from('compensation_queue').insert({
      action: 'DELETE',
      shipment_id_external: courierResponse.shipmentId,
      provider_id: 'spedisci_online',
      error_context: { 
        dbError: dbError.message, 
        deleteError: deleteError.message 
      },
      status: 'PENDING'
    });
  }
}
```

#### Admin Dashboard

`/dashboard/admin/compensation` (TODO: Build UI)

**Key Insight:** Fail-safe recovery, mai perdere soldi.

---

### Migrations

Le migration sono in `supabase/migrations/` e seguono naming convention:
- `XXX_description.sql` - Numerazione sequenziale
- Ogni migration è idempotente (può essere eseguita multiple volte)

#### Esempi Migration Chiave

- `040_wallet_atomic_operations.sql` - Funzioni atomiche wallet
- `041_remove_wallet_balance_trigger.sql` - Rimozione trigger legacy
- `042_security_definer_search_path.sql` - Fix sicurezza funzioni
- `043_wallet_transactions_rls_hardening.sql` - Hardening RLS wallet

#### Applicare Migration

```bash
# Locale
supabase migration up

# Production (via Supabase CLI)
supabase db push
```

Vedi [6-DEPLOYMENT/SUPABASE.md](../6-DEPLOYMENT/SUPABASE.md) per dettagli su deployment migration.

---

## Examples

### Usare Wallet Functions

```typescript
import { supabaseAdmin } from '@/lib/db/client';

// Aggiungi credito (con audit trail)
const { error } = await supabaseAdmin.rpc('add_wallet_credit', {
  p_user_id: userId,
  p_amount: 100.00,
  p_description: 'Top-up approvato',
  p_admin_id: adminId
});

// Decrementa saldo (atomico)
const { error } = await supabaseAdmin.rpc('decrement_wallet_balance', {
  p_user_id: userId,
  p_amount: 25.50
});
```

### Verificare RLS

```typescript
// Client-side: RLS applicato automaticamente
const { data } = await supabase
  .from('shipments')
  .select('*');
// Utente vede solo proprie spedizioni

// Server-side: Bypass RLS se necessario
const { data } = await supabaseAdmin
  .from('shipments')
  .select('*');
// Admin vede tutte le spedizioni
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| Saldo negativo | Verifica che usi `decrement_wallet_balance()` invece di UPDATE diretto |
| Race condition wallet | Usa sempre funzioni atomiche, mai UPDATE diretto |
| RLS blocca query | Verifica che `auth.uid()` sia impostato correttamente |
| Duplicati spedizioni | Verifica che `idempotency_key` sia generato correttamente |
| Compensation queue piena | Verifica log errori e risolvi manualmente |

---

## Related Documentation

- [Backend Architecture](BACKEND.md) - API routes, Server Actions
- [Security Overview](../8-SECURITY/OVERVIEW.md) - RLS policies dettagliate
- [Wallet Feature](../11-FEATURES/WALLET.md) - Sistema wallet completo
- [Deployment Supabase](../6-DEPLOYMENT/SUPABASE.md) - Migration e deployment

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | AI Agent |

---
*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Team*
