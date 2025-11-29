# 💬 Agent Communication Log

> **Scopo:** Comunicazione asincrona tra agenti AI diversi
> **Regola:** Aggiungi entry SEMPRE dopo completare un task significativo

---

## 📋 Template Entry

```markdown
## YYYY-MM-DD HH:MM - [Agent Name]
**Branch:** branch-name
**Status:** [✅ Completato | 🚧 In Progress | ⏸️ Paused | ❌ Blocked]
**Files Modified:**
- path/to/file1.ts
- path/to/file2.tsx

**What I Did:**
- Implementato feature X
- Fixato bug Y
- Aggiunto test Z

**What's Next:**
- [ ] Task da fare dopo
- [ ] Altro task

**Notes for Next Agent:**
Informazioni importanti, gotchas, decisioni prese, ecc.

**Blockers/Issues:**
Eventuali problemi riscontrati o decisioni da prendere
```

---

## 📝 Communication History

### Example Entry - Rimuovi dopo primo uso reale

## 2024-01-29 15:00 - Claude Code
**Branch:** claude/setup-ai-system-01AQAkxwR5Pd2Ww1CDZdBbL8
**Status:** ✅ Completato
**Files Modified:**
- `.AI_DIRECTIVE.md` (nuovo)
- `.ai-lock.json` (nuovo)
- `AGENT_NOTES.md` (questo file)

**What I Did:**
- Creato sistema di coordinamento multi-agente
- Generato documento master `.AI_DIRECTIVE.md`
- Setup file lock system
- Inizializzato log comunicazione

**What's Next:**
- [ ] Testare workflow con Cursor
- [ ] Validare sistema con task reale
- [ ] Aggiornare .gitignore se necessario

**Notes for Next Agent:**
- Leggi `.AI_DIRECTIVE.md` per overview completa
- Questo sistema è nuovo, aiuta a migliorarlo se trovi problemi
- I file `.ai-lock.json` e `AGENT_NOTES.md` possono essere committati per condivisione

**Blockers/Issues:**
Nessuno al momento

---

## 🎯 Quick Reference

### Status Icons
- ✅ Completato - Task finito, pronto per review/merge
- 🚧 In Progress - Sto ancora lavorando
- ⏸️ Paused - Messo in pausa, puoi continuare tu
- ❌ Blocked - Bloccato, serve intervento
- 🔍 Needs Review - Completato ma serve review
- 🧪 Testing - In fase di test

### Quando Aggiungere Entry
1. Dopo completare implementazione significativa
2. Prima di passare task a altro agente
3. Quando metti in pausa lavoro per più di 1 ora
4. Quando riscontri blocker importante
5. Fine giornata lavorativa

### Best Practices
- Sii specifico sui file modificati
- Usa percorsi relativi
- Spiega *perché* hai fatto certe scelte, non solo *cosa*
- Documenta gotchas e edge cases
- Lista TODO chiari per next agent

---

**Inizia ad aggiungere le tue entry sotto questa linea** ⬇️

---
