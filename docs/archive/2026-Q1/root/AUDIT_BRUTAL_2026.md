# 💀 BRUTAL AUDIT: SPEDISCISICURO - 2026-01-17

**Obiettivo**: Valutazione senza compromessi "10/10".
**Stato Attuale**: 7/10
**Verdetto Immediato**: 🔴 **FAIL** (Non pronto per Scale-Up Enterprise)

---

## 🚨 VULNERABILITÀ CRITICHE (SHOWSTOPPERS)

### 1. 💀 SECURITY: Encryption Fail-Open in Produzione (P1 → P0)

**File**: `lib/security/encryption.ts`
**Problema**: Se `ENCRYPTION_KEY` manca, il sistema **salva e restituisce le password in chiaro** anche in `production`.
**Why Brutal**: Un errore di configurazione (comune in deploy) espone TUTTE le credenziali dei clienti. Inaccettabile per un sistema finanziario/logistico.
**Rischio**: Leak totale credenziali API fornitori.

### 2. 💀 SECURITY: Account Takeover su Legacy Configs (P1)

**File**: `lib/couriers/factory.ts`, `lib/actions/spedisci-online.ts`
**Problema**: L'accesso alle configurazioni legacy si basa su `created_by` (email).
**Vettore d'attacco**:

1. Utente Bob (email: `bob@old.com`) ha config legacy.
2. Bob cambia email a `bob@new.com`.
3. Attaccante registra `bob@old.com` (se policy lo permette).
4. Attaccante eredita accesso alle config di Bob.
   **Why Brutal**: L'identità è l'UUID, non l'email. L'email è mutabile.

### 3. 💀 RELIABILITY: Middleware DB Dependency (P1)

**File**: `middleware.ts`
**Problema**: `findUserByEmail` viene chiamato su **OGNI request** autenticata.
**Why Brutal**:

- **Latency**: Aggiunge overhead DB a ogni cambio pagina.
- **Single Point of Failure**: Se DB ha un hiccup, TUTTA la dashboard va giù (non solo le parti dati).
- **Cost**: Aumenta esponenzialmente le letture su Supabase.

---

## ⚠️ AFFIDABILITÀ & QUALITY OF LIFE

### 4. ⚠️ Missing "Circuit Breakers"

**Analisi**: Le chiamate esterne (Spedisci.Online) non sembrano avere un circuit breaker robusto. Se l'API esterna va in timeout, i nostri worker/client rimangono appesi o falliscono a catena.

### 5. ⚠️ Logging "Sanitized" ma Verbosità Rischiosa

**Analisi**: Il logging è stato migliorato (SHA256), ma la quantità di log in `factory.ts` e `actions` è eccessiva per la produzione. Rischio di riempire i log (e costi Ingestion) e potenzialmente loggare strutture dati complesse (`contract_mapping`) che potrebbero contenere PII nascoste.

---

## 🛠️ PIANO DI REMEDIAZIONE (ROADMAP TO 10/10)

### FASE 1: Security Hardening (Immediato)

1.  **Fix Encryption**: Modificare `lib/security/encryption.ts` per lanciare `FATAL ERROR` in produzione se la chiave manca.
    - _Obiettivo_: Fail-Safe (Il sistema non parte se non è sicuro).
2.  **Fix Ownership**: Rimuovere fallback su `created_by` (email) o migrare tutte le config legacy per avere `owner_user_id` e poi rimuovere il controllo email.
    - _Obiettivo_: Identity immutabile.

### FASE 2: Performance & Reliability

3.  **Ottimizzare Middleware**: Spostare il controllo `onboarding` fuori dal middleware (usare custom claim in sessione o controllo client-side lazy) o usare Edge Config/Redis.
    - _Obiettivo_: Rimuovere DB call dal path critico di routing.

### FASE 3: Verification

4.  **Test "Evil Maid"**: Simulare cambio email e tentato accesso risorse vecchie.
5.  **Test "Missing Key"**: Verificare che l'app crashi all'avvio senza chiavi (in staging/prod env).

---

## 📊 STATO FINALE

| Categoria        | Voto     | Note                                                   |
| ---------------- | -------- | ------------------------------------------------------ |
| **Sicurezza**    | 6/10     | Encryption Fail-Open è grave. Auth by Email è fragile. |
| **Affidabilità** | 7/10     | Middleware pesante. Locking DB buono.                  |
| **Privacy**      | 8/10     | RLS solido. Logging migliorato.                        |
| **Totale**       | **7/10** | **NON PRONTO PER ENTERPRISE**                          |

**Prossimo Step**: Confermare il piano di fix per i 3 punti critici.
