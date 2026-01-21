# Pull Request

## 📋 Descrizione

[Descrizione breve delle modifiche]

## 🔗 Issue Correlate

- Closes #XXXX
- Relates to #XXXX

---

## 🔒 Security Gate

### Checklist Pre-Merge

- [ ] Ho letto `SECURITY_CONTEXT.md` e `SECURITY_ASSERTIONS.md`
- [ ] Commit analizzato corrisponde a commit che verrà deployato
- [ ] Nessuna modifica a endpoint CRON senza aggiornare middleware
- [ ] Nessuna modifica a RLS policies senza documentazione
- [ ] Nessun endpoint di test/debug aggiunto in produzione
- [ ] Service role (`supabaseAdmin`) non esposto client-side

### Verifiche Runtime (se applicabile)

- [ ] CRON endpoints: Testato 401 senza header, 401 wrong token, 200 correct token
- [ ] Path traversal: Testato blocco `..`, `//`, encoded variants
- [ ] RLS: Verificato che tabelle tenant hanno RLS enabled

### Documentazione Security

- [ ] Modifiche a middleware documentate in `SECURITY_CONTEXT.md` (se necessario)
- [ ] Nuove assertions aggiunte a `SECURITY_ASSERTIONS.md` (se necessario)

**Link Documentazione:**

- [SECURITY_CONTEXT.md](../../SECURITY_CONTEXT.md)
- [SECURITY_ASSERTIONS.md](../../SECURITY_ASSERTIONS.md)
- [AUDIT_MODE_PROMPT.md](../../docs/security/AUDIT_MODE_PROMPT.md)

---

## 🧪 Testing

- [ ] Test locali passati
- [ ] Test E2E passati (se applicabile)
- [ ] Test middleware passati (se modificato middleware)
- [ ] Verificato su preview/staging

## 📝 Checklist Generale

- [ ] Codice conforme alle convenzioni del progetto
- [ ] TypeScript compila senza errori
- [ ] Linter passa
- [ ] Documentazione aggiornata (se necessario)
- [ ] Changelog aggiornato (se necessario)

---

## 📸 Screenshots (se applicabile)

[Inserisci screenshot se modifiche UI]

---

## ✅ Review Checklist per Reviewer

- [ ] Codice reviewato
- [ ] Security gate verificato
- [ ] Test verificati
- [ ] Documentazione verificata
- [ ] Approvato per merge

---

**Note Aggiuntive:** **\*\***\_\_\_**\*\***
