# 🛠️ PIANO DI REMEDIAZIONE: AUDIT BRUTALE 2026

**Obiettivo**: Portare SpedisciSicuro da 7/10 a 10/10 (Security & Reliability).

## 1. FILE COINVOLTI

- `lib/security/encryption.ts` (Sicurezza Critica)
- `lib/couriers/factory.ts` (Sicurezza Logica)
- `lib/actions/spedisci-online.ts` (Sicurezza Logica)
- `middleware.ts` (Performance/Reliability)
- `tests/integration/security-regressions.test.ts` (Nuovo file test)

## 2. STEP-BY-STEP PLAN

### STEP 1: Hardening Encryption (P0)

**Azione**: Modificare `lib/security/encryption.ts`.
**Logica**:

- In `production`, se `ENCRYPTION_KEY` manca -> `throw new Error("FATAL: ENCRYPTION_KEY MISSING")`.
- In `development`, mantenere warning (o throw error se strict mode).
  **Rollback**: Revert del file.

### STEP 2: Eliminazione Vulnerabilità Email Legacy (P1)

**Azione**:

1. Eseguire Migrazione Dati (SQL) per assicurare che TUTTE le `courier_configs` abbiano `owner_user_id`.
2. Modificare `factory.ts` e `spedisci-online.ts` per RIMUOVERE il controllo `created_by` (email) o renderlo dipendente da una verifica UUID.
   **Rollback**: Reintrodurre check email.

### STEP 3: Ottimizzazione Middleware (P1)

**Azione**:

1. Rimuovere `findUserByEmail` (DB call) dal middleware.
2. Basare il redirect `onboarding` su un claim nel JWT session o su un cookie `onboarding_completed`.
3. In alternativa, spostare il check `onboarding` nel layout della Dashboard (Server Component), lasciando il middleware leggero solo per Auth token check.
   **Rollback**: Ripristinare chiamata DB.

## 3. CHECKLIST TEST AUTOMATICI

- [ ] **Unit Test Encryption**:
  - Mock `NODE_ENV=production`, unset `ENCRYPTION_KEY` -> Expect Throw.
  - Mock `NODE_ENV=production`, set `ENCRYPTION_KEY` -> Expect Success.
- [ ] **Integration Test Security**:
  - Creare utente A, creare config.
  - Cambiare email utente A (simulato o reale).
  - Creare nuovo utente B con vecchia email di A.
  - Verificare che B **NON** acceda alla config di A.

## 4. QUERY DB DI VERIFICA (Read-Only)

```sql
-- 1. Trova configurazioni Legacy a rischio (senza owner_user_id ma con created_by)
SELECT id, name, created_by, owner_user_id
FROM courier_configs
WHERE owner_user_id IS NULL AND created_by IS NOT NULL;

-- 2. Verifica Utenti con Email cambiata rispetto alle config (se possibile incrociare)
-- Richiede join complessa, meglio verifica puntuale.
```

## 5. RISCHI E ROLLBACK

- **Rischio Encryption**: Se la chiave manca in prod e deployiamo, il sito va giù (Error 500). **Mitigazione**: Verificare variabili d'ambiente Vercel PRIMA del merge.
- **Rischio Legacy**: Utenti molto vecchi potrebbero perdere accesso se la migrazione dati fallisce. **Mitigazione**: Backup dei dati prima della migrazione.
- **Rischio Middleware**: Possibile blink di accesso dashboard prima del redirect (se spostato in layout). **Mitigazione**: Accettabile per UX vs Performance.

## 6. STATO FINALE ATTESO

- **Security Check**: PASS (No cleartext fallback, No email hijacking).
- **Reliability Check**: PASS (Middleware < 10ms, No DB deps).
