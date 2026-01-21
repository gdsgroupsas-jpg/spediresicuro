# 🔍 Audit Mode Prompt - Standard per Security Review

**Versione:** 1.0  
**Scopo:** Prompt standardizzato per audit di sicurezza (Manus, Claude, altri auditor)

---

## 📋 Prompt Standard

```
[RUOLO] Security Auditor specializzato in Next.js 14, Supabase, e multi-tenant SaaS.

[CONTESTO] Progetto: SpedireSicuro.it
- Stack: Next.js 14 (App Router), TypeScript, Supabase (PostgreSQL), Vercel
- Architettura: Multi-tenant con RLS, middleware fail-closed
- Ambiente: https://spediresicuro.vercel.app (Vercel Production)

[FONTE DI VERITÀ]
1. Leggi SECURITY_CONTEXT.md per modelli e regole
2. Leggi SECURITY_ASSERTIONS.md per expected behavior
3. Verifica commit deployato su produzione:
   - Branch: master
   - Ultimo commit: [VERIFICARE CON git log origin/master -1]
   - Deploy Vercel: https://vercel.com/gdsgroupsas-jpg/spediresicuro/deployments

[OBIETTIVO]
Eseguire security audit completo e classificare rischi secondo regole in SECURITY_CONTEXT.md.

[REGOLE AUDIT]
1. Distingui rischio teorico vs effettivo
2. CRITICAL solo se:
   - Rischio effettivo (non teorico)
   - Riproduzione su produzione inclusa
   - Evidenza di exploitabilità reale
3. Include sempre:
   - Commit analizzato
   - Evidenza (snippet codice + righe)
   - Riproduzione (se CRITICAL)
   - Fix proposto

[CHECKLIST]
- [ ] Commit analizzato corrisponde a commit deployato?
- [ ] Evidenza include snippet codice + righe?
- [ ] Rischio teorico o effettivo?
- [ ] Se CRITICAL: riproduzione su produzione inclusa?
- [ ] Fix proposto conforme ai modelli in SECURITY_CONTEXT.md?

[OUTPUT RICHIESTO]
1. Executive Summary (GO/NO-GO)
2. Checklist tabellare (requisito, PASS/FAIL, evidenza, rischio, fix)
3. Evidence Snippets (codice rilevante)
4. Riproduzione (se CRITICAL)
5. Raccomandazioni prioritarie

[VINCOLI]
- Non modificare codice (solo analisi)
- Niente supposizioni: ogni affermazione deve citare EVIDENZA
- Output in Markdown
- Linguaggio: italiano semplice
```

---

## 🎯 Uso del Prompt

### Per Auditor Esterni (Manus, Claude, ecc.)

1. **Copia il prompt sopra**
2. **Aggiungi contesto specifico:**
   - Commit da analizzare
   - Area di focus (es: middleware, RLS, API endpoints)
   - Domande specifiche
3. **Includi file di riferimento:**
   - `SECURITY_CONTEXT.md`
   - `SECURITY_ASSERTIONS.md`
   - File codice rilevanti

### Per Audit Interni

1. **Verifica commit deployato:**

   ```bash
   git log origin/master -1 --oneline
   ```

2. **Esegui audit usando prompt standard**

3. **Documenta risultati in:**
   - `SECURITY_ASSERTIONS.md` (sezione Verification Record)
   - Issue/PR con tag `security`

---

## 📊 Template Output Audit

### Executive Summary

```
Overall: GO / NO-GO
Conteggio: P0 passati, P1 passati, P2 passati
Commit Analizzato: [hash]
Data: [data]
```

### Checklist Tabellare

```
| Requisito | Status | Evidenza | Rischio | Fix Concept |
|-----------|--------|----------|---------|-------------|
| G1 - ... | PASS/FAIL | [snippet + righe] | [livello] | [1-2 righe] |
```

### Evidence Snippets

````
### ❌ G1 - Titolo Problema
**File:** `path/to/file.ts`
**Righe:** 123-145
```typescript
// Snippet codice rilevante
````

**Evidenza:** [spiegazione]

```

### Riproduzione (solo se CRITICAL)
```

**Test su Produzione:**

```bash
curl -i https://spediresicuro.vercel.app/...
```

**Risultato:** [output atteso vs reale]

```

---

## 🔄 Workflow Audit

### Step 1: Preparazione
1. Verifica commit deployato
2. Leggi `SECURITY_CONTEXT.md`
3. Leggi `SECURITY_ASSERTIONS.md`
4. Identifica area di focus

### Step 2: Analisi
1. Usa prompt standard
2. Analizza codice
3. Verifica conformità ai modelli
4. Testa su produzione (se necessario)

### Step 3: Classificazione
1. Distingui rischio teorico vs effettivo
2. Classifica secondo regole in `SECURITY_CONTEXT.md`
3. Documenta evidenza

### Step 4: Report
1. Compila template output
2. Include riproduzione (se CRITICAL)
3. Include fix proposto
4. Aggiorna `SECURITY_ASSERTIONS.md` (se necessario)

---

## ✅ Acceptance Criteria

- [ ] Prompt standard utilizzato
- [ ] Commit deployato verificato
- [ ] Evidenza include snippet + righe
- [ ] CRITICAL include riproduzione
- [ ] Fix conforme ai modelli

---

**Status:** ✅ Prompt standard definito
```
