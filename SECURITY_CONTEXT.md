# 🔒 Security Context - Fonte di Verità

**Versione:** 1.0  
**Data:** 2025-01-XX  
**Scopo:** Eliminare disallineamenti tra audit e definire standard di security review

---

## 📍 Fonte di Verità

### Ambiente di Riferimento
- **Produzione:** https://spediresicuro.vercel.app (Vercel Production)
- **Branch Principale:** `master`
- **Commit Deployato:** Ultimo commit su `master` che ha triggerato deploy Vercel

### Verifica Commit Deployato
```bash
# Verifica ultimo commit su master
git log origin/master -1 --oneline

# Verifica deploy Vercel
# Vai su: https://vercel.com/gdsgroupsas-jpg/spediresicuro/deployments
```

**⚠️ IMPORTANTE:** Gli audit devono sempre verificare il commit effettivamente deployato su produzione, non il branch locale o feature branch.

---

## 🎯 Modelli di Sicurezza

### 1. Modello CRON Endpoints

**Pattern:** `/api/cron/**`

**Protezione:**
- ✅ **Middleware:** Validazione `CRON_SECRET_TOKEN` o `CRON_SECRET` nel middleware (fail-closed)
- ✅ **Header:** `Authorization: Bearer <token>`
- ✅ **Validazione:** Constant-time comparison (`timingSafeEqual`)
- ✅ **Comportamento:** 
  - Senza header → `401 Unauthorized`
  - Header sbagliato → `401 Unauthorized`
  - Header corretto → `200 OK` (se endpoint esiste)

**Env Variables:**
- `CRON_SECRET_TOKEN` (preferito)
- `CRON_SECRET` (fallback)

**File di Riferimento:**
- `middleware.ts` (righe 114-126)
- `app/api/cron/**/route.ts`

---

### 2. Modello Middleware

**Principi:**
- ✅ **Defense-in-Depth:** Protezioni multiple (matcher + validazione + path traversal)
- ✅ **Fail-Closed:** Se secret manca → deny (non allow)
- ✅ **Ordine Controlli:**
  1. Path traversal validation (riga 108)
  2. CRON secret validation (riga 114)
  3. Altre route → pass-through (riga 128)

**Matcher:**
- Pattern case-insensitive: `/[aA][pP][iI]/[cC][rR][oO][nN]/:path*`
- Path traversal: Blocca `..`, `//`, varianti encoded

**File di Riferimento:**
- `middleware.ts`

---

### 3. Modello Supabase

**Architettura:**
- ✅ **Multi-Tenant:** Isolamento dati per `user_id`
- ✅ **RLS Required:** Tutte le tabelle tenant devono avere RLS abilitato
- ✅ **Service Role:** Solo server-side (`supabaseAdmin`), mai client-side
- ✅ **Anon Key:** Client-side con RLS, mai per operazioni admin

**Pattern:**
- Client-side: `supabase` (anon key) → RLS applicato
- Server-side: `supabaseAdmin` (service role) → bypass RLS (solo per operazioni autorizzate)

**File di Riferimento:**
- `lib/db/client.ts`
- `lib/database.ts` (funzioni con `AuthContext`)

---

## 📊 Regole Audit

### Classificazione Rischi

**CRITICAL:**
- ✅ Richiede **riproduzione su produzione**
- ✅ Evidenza di exploitabilità reale
- ✅ Impatto: accesso non autorizzato, data leak, DoS

**HIGH:**
- ✅ Vulnerabilità teorica con evidenza nel codice
- ✅ Richiede fix immediato ma non necessariamente riproduzione
- ✅ Impatto: potenziale accesso non autorizzato

**MEDIUM:**
- ✅ Vulnerabilità teorica senza evidenza di exploitabilità
- ✅ Best practice non rispettata
- ✅ Impatto: degradazione sicurezza, non accesso diretto

**LOW:**
- ✅ Miglioramenti di sicurezza
- ✅ Code smell, non vulnerabilità
- ✅ Impatto: minimo

### Distinzione: Rischio Teorico vs Effettivo

**Rischio Teorico:**
- Pattern nel codice che *potrebbe* essere vulnerabile
- Nessuna evidenza di exploitabilità
- Nessuna riproduzione su produzione

**Rischio Effettivo:**
- Pattern vulnerabile con evidenza di exploitabilità
- Riproduzione su produzione possibile
- Impatto dimostrabile

**Regola:** CRITICAL solo se rischio effettivo con riproduzione.

---

## 🔍 Processo di Audit

### Step 1: Verifica Fonte di Verità
1. Identifica commit deployato su produzione
2. Verifica che il codice analizzato corrisponda al commit deployato
3. Se analizzi branch diverso, segnala esplicitamente

### Step 2: Analisi Codice
1. Leggi `SECURITY_CONTEXT.md` (questo file)
2. Leggi `SECURITY_ASSERTIONS.md` per expected behavior
3. Verifica conformità ai modelli definiti

### Step 3: Classificazione
1. Distingui rischio teorico vs effettivo
2. Per CRITICAL: richiedi riproduzione su produzione
3. Documenta evidenza (snippet codice + righe)

### Step 4: Report
1. Include commit analizzato
2. Include evidenza (snippet + righe)
3. Include riproduzione (se CRITICAL)
4. Include fix proposto

---

## 📚 File di Riferimento

### Security Documentation
- `SECURITY_CONTEXT.md` (questo file) - Modelli e regole
- `SECURITY_ASSERTIONS.md` - Expected behavior runtime
- `docs/security/AUDIT_MODE_PROMPT.md` - Prompt standard audit

### Code References
- `middleware.ts` - Protezione route e CRON
- `lib/db/client.ts` - Client Supabase (anon + service role)
- `lib/database.ts` - Funzioni database con AuthContext
- `lib/validators.ts` - Runtime validation (`assertValidUserId`)

### Migrations
- `supabase/migrations/033_fix_shipments_rls_security.sql` - RLS policies
- `supabase/migrations/034_remediate_orphan_shipments.sql` - Remediation
- `supabase/migrations/035_prevent_orphan_shipments.sql` - Prevention

---

## ✅ Checklist Audit

Prima di classificare un rischio:

- [ ] Commit analizzato corrisponde a commit deployato?
- [ ] Evidenza include snippet codice + righe?
- [ ] Rischio teorico o effettivo?
- [ ] Se CRITICAL: riproduzione su produzione inclusa?
- [ ] Fix proposto conforme ai modelli definiti?

---

**Status:** ✅ Fonte di verità definita
