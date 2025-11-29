# ⚡ AI QUICK START - SpediSicuro

> **Per chi ha fretta: Leggi questo, poi approfondisci con `.AI_DIRECTIVE.md`**

---

## 🎯 TRE REGOLE D'ORO

1. **PERCORSI RELATIVI** → `app/page.tsx` ✅ non `C:\spediresicuro\app\page.tsx` ❌
2. **CONTROLLA PRIMA** → `cat .ai-lock.json` e `cat AGENT_NOTES.md` ✅
3. **COMMIT CON PREFISSO** → `feat(cursor): add button` ✅

---

## 🚀 START RAPIDO

### In Cursor

```bash
# 1. Sincronizza
git fetch origin

# 2. Vedi branch disponibili
git branch -r | grep claude

# 3. Scarica lavoro Claude Code (esempio)
git checkout claude/sync-master-branch-01AQAkxwR5Pd2Ww1CDZdBbL8

# 4. Controlla comunicazioni
cat AGENT_NOTES.md

# 5. Controlla lock
cat .ai-lock.json

# 6. Lavora sui file
# ... modifiche con Cursor ...

# 7. Commit
git add .
git commit -m "feat(cursor): descrizione modifiche"

# 8. Push
git push
```

---

## 📋 QUALE AGENTE PER QUALE TASK?

| Task | Agente |
|------|--------|
| Feature complessa multi-file | **Claude Code** |
| Quick fix single file | **Cursor** |
| Componente UI | **Cursor Composer** |
| Utility function | **ChatGPT** |
| Pianificazione | **Claude Web** |
| UI da screenshot | **Gemini** |

---

## 🔄 WORKFLOW TIPO

```
1. Claude Code → Implementa backend
   Push su: claude/[feature]-[id]

2. Tu in Cursor → Scarica e testa
   git fetch origin
   git checkout claude/[feature]-[id]
   npm run dev

3. Tu in Cursor → Aggiungi frontend
   ... modifiche ...
   git commit -m "feat(cursor): add UI"
   git push

4. ChatGPT → Genera test
   Copi test → aggiungi al progetto

5. Tu → Review e merge
   PR → master → Vercel deploy ✅
```

---

## 🔒 EVITARE CONFLITTI

### Prima di modificare file:
```bash
cat .ai-lock.json  # Controlla se file locked
```

### Se file locked da altro agente:
- ❌ **Non modificare**
- ✅ **Lavora su altro** oppure **aspetta**

### Se inizi task lungo (>30min):
```json
// Aggiungi in .ai-lock.json
{
  "locks": [
    {
      "files": ["app/api/auth/**/*"],
      "agent": "cursor",
      "branch": "human/auth-ui",
      "started": "2024-01-29T15:00:00Z"
    }
  ]
}
```

---

## 💬 COMUNICARE CON ALTRI AGENTI

### Aggiungi entry in `AGENT_NOTES.md`:

```markdown
## 2024-01-29 16:00 - Cursor
**Branch:** human/payment-ui
**Status:** ✅ Completato
**Files:** app/payment/page.tsx, components/PaymentForm.tsx
**Next:** Backend API endpoint needed in app/api/payment/route.ts
**Notes:** UI ready, waiting for backend integration
```

---

## 🎨 CONVENZIONI CODICE

```typescript
// ✅ VARIABILI in ITALIANO
const prezzoTotale = calcolaPrezzo(prezzoBase, ricarico)

// ✅ COMMENTI in ITALIANO
// Calcola il prezzo finale con ricarico
function calcolaPrezzo(base: number, ricarico: number) {
  return base * (1 + ricarico / 100)
}

// ✅ IMPORT con alias @
import { Button } from '@/components/ui/button'
```

---

## ⚠️ FILE DA NON COMMITTARE

- ❌ `.env.local`
- ❌ `node_modules/`
- ❌ `.next/`

---

## 🆘 PROBLEMI COMUNI

### "Push rejected (non-fast-forward)"
```bash
git pull origin [branch] --rebase
git push origin [branch]
```

### "Modifiche non visibili"
```bash
git fetch origin
git checkout [branch-name]
# In Cursor: Ctrl+Shift+P → Reload Window
```

### "Conflitti durante merge"
```bash
# Apri file, risolvi markers <<<< ==== >>>>
git add [file-risolto]
git commit -m "fix: resolve conflicts"
```

---

## 📚 APPROFONDIMENTI

**Documento completo:** `.AI_DIRECTIVE.md` (leggi per dettagli completi)

---

## ✅ CHECKLIST VELOCE

```markdown
- [ ] git fetch origin ✅
- [ ] cat .ai-lock.json ✅
- [ ] cat AGENT_NOTES.md ✅
- [ ] Percorsi relativi? ✅
- [ ] Commit con prefisso agente? ✅
```

---

**Pronto! Buon lavoro! 🚀**

Per domande dettagliate → leggi `.AI_DIRECTIVE.md`
